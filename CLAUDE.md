# CLAUDE.md — Fermata

> A tool that takes a song you're obsessed with and explains the craft behind why it hits you. The name is the gesture: a *fermata* tells a musician to hold a note longer than written — to dwell on a moment. That's what this does. It stops the song on the moment that moves you and holds it there so you can see why.

---

## PART 1 — WHAT WE'RE BUILDING

A consumer web tool. Input: a song. Output: a beautiful, specific explanation of the mechanical craft — structure, harmony, production, AND lyrics — that makes it land emotionally. The user is a passionate listener with no music-theory vocabulary. The output should make them go "oh, THAT'S why."

This serves curiosity, not a workflow. The bar: would someone who loves a song find the explanation genuinely insightful, or does it read like generic music-theory filler? That distinction is the entire product.

### The one thing that matters most
**The explanation quality is the whole ballgame.** Fetching audio, lyrics, analysis, the UI — all solved plumbing. The only thing that can make this worthless is a shallow or generic explanation. A bad output: "This song uses a IV-V-vi progression to create emotional resonance." (Generic, says nothing about THIS song.) A good output is specific, grounded in what's actually happening in the audio and lyrics, and connects a concrete moment to a felt effect.

### The second thing that matters: it has to be beautiful
Aesthetics are not decoration here — they ARE the product's credibility. A tool that explains why music is beautiful must itself be beautiful. The design and motion are first-class requirements, specified in Part 3. But they get built AFTER the explanation engine is proven (see phases).

---

## PART 2 — ARCHITECTURE & BUILD

### Build sequence (do these IN ORDER — do NOT build front-to-back)

**Phase 0 — Validate the explanation engine (before anything else).** A single Python script/notebook: takes one local 30s audio clip + title + artist + lyrics → extracts librosa features → sends features+metadata+lyrics to an LLM with a carefully designed prompt → prints the explanation. Run on 4–5 well-known songs (mix of music-driven and lyric-driven). Read output critically. If insightful and song-specific, proceed. If generic, iterate the prompt until it isn't. **Do not build the pipeline or UI until this clears the bar.** This is the load-bearing test.

**Phase 1 — Core pipeline, functional and ugly.** Wire: search box → Deezer (audio + cover + metadata) → LRCLIB (lyrics) → librosa → LLM → result on screen. Stateless, one song at a time. No styling yet. Prove the data flows end to end.

**Phase 2 — The beautiful hero experience.** Apply the full design language (Part 3): the layout, the dynamic color, the waveform-as-hero, the motion, audio playback with synced lyrics. This is where aesthetics get built. Spend disproportionate effort here.

**Phase 3 — Spotify playlist sync (optional, later).** Layer Spotify OAuth as an onboarding path so users pull from playlists instead of searching. UX polish, NOT core value. Do not start here.

### Data flow
```
Search a song (Phase 1)  ─┐
  OR pick from playlist (Phase 3) ─┘
        │
        ▼
   Deezer public API ──► track + 30s preview MP3 + album cover URL + duration + ISRC
        │                (fallback: iTunes Search API)
        ├────────────► LRCLIB ──► plain + synced (timestamped) lyrics
        │                         (match by title + artist + duration ±2s)
        ▼
   Download preview MP3 to temp
        │
        ▼
   librosa ──► tempo, key, energy curve, spectral, beats, onsets
        │
        ▼
   LLM ──► craft explanation (audio features + metadata + full lyrics)
        │
        ▼
   React UI ──► dynamic, animated experience (Part 3)
```

