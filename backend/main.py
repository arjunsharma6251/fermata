"""Fermata API — Phase 1: functional, stateless, one song at a time.

Run:  uvicorn main:app --reload --port 8000  (from backend/)
"""

import os

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import cache
import engine

app = FastAPI(title="fermata")

# comma-separated origins; production sets ALLOWED_ORIGINS to the deployed
# frontend URL
_origins = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:5180,http://127.0.0.1:5180"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class SuggestIn(BaseModel):
    title: str
    artist: str


class TrackIn(BaseModel):
    """A track the client picked (from Deezer JSONP or the iTunes fallback).
    The client supplies the preview URL so the backend never calls Deezer's
    API itself."""

    id: str
    title: str
    artist: str
    album: str | None = None
    cover: str | None = None
    duration: int
    preview: str
    isrc: str | None = None


@app.get("/")
async def root():
    # friendly landing + a 200 for any platform that health-probes the root
    return {"service": "fermata", "ok": True, "docs": "/docs"}


@app.get("/api/health")
async def health():
    # cheap liveness ping — no external calls; used by the keep-warm cron to
    # stop Render's free tier from spinning down between visitors
    return {"ok": True}


@app.get("/api/search")
async def search(q: str):
    if not q.strip():
        raise HTTPException(400, "empty query")
    try:
        return {"results": await run_in_threadpool(engine.search_tracks, q)}
    except Exception as e:
        raise HTTPException(502, f"search failed: {e}")


@app.post("/api/suggest")
async def suggest(s: SuggestIn):
    # craft-linked suggestions for the map — cheap + cached, no audio
    key = cache.suggest_key(s.artist, s.title)
    cached = cache.get_suggest(key)
    if cached is not None:
        return {"suggestions": cached, "cached": True}
    try:
        result = await run_in_threadpool(engine.suggest_songs, s.title, s.artist)
    except Exception as e:
        raise HTTPException(502, f"suggest failed: {e}")
    cache.put_suggest(key, result)
    return {"suggestions": result, "cached": False}


@app.post("/api/analyze")
async def analyze(track_in: TrackIn):
    track = track_in.model_dump()
    if not engine.is_allowed_preview(track["preview"]):
        raise HTTPException(400, "preview URL not from an allowed source")

    key = cache.cache_key(track["artist"], track["title"], track["duration"])
    cached = cache.get(key)
    if cached:
        # preview/cover URLs expire (signed) — serve cached analysis with the
        # FRESH track metadata the client just supplied
        return {**cached, "track": track, "cached": True}

    seeded = cache.get_seed(key)
    if seeded is not None:
        # bundled analyses ship without lyrics (the Space repo is public) —
        # fetch them now, then persist to the runtime cache so the next hit
        # skips this too
        lyr = await run_in_threadpool(
            engine.fetch_lyrics, track["artist"], track["title"], track["duration"]
        )
        seeded["lyrics"] = {
            "plain": lyr.get("plainLyrics") if lyr else None,
            "synced": lyr.get("syncedLyrics") if lyr else None,
        }
        cache.put(key, seeded)
        return {**seeded, "track": track, "cached": True}

    try:
        result = await run_in_threadpool(engine.analyze_track, track)
    except Exception as e:
        raise HTTPException(502, f"analysis failed: {e}")

    cache.put(key, result)
    return {**result, "cached": False}
