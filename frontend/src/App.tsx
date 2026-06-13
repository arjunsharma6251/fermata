// fermata — Phase 2 shell. States: idle (cover-page hero) -> results ->
// analyzing (forensic wait) -> result. The accent extracts from the picked
// track's cover DURING analysis, so the bloom is ready when the wave is.

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { Analysis, Track } from "./api";
import { analyzeTrack, searchTracks } from "./api";
import { FALLBACK_ACCENT, extractAccent, setAccent } from "./theme";
import { Analyzing } from "./components/Analyzing";
import { ResultView } from "./components/ResultView";
import { formatTime } from "./lrc";
import type { SpotifyPlaylist, SpotifyTrack } from "./spotify";
import {
  beginAuth,
  getToken,
  handleCallback,
  listPlaylists,
  listPlaylistTracks,
  spotifyEnabled,
} from "./spotify";

type Phase =
  | { name: "idle" }
  | { name: "results"; tracks: Track[] }
  | { name: "analyzing"; track: Track }
  | { name: "result"; analysis: Analysis; tracks: Track[] }
  | { name: "playlists"; playlists: SpotifyPlaylist[] }
  | { name: "playlistTracks"; playlist: SpotifyPlaylist; tracks: SpotifyTrack[] };

function Wordmark({ size }: { size: number }) {
  return (
    <span
      style={{
        fontFamily: "var(--serif)",
        fontWeight: 620,
        fontSize: size,
        letterSpacing: "-0.015em",
        lineHeight: 1,
      }}
    >
      fermata<span style={{ color: "var(--accent)" }}>.</span>
    </span>
  );
}

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastTracks, setLastTracks] = useState<Track[]>([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onSearch = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!query.trim()) return;
      setError(null);
      try {
        const tracks = await searchTracks(query);
        setLastTracks(tracks);
        if (tracks.length === 0) setError("nothing found — try adding the artist's name");
        setPhase({ name: "results", tracks });
      } catch {
        setError("search failed — couldn't reach the backend");
      }
    },
    [query]
  );

  const onPick = useCallback(
    async (track: Track) => {
      setError(null);
      setPhase({ name: "analyzing", track });
      // extract + clamp the song's color while the analysis runs
      const accentPromise = extractAccent(track.cover);
      try {
        const [analysis, accent] = await Promise.all([analyzeTrack(track.id), accentPromise]);
        setAccent(accent);
        setPhase((p) =>
          p.name === "analyzing" ? { name: "result", analysis, tracks: [] } : p
        );
      } catch (err) {
        setAccent(FALLBACK_ACCENT);
        setError(err instanceof Error ? err.message : "analysis failed");
        // land back on the results list so another version is one click away
        setPhase(
          lastTracks.length > 0 ? { name: "results", tracks: lastTracks } : { name: "idle" }
        );
      }
    },
    [lastTracks]
  );

  // reset accent when leaving a song
  useEffect(() => {
    if (phase.name === "idle" || phase.name === "results") setAccent(FALLBACK_ACCENT);
  }, [phase.name]);

  const openPlaylists = useCallback(async () => {
    setError(null);
    const token = getToken();
    if (!token) {
      await beginAuth(); // redirects away
      return;
    }
    try {
      setPhase({ name: "playlists", playlists: await listPlaylists(token) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't load playlists");
    }
  }, []);

  // returning from Spotify's consent page — or resuming the auth hop from
  // localhost onto 127.0.0.1 (see beginAuth)
  useEffect(() => {
    const resume = new URLSearchParams(window.location.search).get("spotify") === "connect";
    void handleCallback().then((fresh) => {
      if (fresh) {
        void openPlaylists();
      } else if (resume) {
        window.history.replaceState({}, "", window.location.pathname);
        void beginAuth();
      }
    });
  }, [openPlaylists]);

  const openPlaylist = useCallback(async (playlist: SpotifyPlaylist) => {
    setError(null);
    const token = getToken();
    if (!token) {
      await beginAuth();
      return;
    }
    try {
      setPhase({
        name: "playlistTracks",
        playlist,
        tracks: await listPlaylistTracks(token, playlist.id),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't load the playlist");
    }
  }, []);

  // a Spotify pick is just an entry point — match it on Deezer, then run
  // the normal pipeline
  const pickSpotifyTrack = useCallback(
    async (st: SpotifyTrack) => {
      setError(null);
      const firstArtist = st.artist.split(",")[0].trim();
      try {
        const candidates = await searchTracks(`${st.title} ${firstArtist}`);
        if (candidates.length === 0) {
          setError(`no previewable match found for "${st.title}" — try the search box`);
          return;
        }
        const best = candidates.reduce((a, b) =>
          Math.abs(a.duration - st.durationS) <= Math.abs(b.duration - st.durationS) ? a : b
        );
        setLastTracks(candidates);
        await onPick(best);
      } catch {
        setError("match failed — is the backend running?");
      }
    },
    [onPick]
  );

  const backToResults = useCallback(() => {
    setPhase(
      lastTracks.length > 0 ? { name: "results", tracks: lastTracks } : { name: "idle" }
    );
  }, [lastTracks]);

  const compactHeader = phase.name !== "idle";

  return (
    <MotionConfig reducedMotion="user">
      {compactHeader && (
        <header className={`topbar${scrolled ? " scrolled" : ""}`}>
          <div className="col-wide topbar-inner">
            <button onClick={() => setPhase({ name: "idle" })} aria-label="fermata home">
              <Wordmark size={27} />
            </button>
            {phase.name !== "analyzing" && (
              <form
                onSubmit={onSearch}
                style={{ display: "flex", gap: 10, alignItems: "baseline" }}
              >
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="another song…"
                  aria-label="search for a song"
                  style={{
                    width: "min(240px, 38vw)",
                    fontSize: 14.5,
                    paddingBottom: 3,
                    borderBottom: "1px solid var(--line)",
                  }}
                />
                <button type="submit" className="mono">
                  search
                </button>
              </form>
            )}
          </div>
        </header>
      )}

      {error && (
        <p className="col mono" style={{ paddingTop: 12, color: "var(--ink-soft)" }}>
          × {error}
        </p>
      )}

      <AnimatePresence mode="wait">
        {phase.name === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{
              minHeight: "78vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
              padding: "0 28px",
            }}
          >
            <Wordmark size={64} />
            <p className="mono-faint" style={{ marginBottom: 26 }}>
              hold the moment · see why it hits
            </p>
            <form onSubmit={onSearch} style={{ width: "min(440px, 100%)", display: "flex", gap: 12 }}>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="a song you're obsessed with"
                aria-label="search for a song"
                style={{
                  flex: 1,
                  fontSize: 17,
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--ink)",
                }}
              />
              <button type="submit" className="mono" style={{ alignSelf: "flex-end", paddingBottom: 8 }}>
                analyze ↵
              </button>
            </form>
            {spotifyEnabled && (
              <button
                className="mono-faint"
                onClick={() => void openPlaylists()}
                style={{ marginTop: 10, textDecoration: "underline" }}
              >
                or browse your spotify playlists →
              </button>
            )}
          </motion.div>
        )}

        {phase.name === "playlists" && (
          <motion.div
            key="playlists"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="col"
            style={{ paddingTop: 48, paddingBottom: 80 }}
          >
            <p className="mono-faint" style={{ marginBottom: 18 }}>
              your playlists · spotify
            </p>
            {phase.playlists.map((p, i) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3, ease: "easeOut" }}
                onClick={() => void openPlaylist(p)}
                disabled={p.spotifyOwned}
                title={
                  p.spotifyOwned
                    ? "spotify doesn't let apps read its own curated playlists"
                    : undefined
                }
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto",
                  gap: 16,
                  alignItems: "center",
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 10px",
                  borderTop: "1px solid var(--line)",
                  transition: "background-color 0.15s ease-out",
                  opacity: p.spotifyOwned ? 0.45 : 1,
                  cursor: p.spotifyOwned ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!p.spotifyOwned) e.currentTarget.style.backgroundColor = "#f3efe8";
                }}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                {p.cover ? (
                  <img
                    src={p.cover}
                    alt=""
                    width={44}
                    height={44}
                    style={{ borderRadius: 4, border: "1px solid var(--line)" }}
                  />
                ) : (
                  <span />
                )}
                <span style={{ fontWeight: 600, fontSize: 15.5 }}>{p.name}</span>
                <span className="mono-faint">
                  {p.spotifyOwned ? "unavailable · spotify-curated" : `${p.trackCount} songs`}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}

        {phase.name === "playlistTracks" && (
          <motion.div
            key={`pl-${phase.playlist.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="col"
            style={{ paddingTop: 48, paddingBottom: 80 }}
          >
            <p className="mono-faint" style={{ marginBottom: 18 }}>
              <button
                className="mono-faint"
                onClick={() => void openPlaylists()}
                style={{ textDecoration: "underline" }}
              >
                ← playlists
              </button>{" "}
              · {phase.playlist.name}
            </p>
            {phase.tracks.map((t, i) => (
              <motion.button
                key={`${t.title}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.035, duration: 0.3, ease: "easeOut" }}
                onClick={() => void pickSpotifyTrack(t)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto",
                  gap: 16,
                  alignItems: "center",
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 10px",
                  borderTop: "1px solid var(--line)",
                  transition: "background-color 0.15s ease-out",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f3efe8")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                {t.cover ? (
                  <img
                    src={t.cover}
                    alt=""
                    width={44}
                    height={44}
                    style={{ borderRadius: 4, border: "1px solid var(--line)" }}
                  />
                ) : (
                  <span />
                )}
                <span>
                  <span style={{ fontWeight: 600, fontSize: 15.5 }}>{t.title}</span>
                  <span style={{ color: "var(--grey)", fontSize: 14.5 }}> — {t.artist}</span>
                </span>
                <span className="mono-faint">{formatTime(t.durationS)}</span>
              </motion.button>
            ))}
          </motion.div>
        )}

        {phase.name === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="col"
            style={{ paddingTop: 48, paddingBottom: 80 }}
          >
            <p className="mono-faint" style={{ marginBottom: 18 }}>
              {phase.tracks.length} matches · pick the version you mean
            </p>
            {phase.tracks.map((t, i) => (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.045, duration: 0.3, ease: "easeOut" }}
                onClick={() => onPick(t)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto",
                  gap: 16,
                  alignItems: "center",
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 10px",
                  borderTop: "1px solid var(--line)",
                  transition: "background-color 0.15s ease-out",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f3efe8")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                {t.cover ? (
                  <img
                    src={t.cover.replace("1000x1000", "250x250")}
                    alt=""
                    width={44}
                    height={44}
                    style={{ borderRadius: 4, border: "1px solid var(--line)" }}
                  />
                ) : (
                  <span />
                )}
                <span>
                  <span style={{ fontWeight: 600, fontSize: 15.5 }}>{t.title}</span>
                  <span style={{ color: "var(--grey)", fontSize: 14.5 }}>
                    {" "}
                    — {t.artist}
                    {t.album ? ` · ${t.album}` : ""}
                  </span>
                </span>
                <span className="mono-faint">{formatTime(t.duration)}</span>
              </motion.button>
            ))}
          </motion.div>
        )}

        {phase.name === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Analyzing title={phase.track.title} artist={phase.track.artist} />
          </motion.div>
        )}

        {phase.name === "result" && (
          <motion.div
            key={`result-${phase.analysis.track.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <ResultView analysis={phase.analysis} onBack={backToResults} />
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
