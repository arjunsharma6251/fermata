"""Fermata engine — fetch, analyze, explain.

The pipeline validated in phase0.py, packaged for the API:
Deezer (preview + art + metadata) -> LRCLIB (lyrics) -> librosa (features)
-> LLM (the explanation). The prompt here is the one that cleared Phase 0 —
treat changes to it as product changes, not refactors.
"""

import hashlib
import json
import os
import re
import subprocess
import threading
import time
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
import requests
import librosa

CACHE_DIR = Path(
    os.environ.get("FERMATA_CACHE_DIR", Path(__file__).resolve().parent.parent / "cache")
)
AUDIO_CACHE = CACHE_DIR / "audio"
USER_AGENT = "Fermata/0.1 (github.com/arjunsharma6251)"
MODEL = os.environ.get("FERMATA_MODEL", "claude-opus-4-8")
WAVEFORM_BARS = 96

# librosa's memory spike is the tightest constraint on the 512 MB free host;
# serialize feature extraction so two concurrent analyses can't both spike
# and OOM the worker. The LLM call (the slow part) runs outside this lock.
_FEATURE_LOCK = threading.Lock()


# ---------------------------------------------------------------- data fetch

def _get(url: str, params: dict | None = None, attempts: int = 3) -> requests.Response:
    last: Exception | None = None
    for i in range(attempts):
        try:
            return requests.get(url, params=params,
                                headers={"User-Agent": USER_AGENT}, timeout=20)
        except requests.RequestException as e:
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"request failed after {attempts} attempts: {last}")


# Track ids are namespaced by source ("deezer:NNN" / "itunes:NNN") so the
# analyze step looks each one up from the source that produced it. Deezer is
# preferred (richer metadata + ISRC) but blocks many datacenter IPs (e.g.
# Hugging Face), so iTunes is the fallback — the spec's designated backup,
# also free + no-auth, and reachable where Deezer isn't.

def _deezer_summary(t: dict) -> dict:
    return {
        "id": f"deezer:{t['id']}",
        "title": t["title"],
        "artist": t["artist"]["name"],
        "album": t.get("album", {}).get("title"),
        "cover": t.get("album", {}).get("cover_xl") or t.get("album", {}).get("cover_big"),
        "duration": t["duration"],
        "preview": t.get("preview"),
        "isrc": t.get("isrc"),
    }


def _itunes_summary(r: dict) -> dict:
    # bump the 100px thumbnail to a real cover for the accent extraction
    art = r.get("artworkUrl100") or r.get("artworkUrl60") or ""
    cover = re.sub(r"/\d+x\d+bb", "/1000x1000bb", art) if art else None
    return {
        "id": f"itunes:{r['trackId']}",
        "title": r.get("trackName"),
        "artist": r.get("artistName"),
        "album": r.get("collectionName"),
        "cover": cover,
        "duration": round(r.get("trackTimeMillis", 0) / 1000),
        "preview": r.get("previewUrl"),
        "isrc": None,  # iTunes search doesn't expose ISRC
    }


def _deezer_search(query: str, limit: int) -> list[dict]:
    r = _get("https://api.deezer.com/search", {"q": query, "limit": limit})
    r.raise_for_status()
    data = r.json()
    if isinstance(data, dict) and data.get("error"):
        raise RuntimeError(f"Deezer error: {data['error']}")
    return [_deezer_summary(t) for t in data.get("data", []) if t.get("preview")]


def _itunes_search(query: str, limit: int) -> list[dict]:
    r = _get("https://itunes.apple.com/search",
             {"term": query, "entity": "song", "limit": limit})
    r.raise_for_status()
    return [_itunes_summary(t) for t in r.json().get("results", []) if t.get("previewUrl")]


def search_tracks(query: str, limit: int = 8) -> list[dict]:
    try:
        tracks = _deezer_search(query, limit)
        if tracks:
            return tracks
    except Exception:
        pass  # Deezer blocked/empty — fall back to iTunes
    return _itunes_search(query, limit)


def get_track(track_id: str) -> dict:
    source, _, raw = str(track_id).partition(":")
    if source == "itunes":
        r = _get("https://itunes.apple.com/lookup", {"id": raw})
        r.raise_for_status()
        results = r.json().get("results", [])
        if not results or not results[0].get("previewUrl"):
            raise RuntimeError("No preview available for this track")
        return _itunes_summary(results[0])
    # default to Deezer (covers "deezer:NNN" and bare legacy numeric ids)
    did = raw if source == "deezer" else source
    r = _get(f"https://api.deezer.com/track/{did}")
    r.raise_for_status()
    t = r.json()
    if t.get("error"):
        raise RuntimeError(f"Deezer track {did}: {t['error'].get('message')}")
    if not t.get("preview"):
        raise RuntimeError("No preview available for this track")
    return _deezer_summary(t)


def fetch_lyrics(artist: str, title: str, duration: int) -> dict | None:
    r = _get("https://lrclib.net/api/get",
             {"artist_name": artist, "track_name": title, "duration": duration})
    if r.status_code == 200:
        return r.json()
    r = _get("https://lrclib.net/api/search",
             {"artist_name": artist, "track_name": title})
    if r.status_code == 200:
        for hit in r.json():
            if abs(hit.get("duration", 0) - duration) <= 2:
                return hit
    return None


# the client supplies the preview URL, so only fetch from known preview CDNs
# (prevents the server being used to fetch arbitrary URLs)
_ALLOWED_PREVIEW_HOSTS = ("dzcdn.net", "deezer.com", "mzstatic.com", "apple.com")


