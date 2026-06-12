# fermata.

Takes a song you're obsessed with and explains the craft behind why it hits you.
See `CLAUDE.md` for the full product spec.

## Status

- **Phase 0 — done.** Explanation engine validated on 5 songs (`phase0.py`,
  results in `phase0_results.txt` after a run). Prompt lives in
  `backend/engine.py` and is the product — change it deliberately.
- **Phase 1 — done.** Functional pipeline: search → Deezer → LRCLIB →
  librosa → LLM → result on screen, with a SQLite analysis cache.
- **Phase 2 — done.** Forensic-editorial design (spec Part 3): waveform
  hero from real RMS data, per-song accent extracted from album art with a
  contrast clamp, draw-in/bloom/reveal motion, analyzing state, preview
  playback with sweeping playhead, scrubbing, and moment annotations.
  Note: per-line karaoke lyric sync was cut deliberately — the clip's
  position within the full song is unknowable from the data (measured and
  confirmed), so lyric-based moments link into the full lyric column
  instead. Don't resurrect fake sync.
- **Phase 3 — built, needs your Spotify app.** "Browse your spotify
  playlists" appears on the home page once `VITE_SPOTIFY_CLIENT_ID` is set
  (see `frontend/.env.example`). Auth is client-side PKCE — no secret.
  Picked tracks are matched to Deezer by title/artist/duration and run
  through the normal pipeline.

## Run it

Backend (Python 3.12, deps in `requirements.txt`, venv at `.venv/`):

```sh
cd backend
../.venv/bin/uvicorn main:app --reload --port 8000
```

Frontend (Vite + React + TS, pinned to port 5180):

```sh
cd frontend
npm install
npm run dev      # http://localhost:5180
```

LLM: set `ANTHROPIC_API_KEY` to use the API directly; without it the backend
falls back to the local `claude` CLI (dev only). Model override: `FERMATA_MODEL`.

## Deploy (free tiers)

1. **Backend → Render.** "New → Blueprint" on this repo; `render.yaml` does
   the rest. Set `ANTHROPIC_API_KEY` (required — the local `claude` CLI
   fallback doesn't exist on a server) and `ALLOWED_ORIGINS` (your frontend
   URL) in the dashboard. Note: the free-tier disk is ephemeral, so the
   analysis cache resets on redeploys.
2. **Frontend → Vercel.** Import the repo, set the root directory to
   `frontend/` (Vite is auto-detected). Env vars: `VITE_API_BASE` = the
   Render URL, and optionally `VITE_SPOTIFY_CLIENT_ID` (add the deployed
   origin + `/` to the Spotify app's Redirect URIs).

## Phase 0 harness

```sh
.venv/bin/python phase0.py "Artist" "Title"   # one song
.venv/bin/python phase0.py --all              # the 5-song validation set
```
