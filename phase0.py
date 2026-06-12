"""Phase 0 — validate the explanation engine.

One song in: Deezer 30s preview + LRCLIB lyrics -> librosa features -> LLM
-> printed explanation. No pipeline, no UI. The only question this answers:
is the explanation specific and insightful, or generic filler?

Usage:
    python phase0.py "Artist" "Title"
    python phase0.py --all          # run the built-in validation set

LLM: uses the anthropic SDK if ANTHROPIC_API_KEY is set, otherwise shells
out to the local `claude` CLI (`claude -p`). Same prompt either way — the
prompt is what's being validated.
"""

import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import requests
import librosa

CACHE_DIR = Path(__file__).parent / "cache"
AUDIO_CACHE = CACHE_DIR / "audio"
LLM_CACHE = CACHE_DIR / "llm"
USER_AGENT = "Fermata/0.1-phase0 (validation script)"
MODEL = os.environ.get("FERMATA_MODEL", "claude-fable-5")

VALIDATION_SET = [
    ("Johnny Cash", "Hurt"),                # lyric-driven
    ("Robyn", "Dancing On My Own"),         # lyric/music tension
    ("Radiohead", "Everything In Its Right Place"),  # music-driven
    ("Kanye West", "Runaway"),              # music-driven, famous moment
    ("Frank Ocean", "Self Control"),        # production + lyric
]


# ---------------------------------------------------------------- data fetch

def get_with_retry(url: str, params: dict, attempts: int = 3) -> requests.Response:
    last: Exception | None = None
    for i in range(attempts):
        try:
            return requests.get(url, params=params,
                                headers={"User-Agent": USER_AGENT}, timeout=20)
        except requests.RequestException as e:
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"request failed after {attempts} attempts: {last}")


def deezer_search(artist: str, title: str) -> dict:
    r = get_with_retry(
        "https://api.deezer.com/search",
        {"q": f'artist:"{artist}" track:"{title}"', "limit": 5},
    )
    r.raise_for_status()
    tracks = [t for t in r.json().get("data", []) if t.get("preview")]
    if not tracks:
        raise RuntimeError(f"No Deezer preview found for {artist} - {title}")
    return tracks[0]


def lrclib_lyrics(artist: str, title: str, duration: int) -> dict | None:
    r = get_with_retry(
        "https://lrclib.net/api/get",
        {"artist_name": artist, "track_name": title, "duration": duration},
    )
    if r.status_code == 200:
        return r.json()
    # fallback: search and match duration within +-2s
    r = get_with_retry(
        "https://lrclib.net/api/search",
        {"artist_name": artist, "track_name": title},
    )
    if r.status_code == 200:
        for hit in r.json():
            if abs(hit.get("duration", 0) - duration) <= 2:
                return hit
    return None


def download_preview(url: str, key: str) -> Path:
    AUDIO_CACHE.mkdir(parents=True, exist_ok=True)
    path = AUDIO_CACHE / f"{key}.mp3"
    if not path.exists():
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
        r.raise_for_status()
        path.write_bytes(r.content)
    return path


# ------------------------------------------------------------ audio features

KRUMHANSL_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KRUMHANSL_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
PITCHES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def estimate_key(chroma_mean: np.ndarray) -> tuple[str, float]:
    best = ("?", -2.0)
    for i in range(12):
        rolled = np.roll(chroma_mean, -i)
        for profile, mode in ((KRUMHANSL_MAJOR, "major"), (KRUMHANSL_MINOR, "minor")):
            score = float(np.corrcoef(rolled, profile)[0, 1])
            if score > best[1]:
                best = (f"{PITCHES[i]} {mode}", score)
    return best