### Tech stack (all data sources are 100% free — no keys, no tiers)
- **Backend:** Python (librosa requires it). FastAPI preferred. ffmpeg on system for mp3 decoding.
- **Audio analysis:** librosa + numpy.
- **Audio + art source:** Deezer public REST API — no key, no auth. `https://api.deezer.com/search?q=...` returns `preview` (30s MP3), `album.cover_xl/_big/_medium` (art), `duration`, `isrc`. Fallback: iTunes Search API, also no auth, also returns artwork.
- **Lyrics source:** LRCLIB — no key, no auth, no rate limit, no registration. `https://lrclib.net/api/get?artist_name=...&track_name=...&duration=...` returns `plainLyrics` and `syncedLyrics` (LRC timestamped). Match on title+artist+duration (±2s — use Deezer's duration). Send a `User-Agent` header. Fallback `/api/search`.
- **LLM:** Anthropic API for the explanation layer (user's own key via env var, never hardcode). The one place model quality genuinely matters AND the one real running cost — use a strong model. See "Keeping it free."
- **Frontend:** React. See Part 3 for fonts, motion libs, design.
- **Caching:** required from Phase 1 (cost + speed).
- **No database in v1** beyond a simple cache.

### Keeping it free (cost discipline)
Data layer is free forever (Deezer, iTunes, LRCLIB). Two costs remain:
1. **LLM calls — the only real running cost.** Small (fractions of a cent to low cents/song) but scales with use. **Cache every analysis**, keyed on normalized (artist, title, duration). Same song → return stored result, never pay twice. SQLite or a JSON file is enough for v1. Biggest lever. Do NOT downgrade to a weak local model to save money — the explanation is the product. (Local model via Ollama is a possible future "$0" mode, not v1.)
2. **Hosting — free at demo scale.** Local is free. Public: Vercel (frontend) + Render/Railway/Fly (Python backend) free tiers. Backend needs real audio processing (librosa+ffmpeg), so pick a host allowing a proper Python service, not a thin serverless function.

### What librosa can and cannot do (don't over-promise)
**Reliable — ground the explanation in these:** tempo (BPM); key/mode (chroma-based, a strong guess not gospel); energy/RMS curve over time (backbone of the visualization); spectral features (centroid=brightness, rolloff, contrast); beat & onset positions; where texture/energy shifts *within the clip*.

**Unreliable — do NOT build features depending on these:** labeling sections ("this is the bridge") from audio alone — librosa finds boundaries where something changes but can't name them; let the LLM infer structure from its own knowledge. Vocal/stem separation — out of scope. Chord transcription — unreliable.

### The 30-second constraint (shapes everything)
Deezer (and every legal source) serves only a **30s preview**, not the full song — a hard licensing wall. Do NOT scrape YouTube/yt-dlp for full audio (ToS/copyright; not worth it). So audio analysis is a **hybrid**, and this should be explicit in the UI:
- Part of the song **in the clip**: librosa gives real, measured data — grounded in fact.
- Parts **outside the clip**: the LLM reasons from its own knowledge of the song's structure — inference, not measurement.
- **Lyrics are NOT clip-limited** — LRCLIB gives the full lyric, so lyrical analysis covers the whole song. Use this strength.

### Lyrics handling
Fetch from LRCLIB using Deezer's duration for an accurate match. Prefer `syncedLyrics` (timestamped) — it lets you align lyrics to the energy curve AND drive the synced-lyric playback (Part 3). Fall back to `plainLyrics`. Handle instrumental / no-lyrics tracks gracefully (still analyze audio). Feed lyrics to the LLM; weight lyric vs. music per song.

### The explanation layer (the core — design the prompt carefully)
Inputs: title+artist; librosa feature summary (tempo, key, energy curve as timestamped moments, brightness, shifts within clip); lyrics (plain + synced).
Prompt principles:
- Demand **specificity to THIS song.** Every claim references a concrete moment, choice, lyric, or feature. Reject generic theory.
- Connect a **mechanical cause** to an **emotional effect** ("drums drop out before the hook, so the slam-back feels like release"; "the rhyme breaks on the last line, mirroring the loss").
- Cover music AND lyric; weight per song.
- Plain language, no unexplained jargon.
- Be honest about measured-vs-inferred (clip data vs. full-song structure).
- Tight and readable — for a curious listener, not a musicology paper.
- Return **structured JSON** so the UI can map pieces to visual/temporal elements: an overall read, plus `[{ timestamp, moment, what_happens, why_it_hits }]` that annotate the timeline and the playhead.

### Edge cases (handle from day one)
No preview available (try fallback, clear message). No lyrics / instrumental (degrade to audio-only). Bad match — wrong version (live/remix/cover) — use ISRC (Deezer) + duration (LRCLIB) to tighten; show what was matched so the user can correct. Obscure songs — LLM knowledge thins; for v1 lean toward well-known songs.

### Scope boundaries for v1 (do NOT build)
No accounts/login (until optional Phase 3). No DB beyond the cache. No batch — one song at a time. No stem separation. No auto section-labeling from audio. No full-song audio. No social/sharing. Don't gold-plate backend infra — insight + beauty are the product, not pipeline scale.

---

## PART 3 — DESIGN & MOTION (first-class requirements)

The aesthetic is **"forensic editorial"**: clinical precision (a lab readout) revealing warm emotion (why it makes you feel). Cold method, warm result. That tension IS the product, expressed visually. The reference standard is Apple Music's now-playing / a fashion editorial / Swiss print — NOT a typical dashboard or a purple-gradient music app.

### Identity
- **Name:** Fermata. Wordmark set lowercase (`fermata.`) — the period takes the dynamic accent color. The fermata glyph (an arc over a dot) can serve as the app icon.
- **Tone:** crafted, restrained, confident. Quiet until the moment that matters.

### Color system — structure constant, accent dynamic
This is the signature mechanic. Get it right.
- **Constant structure (never changes):** a warm off-white canvas (e.g. `#FAF8F5`), ink-black text (e.g. warm near-black `#16130F`), muted grey for secondary text and the neutral waveform. This holds the editorial feel across every song.
- **Dynamic accent (changes per song):** extract the dominant *vibrant* color from the album cover and use it as the ONLY accent — the waveform's emotional peak, the moment marker, the wordmark period, the playhead. Each song wears its own color. This is the Apple Music / Spotify now-playing pattern; it makes every song feel like its own object and reinforces "THIS song, and why it hits YOU."
- **Extraction:** use `node-vibrant` or `color-thief` (free, client-side off the cover image).
- **CRITICAL guardrail — contrast clamp.** Album art throws up beige, near-white, neon. Never use the raw extracted color. After extraction, force its luminance to a floor (and a ceiling) so it ALWAYS reads legibly on the off-white canvas and as text. This single step separates "designed" from "random." Skipping it is the most common way this look fails.
- **Fallback:** if there's no art or extraction fails, default the accent to a considered signal red (e.g. `#D6273C`).
- **Discipline:** the accent is rare. It appears on the peak, the marker, the playhead, the wordmark dot — and almost nowhere else. Because it's rare, it reads as MEANING ("here's where it hits"), not decoration. Do not flood the UI with it. No accent-colored backgrounds.

### Typography (use free fonts; the pairing carries the taste)
- **Display serif** (song title, wordmark, editorial moments): a high-contrast, characterful serif — recommend **Fraunces** (variable, free, Google Fonts) or Newsreader/Instrument Serif. This is the "human/emotional" voice.
- **Monospace** (data chips — BPM, key, timestamps, "the moment" labels): **JetBrains Mono** or IBM Plex Mono. This is the "clinical/lab-readout" voice. The serif↔mono contrast is the whole forensic-editorial thesis rendered as type.
- **Body sans** (the explanation prose): **Inter** or Geist — clean, readable, generous line-height (~1.7).
- Sentence case throughout. Generous whitespace. Restraint over density.

### Layout
Single column, centered, generous margins, lots of negative space. Vertical rhythm:
1. Header: `fermata.` wordmark (left) + current song / search (right).
2. Title block: **album art square** (contained, ~64–72px, thin border, rounded, NO drop shadow) beside the song title (display serif) + artist.
3. Data chips row (monospace): BPM, key, "hybrid · clip + arc".
4. **The hero: the waveform** (full width, centered) — see below.
5. The explanation prose, then the accented "the moment" callout (mono label + a sentence; left-border in the accent color, square corners).

### The hero — the waveform
A centered, symmetric soundwave (mirrored bars around a center axis) is the iconic "soundwave" look the user wants. Most bars are neutral grey; the **emotional peak / key moment is rendered in the song's accent color.** A subtle vertical marker + monospace label annotates the key moment (e.g. "beat switch · 2:18").
- **Honest caution:** the mockup waveform is hand-shaped to look clean. The REAL waveform comes from librosa's actual energy/RMS curve, which is messier. Budget real effort into making *real* data look composed — smoothing/normalizing the envelope, sensible bar count, tasteful min/max heights. A lot of "looked great in the mockup" projects die on this gap. Make real data beautiful, not just the ideal case.

### MOTION — make it feel alive (the user explicitly wants this; treat as core)
Motion is purposeful, not gratuitous. Every animation should express the product's idea: revealing, holding, marking the moment. Principles: ease-out curves, fast but not abrupt (~200–600ms), stagger for life, nothing bouncy/gimmicky. **Always respect `prefers-reduced-motion`** — provide instant non-animated states (this is both accessibility and taste). Recommended lib: **Motion (Framer Motion)** for React; GSAP optional for the waveform draw.

Specific moments to animate:
1. **Search → analysis transition.** When a song is submitted, show an "analyzing" state that feels diagnostic — a scanning shimmer sweeping across a skeleton waveform, mono status text ("reading the audio… finding the moment…"). Makes the wait feel like forensic work, not a spinner.
2. **Waveform draw-in.** On load, bars rise/stagger from the center axis left-to-right (or the energy curve draws in). This is the signature entrance — make it feel like the song materializing.
3. **The color bloom.** After the wave settles in neutral, the accent color (extracted from the cover) BLOOMS into the peak bars + marker — visibly "the song choosing its color." Tie it to the album art so the color reads as flowing from the cover into the analysis.
4. **Explanation reveal.** Prose and the "moment" callout fade/rise in after the wave, gentle stagger, so the eye goes wave → words.
5. **Audio playback + synced lyrics (big dynamic win — build this).** The 30s preview is playable. A **playhead sweeps the waveform** in time with the audio; bars under/passed by the playhead subtly light; the **synced lyrics highlight line-by-line** as they play (from LRCLIB timestamps); when playback reaches an annotated moment, that annotation gently surfaces. This single feature ties audio + lyrics + motion + the accent color into one living object and is the centerpiece of "dynamic and beautiful."
6. **Waveform hover/scrub.** Hovering a region highlights it and surfaces what's happening there (from the structured explanation); scrubbing moves the playhead.
7. **Micro-interactions.** Buttons, chips, the search field — subtle hover/press states, consistent easing. Small, everywhere, never loud.

### Design DON'Ts
No gradients/mesh/glow/neon. No drop shadows on the album art or cards (flat, thin borders). No accent-colored background fields. No more than the one dynamic accent + neutral + ink. No bouncy/gimmicky motion. Don't theme the whole UI to the album color — only the accent. Don't let real librosa data render as an ugly jagged mess — compose it.

---

## PRIORITIES (in order)
1. Phase 0 first — prove the explanation is good before building anything.
2. The explanation quality is the entire product. Protect it.
3. Beauty is the second product. The design + motion in Part 3 are requirements, built in Phase 2 after the engine is proven.
4. Ground claims in real librosa data + full lyrics; be honest about audio inference beyond the clip.
5. Dynamic accent from album art — with the contrast clamp. Structure stays constant.
6. The playhead + synced-lyrics playback is the centerpiece of "dynamic."
7. Cache every analysis. Keep v1 stateless, single-song, free.

---

## PART 4 — WHAT'S BUILT & SHIPPED (post-v1, keep current)

> Added after the original spec. Phases 0–3 are done and the app is **live at https://www.hearfermata.com**. This section is the source of truth for the deployed architecture and features beyond v1.

### Deployed architecture
- **Frontend:** Vercel, custom domain `www.hearfermata.com` (apex 308→www). Auto-deploys on push to `main`. Backend URL is hardcoded in `frontend/src/api.ts` for production (don't set `VITE_API_BASE` in Vercel — it overrides the hardcode).
- **Backend:** Hugging Face Space (Docker, 16 GB) at `https://arjunsh6251-fermata.hf.space` (HF username is `arjunsh6251`). Render's 512 MB free tier OOM-killed librosa, so we moved to HF. Auto-deploys via `.github/workflows/hf-sync.yml`. Runtime secrets (`ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS`, `FERMATA_MODEL=claude-opus-4-8`) live in the HF Space settings.
- **Search is browser-side (Deezer JSONP):** Deezer blocks datacenter IPs (HF) and sends no CORS, so the browser queries Deezer via JSONP (residential IP, full catalog — iTunes search misses tracks like Frank Ocean's "Ivy"). The chosen track (incl. preview URL) is POSTed to `/api/analyze`; the backend only downloads the preview from Deezer's CDN (not IP-blocked). iTunes is the fallback when JSONP fails. SSRF guard: backend only fetches previews from deezer/apple hosts.
- **Keep-warm:** `.github/workflows/keep-warm.yml` pings `/api/health` every 10 min (HF Spaces sleep ~48h idle).

### Features beyond v1 (built, live)
- **Song suggestions:** the analysis LLM call also returns `suggestions: [{title, artist, why}]` — 3 craft-linked songs, `why` names the shared mechanical move. Rendered as cards (with album art prefetched via Deezer) at the bottom of the result; clicking analyzes that song (discovery loop). Keep these CRAFT-specific, never "same vibe/genre/artist".
- **Shareable moment cards:** "share the moment" exports a composed editorial poster PNG (`ShareCard`/`ShareModal`, via `html-to-image`) — album art, accent, waveform peak, the moment's `why_it_hits`. Pick which moment to feature. Native share on mobile. This is the growth/distribution surface.
- **The craft map:** "explore the craft map" opens a force-directed graph (`CraftMap`, d3-force) — songs are nodes, edges are shared craft moves. Center = current song; click a node to reveal ITS links (cheap, cached `POST /api/suggest` — no audio/lyrics), growing the web; click "analyze" on a node to dive into its full read. The discovery loop made navigable.

### Gotchas to remember
- `max_tokens` for the analysis LLM call is 4096 — the suggestions made the JSON longer and 2048 truncated it (→ "unparseable explanation"). Don't lower it.
- LLM model is `claude-opus-4-8` (claude-fable-5 is NOT available via the API). Suggestions reuse the same `call_llm`.
- HF analysis cache (SQLite + audio) is on ephemeral disk — resets on every rebuild.

### Next-step ideas (not built)
"Your craft fingerprint" (analyze a playlist → the craft patterns a listener gravitates to, via the existing Spotify auth); conversational follow-up on a moment; full-song analysis via user upload (removes the 30s-clip caveat); creator mode ("how would I make something feel like this?").
