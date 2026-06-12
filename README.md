# fermata.

Takes a song you're obsessed with and explains the craft behind why it hits you.
See `CLAUDE.md` for the full product spec.

## Status

- **Phase 0 — done.** Explanation engine validated on 5 songs (`phase0.py`,
  results in `phase0_results.txt` after a run). Prompt lives in
  `backend/engine.py` and is the product — change it deliberately.
- **Phase 1 — done.** Functional, unstyled pipeline: search → Deezer →
  LRCLIB → librosa → LLM → result on screen, with a SQLite analysis cache.
- **Phase 2 — next.** The design language, waveform hero, motion, playback
  with synced lyrics (spec Part 3).

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

## Phase 0 harness

```sh
.venv/bin/python phase0.py "Artist" "Title"   # one song
.venv/bin/python phase0.py --all              # the 5-song validation set
```
