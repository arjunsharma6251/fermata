"""Offline cache seeding: pre-compute analyses for the songs launch traffic
will actually request (Billboard Hot 100 + Spotify Global 200 via kworb),
writing them to backend/seed/ — committed to the repo, shipped in the Docker
image, immune to the ephemeral HF disk.

Run from backend/:  ../.venv/bin/python scripts/seed_charts.py [--limit N]

Resumable: songs whose seed file already exists are skipped, failures are
logged and skipped on retry runs. Seed files carry NO lyrics (the HF Space
repo is public); the server re-fetches lyrics on first hit.
"""

import argparse
import copy
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cache  # noqa: E402
import engine  # noqa: E402
import requests  # noqa: E402

HOT100_URL = "https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/recent.json"
KWORB_URL = "https://kworb.net/spotify/country/global_daily.html"
FAIL_LOG = Path(__file__).with_name("seed_failures.log")

_JUNK = re.compile(r"karaoke|tribute|originally performed|cover version|8[- ]bit", re.I)


def first_artist(a: str) -> str:
    return re.split(r"\s+featuring\s+|\s+feat\.?\s+|\s+&\s+|\s+x\s+|,|\s+with\s+", a, flags=re.I)[0].strip()


def chart_songs() -> list[tuple[str, str]]:
    songs: list[tuple[str, str]] = []
    hot = requests.get(HOT100_URL, timeout=30).json()["data"]
    songs += [(e["song"], e["artist"]) for e in hot]

    html = requests.get(KWORB_URL, timeout=30).text
    rows = re.findall(
        r'<td class="text mp"><div><a href="\.\./artist/[^"]*">([^<]+)</a> - '
        r'<a href="\.\./track/[^"]*">([^<]+)</a>',
        html,
    )
    songs += [(title, artist) for artist, title in rows[:200]]

    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for title, artist in songs:
        k = f"{cache._norm(title)}|{cache._norm(first_artist(artist))}"
        if k not in seen:
            seen.add(k)
            out.append((title, artist))
    return out


def pick_track(title: str, artist: str) -> dict | None:
    fa = first_artist(artist)
    results = engine.search_tracks(f"{title} {fa}")
    results = [t for t in results if t.get("preview") and not _JUNK.search(f"{t['title']} {t['artist']} {t.get('album') or ''}")]
    if not results:
        return None
    # prefer a result whose artist actually contains the charted artist
    fa_norm = cache._norm(fa)
    for t in results:
        if fa_norm and fa_norm in cache._norm(t["artist"]):
            return t
    return results[0]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()

    songs = chart_songs()
    if args.limit:
        songs = songs[: args.limit]
    failed_before = set(FAIL_LOG.read_text().splitlines()) if FAIL_LOG.exists() else set()

    print(f"{len(songs)} unique chart songs · {args.workers} workers", flush=True)
    counts = {"done": 0, "skipped": 0, "failed": 0}
    lock = threading.Lock()

    def work(item: tuple[int, tuple[str, str]]) -> None:
        i, (title, artist) = item
        tag = f"[{i}/{len(songs)}] {title} — {artist}"
        if f"{title}|{artist}" in failed_before:
            with lock:
                counts["failed"] += 1
                print(f"{tag}: failed previously, skipping", flush=True)
            return
        try:
            track = pick_track(title, artist)
            if track is None:
                raise RuntimeError("no previewable match")
            key = cache.cache_key(track["artist"], track["title"], track["duration"])
            if cache.seed_path(key).is_file():
                with lock:
                    counts["skipped"] += 1
                    print(f"{tag}: already seeded", flush=True)
                return
            t0 = time.time()
            result = engine.analyze_track(track)
            seed = copy.deepcopy(result)
            seed["lyrics"] = {"plain": None, "synced": None}
            cache.put_seed(key, seed)
            with lock:
                counts["done"] += 1
                print(f"{tag}: seeded in {time.time() - t0:.0f}s", flush=True)
        except Exception as e:
            with lock:
                counts["failed"] += 1
                with FAIL_LOG.open("a") as f:
                    f.write(f"{title}|{artist}\n")
                print(f"{tag}: FAILED — {e}", flush=True)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(work, enumerate(songs, 1)))

    print(
        f"\nseeded {counts['done']}, already had {counts['skipped']}, failed {counts['failed']}",
        flush=True,
    )


if __name__ == "__main__":
    main()
