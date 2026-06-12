"""Fermata API — Phase 1: functional, stateless, one song at a time.

Run:  uvicorn main:app --reload --port 8000  (from backend/)
"""

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

import cache
import engine

app = FastAPI(title="fermata")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5180", "http://127.0.0.1:5180"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/search")
async def search(q: str):
    if not q.strip():
        raise HTTPException(400, "empty query")
    try:
        return {"results": await run_in_threadpool(engine.search_tracks, q)}
    except Exception as e:
        raise HTTPException(502, f"search failed: {e}")


@app.get("/api/analyze/{track_id}")
async def analyze(track_id: int):
    try:
        track = await run_in_threadpool(engine.get_track, track_id)
    except Exception as e:
        raise HTTPException(404, f"track lookup failed: {e}")

    key = cache.cache_key(track["artist"], track["title"], track["duration"])
    cached = cache.get(key)
    if cached:
        # preview/cover URLs expire (Deezer signs them) — always serve the
        # cached analysis with FRESH track metadata
        return {**cached, "track": track, "cached": True}

    try:
        result = await run_in_threadpool(engine.analyze_track, track)
    except Exception as e:
        raise HTTPException(502, f"analysis failed: {e}")

    cache.put(key, result)
    return {**result, "cached": False}
