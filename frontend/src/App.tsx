// Phase 1: functional and ugly. Proves search -> analyze -> render end to end.
// All design and motion happens in Phase 2 — do not style this.

import { useState } from "react";
import type { Analysis, Track } from "./api";
import { analyzeTrack, searchTracks } from "./api";

type Status = "idle" | "searching" | "analyzing" | "done" | "error";

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setStatus("searching");
    setError(null);
    setAnalysis(null);
    try {
      setResults(await searchTracks(query));
      setStatus("idle");
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }

  async function onPick(track: Track) {
    setStatus("analyzing");
    setError(null);
    try {
      setAnalysis(await analyzeTrack(track.id));
      setStatus("done");
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }

  return (
    <main>
      <h1>fermata (phase 1)</h1>

      <form onSubmit={onSearch}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="song title and artist"
        />
        <button type="submit" disabled={status === "searching"}>
          search
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {status === "analyzing" && <p>analyzing… (first run on a song takes a while)</p>}

      {!analysis && results.length > 0 && (
        <ul>
          {results.map((t) => (
            <li key={t.id}>
              <button onClick={() => onPick(t)} disabled={status === "analyzing"}>
                analyze
              </button>{" "}
              {t.title} — {t.artist} ({t.album}, {Math.floor(t.duration / 60)}:
              {String(t.duration % 60).padStart(2, "0")})
            </li>
          ))}
        </ul>
      )}

      {analysis && <Result analysis={analysis} onBack={() => setAnalysis(null)} />}
    </main>
  );
}

function Result({ analysis, onBack }: { analysis: Analysis; onBack: () => void }) {
  const { track, features, waveform, explanation, lyrics } = analysis;
  return (
    <section>
      <button onClick={onBack}>← back to results</button>
      <h2>
        {track.title} — {track.artist}
      </h2>
      {track.cover && <img src={track.cover} alt="" width={96} />}
      <p>
        matched: {track.album} · {track.duration}s · isrc {track.isrc}
        {analysis.cached ? " · (cached)" : ""}
      </p>
      <p>
        {features.tempo_bpm} bpm · {features.key_estimate} (conf{" "}
        {features.key_confidence}) · hybrid: clip + arc
      </p>

      {/* raw waveform check — real styling in Phase 2 */}
      <div style={{ display: "flex", alignItems: "center", height: 60, gap: 1 }}>
        {waveform.map((v, i) => (
          <div key={i} style={{ width: 4, height: v * 60, background: "#999" }} />
        ))}
      </div>

      <h3>{explanation.headline}</h3>
      {explanation.overall.split("\n").map(
        (p, i) => p.trim() && <p key={i}>{p}</p>
      )}

      <h3>moments</h3>
      <ul>
        {explanation.moments.map((m, i) => (
          <li key={i}>
            <strong>
              [{m.timestamp}] {m.moment}
            </strong>{" "}
            <em>({m.basis})</em>
            <br />
            what: {m.what_happens}
            <br />
            why: {m.why_it_hits}
          </li>
        ))}
      </ul>

      {explanation.lyric_read && (
        <>
          <h3>the lyrics</h3>
          <p>{explanation.lyric_read}</p>
        </>
      )}

      {track.preview && (
        <>
          <h3>preview</h3>
          <audio controls src={track.preview} />
          {lyrics.synced && <p>(synced lyrics available — playback sync comes in Phase 2)</p>}
        </>
      )}
    </section>
  );
}