def is_allowed_preview(url: str) -> bool:
    try:
        host = urlparse(url).hostname or ""
    except ValueError:
        return False
    return url.startswith("https://") and any(
        host == h or host.endswith("." + h) for h in _ALLOWED_PREVIEW_HOSTS
    )


def download_preview(url: str, key: str) -> Path:
    AUDIO_CACHE.mkdir(parents=True, exist_ok=True)
    # Deezer serves mp3, iTunes serves m4a/aac — keep the real extension so
    # audioread/ffmpeg picks the right decoder
    ext = ".m4a" if ".m4a" in url.lower() else ".mp3"
    path = AUDIO_CACHE / f"{key}{ext}"
    if not path.exists():
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
        r.raise_for_status()
        path.write_bytes(r.content)
    return path


# ------------------------------------------------------------ audio features

KRUMHANSL_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KRUMHANSL_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
PITCHES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def _estimate_key(chroma_mean: np.ndarray) -> tuple[str, float]:
    best = ("?", -2.0)
    for i in range(12):
        rolled = np.roll(chroma_mean, -i)
        for profile, mode in ((KRUMHANSL_MAJOR, "major"), (KRUMHANSL_MINOR, "minor")):
            score = float(np.corrcoef(rolled, profile)[0, 1])
            if score > best[1]:
                best = (f"{PITCHES[i]} {mode}", score)
    return best


def extract_features(mp3_path: Path) -> dict:
    # 16 kHz is plenty for tempo/key/energy/brightness and roughly halves the
    # audio array vs 22.05 kHz — the free-tier (512 MB) host OOMs otherwise.
    y, sr = librosa.load(mp3_path, sr=16000, mono=True)
    clip_dur = len(y) / sr
    hop = 512

    # one magnitude spectrogram, reused for chroma + brightness, so we don't
    # pay for three separate transforms (the old chroma_cqt was the worst
    # offender — Constant-Q is very memory/CPU heavy)
    spec = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))

    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop)
    tempo = float(np.atleast_1d(tempo)[0])

    chroma = librosa.feature.chroma_stft(S=spec**2, sr=sr)
    key, key_conf = _estimate_key(chroma.mean(axis=1))

    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
    win = max(1, len(rms) // 60)
    smooth = np.convolve(rms, np.ones(win) / win, mode="same")
    lo, hi = smooth.min(), smooth.max()
    norm = (smooth - lo) / (hi - lo) if hi > lo else smooth * 0

    # 15-point summary for the LLM
    idx = np.linspace(0, len(norm) - 1, 15).astype(int)
    energy_curve = [(round(float(times[i]), 1), round(float(norm[i]), 2)) for i in idx]

    # full-resolution bars for the waveform hero (mean per bucket, floor for visibility)
    buckets = np.array_split(norm, WAVEFORM_BARS)
    waveform = [round(max(0.04, float(b.mean())), 3) for b in buckets]

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

    centroid = librosa.feature.spectral_centroid(S=spec, sr=sr)[0]
    onsets = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop, units="time")
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
        "waveform": waveform,
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
    llm_features = {k: v for k, v in features.items() if k != "waveform"}
    return PROMPT_TEMPLATE.format(
        title=title, artist=artist,
        features=json.dumps(llm_features, indent=2),
        lyrics=lyr_text, synced_note=synced_note,
    )


def call_llm(prompt: str) -> str:
    if os.environ.get("ANTHROPIC_API_KEY"):
        import anthropic
        client = anthropic.Anthropic()
        msg = client.messages.create(
            model=MODEL, max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text
    # dev fallback: local claude CLI, no API key needed; one retry — the CLI
    # occasionally fails transiently and the user has been waiting a minute
    last_err = ""
    for _ in range(2):
        proc = subprocess.run(
            ["claude", "-p", "--model", "opus"],
            input=prompt, capture_output=True, text=True, timeout=600,
        )
        if proc.returncode == 0:
            return proc.stdout
        last_err = (
            f"claude CLI failed (rc {proc.returncode}): "
            f"stderr={proc.stderr[:300]!r} stdout={proc.stdout[:300]!r}"
        )
        time.sleep(2)
    raise RuntimeError(last_err)


def parse_explanation(text: str) -> dict | None:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    blob = m.group(0)
    try:
        return json.loads(blob)
    except json.JSONDecodeError:
        try:
            return json.loads(re.sub(r'(?<=[^"{\[,:\s])\n(?=\s*[^"\s])', r"\\n",
                                     blob.replace("\r", "")))
        except json.JSONDecodeError:
            return None


# ----------------------------------------------------------------- pipeline

def analyze_track(track: dict) -> dict:
    """Full pipeline for one Deezer track summary -> result dict for the UI."""
    lyrics = fetch_lyrics(track["artist"], track["title"], track["duration"])
    audio_key = hashlib.sha256(
        f"{track['artist']}|{track['title']}|{track['duration']}".lower().encode()
    ).hexdigest()[:20]
    mp3 = download_preview(track["preview"], audio_key)
    with _FEATURE_LOCK:
        features = extract_features(mp3)

    raw = call_llm(build_prompt(track["artist"], track["title"], features, lyrics))
    explanation = parse_explanation(raw)
    if explanation is None:
        raise RuntimeError("LLM returned unparseable explanation")

    return {
        "track": track,
        "features": {k: v for k, v in features.items() if k != "waveform"},
        "waveform": features["waveform"],
        "lyrics": {
            "plain": lyrics.get("plainLyrics") if lyrics else None,
            "synced": lyrics.get("syncedLyrics") if lyrics else None,
        },
        "explanation": explanation,
    }
