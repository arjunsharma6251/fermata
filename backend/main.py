"""Fermata API — Phase 1: functional, stateless, one song at a time.

Run:  uvicorn main:app --reload --port 8000  (from backend/)
"""

import os

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

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
    allow_methods=["GET"],
    allow_headers=["*"],
)


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


@app.get("/api/analyze/{track_id}")
async def analyze(track_id: str):
    # track_id is namespaced, e.g. "deezer:123" / "itunes:456"
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