def extract_features(mp3_path: Path) -> dict:
    y, sr = librosa.load(mp3_path, sr=22050, mono=True)
    clip_dur = len(y) / sr

    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    tempo = float(np.atleast_1d(tempo)[0])

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key, key_conf = estimate_key(chroma.mean(axis=1))

    hop = 512
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
    # smooth and normalize 0-1
    win = max(1, len(rms) // 60)
    smooth = np.convolve(rms, np.ones(win) / win, mode="same")
    lo, hi = smooth.min(), smooth.max()
    norm = (smooth - lo) / (hi - lo) if hi > lo else smooth * 0
    # ~15 timestamped energy points
    idx = np.linspace(0, len(norm) - 1, 15).astype(int)
    energy_curve = [(round(float(times[i]), 1), round(float(norm[i]), 2)) for i in idx]

    # biggest energy shifts within the clip
    deriv = np.gradient(norm)
    shift_frames = np.argsort(np.abs(deriv))[-len(deriv) // 50:]
    shifts = []
    used: list[float] = []
    for f in sorted(shift_frames, key=lambda f: -abs(deriv[f])):
        t = float(times[f])
        if all(abs(t - u) > 2.5 for u in used):
            used.append(t)
            shifts.append({
                "time_s": round(t, 1),
                "direction": "rise" if deriv[f] > 0 else "drop",
                "energy_before": round(float(norm[max(0, f - 20)]), 2),
                "energy_after": round(float(norm[min(len(norm) - 1, f + 20)]), 2),
            })
        if len(shifts) >= 3:
            break

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time")

    third = len(centroid) // 3
    return {
        "clip_seconds": round(clip_dur, 1),
        "tempo_bpm": round(tempo, 1),
        "key_estimate": key,
        "key_confidence": round(key_conf, 2),
        "energy_curve_time_value": energy_curve,
        "biggest_energy_shifts": shifts,
        "brightness_hz_by_third": [round(float(centroid[i * third:(i + 1) * third].mean())) for i in range(3)],
        "onset_density_per_s": round(len(onsets) / clip_dur, 2),
        "beat_count": int(len(beats)),
    }


# ------------------------------------------------------------------ the LLM

PROMPT_TEMPLATE = """You are writing for someone who is obsessed with the song "{title}" by {artist} but has no music-theory vocabulary. Your job: explain the mechanical craft — structure, harmony, production, and lyrics — that makes this song land emotionally, so they go "oh, THAT'S why."

You have three sources of truth. Be honest about which one each claim rests on:
1. MEASURED — features extracted from a 30-second preview clip of the actual recording (below). Timestamps are clip-relative; the clip's position within the full song is unknown (previews usually capture a representative section). Treat these as real measurements of the record.
2. LYRICS — the complete lyrics (below), with line timestamps for the FULL song when available. Not clip-limited.
3. INFERRED — your own knowledge of this well-known recording (its structure, production history, famous moments). Use it, but label it as inference, and never invent specifics you aren't confident about.

MEASURED CLIP FEATURES:
{features}

FULL LYRICS{synced_note}:
{lyrics}

Rules — these are hard requirements:
- Every single claim must be specific to THIS recording. Before writing a sentence, test it: could this sentence appear in an explanation of a different song without change? If yes, cut it or sharpen it until it couldn't.
- Always connect a mechanical cause to a felt effect. Not "the song uses dynamics" but "the drums vanish for two bars right before the hook, so when they slam back it feels like being let go and caught."
- Cover both the music and the lyrics, weighted by what actually carries this song. If it's a lyric-first song, say so and dig into the writing (rhyme, repetition, what's NOT said, where the phrasing breaks). If it's production-first, dig into the sound.
- Plain language. If you need a technical term, explain it in the same breath in plain words.
- Anchor lyric claims in the actual words, but quote SPARINGLY: short fragments only, never more than one line at a time, never two consecutive lines. Total quoted material across the whole response must stay small. Paraphrase the rest.
- No filler praise ("masterpiece", "iconic", "timeless"). No hedging mush. Confident, warm, precise.

Return ONLY a JSON object, no prose around it, in this exact shape:
{{
  "overall": "2-3 short paragraphs: the core read of why this song hits. The single best insight goes first.",
  "moments": [
    {{
      "timestamp": "a time like '2:18' (full-song, from lyrics/inference) or 'clip 0:14' (measured)",
      "moment": "3-6 word label",
      "what_happens": "the mechanical fact, plainly",
      "why_it_hits": "the felt effect it produces",
      "basis": "measured | lyrics | inferred"
    }}
  ],
  "lyric_read": "a short paragraph on the lyric craft specifically, or null if instrumental",
  "headline": "one sentence, under 15 words: the single sharpest insight about why this song works"
}}
Aim for 3-5 moments. Quality over count — every moment must earn its place.
The response must be strictly valid JSON: escape every newline inside a string as \\n (no literal line breaks inside strings)."""


def build_prompt(artist: str, title: str, features: dict, lyrics: dict | None) -> str:
    if lyrics and lyrics.get("syncedLyrics"):
        lyr_text, synced_note = lyrics["syncedLyrics"], " (line-timestamped)"
    elif lyrics and lyrics.get("plainLyrics"):
        lyr_text, synced_note = lyrics["plainLyrics"], ""
    else:
        lyr_text, synced_note = "(instrumental or lyrics unavailable — analyze the music only)", ""
    return PROMPT_TEMPLATE.format(
        title=title, artist=artist,
        features=json.dumps(features, indent=2),
        lyrics=lyr_text, synced_note=synced_note,
    )


def call_llm(prompt: str) -> str:
    LLM_CACHE.mkdir(parents=True, exist_ok=True)
    cache_key = hashlib.sha256((MODEL + prompt).encode()).hexdigest()[:24]
    cache_file = LLM_CACHE / f"{cache_key}.txt"
    if cache_file.exists():
        return cache_file.read_text()

    if os.environ.get("ANTHROPIC_API_KEY"):
        import anthropic
        client = anthropic.Anthropic()
        msg = client.messages.create(
            model=MODEL, max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text
    else:
        proc = subprocess.run(
            ["claude", "-p", "--model", "opus"],
            input=prompt, capture_output=True, text=True, timeout=600,
        )
        if proc.returncode != 0:
            raise RuntimeError(
                f"claude CLI failed (rc {proc.returncode}): "
                f"stderr={proc.stderr[:300]!r} stdout={proc.stdout[:300]!r}"
            )
        text = proc.stdout

    cache_file.write_text(text)
    return text


def parse_json(text: str) -> dict | None:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    blob = m.group(0)
    try:
        return json.loads(blob)
    except json.JSONDecodeError:
        # common model failure: literal newlines inside JSON strings
        try:
            return json.loads(re.sub(r'(?<=[^"{\[,:\s])\n(?=\s*[^"\s])', r"\\n",
                                     blob.replace("\r", "")))
        except json.JSONDecodeError:
            return None


# ----------------------------------------------------------------- run/print

def run_song(artist: str, title: str) -> None:
    print(f"\n{'=' * 72}\n  {title} — {artist}\n{'=' * 72}")
    track = deezer_search(artist, title)
    print(f"  matched: {track['title']} — {track['artist']['name']} "
          f"({track['duration']}s, isrc {track.get('isrc', '?')})")

    lyrics = lrclib_lyrics(track["artist"]["name"], track["title"], track["duration"])
    print(f"  lyrics: {'synced' if lyrics and lyrics.get('syncedLyrics') else 'plain' if lyrics and lyrics.get('plainLyrics') else 'NONE'}")

    key = re.sub(r"\W+", "_", f"{artist}_{title}".lower())
    mp3 = download_preview(track["preview"], key)
    features = extract_features(mp3)
    print(f"  features: {features['tempo_bpm']} bpm, {features['key_estimate']} "
          f"(conf {features['key_confidence']}), {features['clip_seconds']}s clip")

    print("  calling LLM...")
    raw = call_llm(build_prompt(artist, title, features, lyrics))
    result = parse_json(raw)
    if result is None:
        print("  !! JSON parse failed — raw output:\n")
        print(raw)
        return

    print(f"\n  HEADLINE: {result.get('headline', '—')}\n")
    print("  OVERALL:")
    for para in result.get("overall", "").split("\n"):
        if para.strip():
            print(f"    {para.strip()}\n")
    print("  MOMENTS:")
    for m in result.get("moments", []):
        print(f"    [{m.get('timestamp', '?'):>10}] {m.get('moment', '')}  ({m.get('basis', '?')})")
        print(f"        what: {m.get('what_happens', '')}")
        print(f"        why:  {m.get('why_it_hits', '')}\n")
    if result.get("lyric_read"):
        print(f"  LYRIC READ:\n    {result['lyric_read']}\n")


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--all":
        songs = VALIDATION_SET
    elif len(sys.argv) == 3:
        songs = [(sys.argv[1], sys.argv[2])]
    else:
        print(__doc__)
        sys.exit(1)
    for artist, title in songs:
        try:
            run_song(artist, title)
        except Exception as e:  # keep validating the rest
            print(f"  !! failed: {e}")


if __name__ == "__main__":
    main()
