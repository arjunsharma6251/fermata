// The full analysis page. Wide screens get an editorial spread: title row
// with chips at the right, the waveform hero across the full column, then
// the read on the left with the moments + words in a right rail. Narrow
// screens stack. Reveal order: wave draws in, accent blooms, words rise.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { Analysis, Moment } from "../api";
import { usePlayer } from "../usePlayer";
import { formatTime, nearestLineIndex, parseClipStamp, parseLrc, parseSongStamp } from "../lrc";
import { Waveform, type ClipAnnotation } from "./Waveform";

const BLOOM_AT_MS = 1500; // after the 96-bar draw-in settles

interface ResultViewProps {
  analysis: Analysis;
  onBack: () => void;
}

export function ResultView({ analysis, onBack }: ResultViewProps) {
  const { track, features, waveform, explanation, lyrics } = analysis;
  const player = usePlayer(track.preview);
  const [bloom, setBloom] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [litLine, setLitLine] = useState<number | null>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  useEffect(() => {
    const id = setTimeout(() => setBloom(true), BLOOM_AT_MS);
    return () => clearTimeout(id);
  }, []);

  const lyricLines = useMemo(
    () =>
      lyrics.synced
        ? parseLrc(lyrics.synced)
        : (lyrics.plain ?? "")
            .split("\n")
            .filter((l) => l.trim())
            .map((text) => ({ time: -1, text })),
    [lyrics]
  );

  const clipAnnotations: ClipAnnotation[] = useMemo(
    () =>
      explanation.moments
        .map((m) => {
          const s = parseClipStamp(m.timestamp);
          return s === null ? null : { seconds: s, label: m.moment };
        })
        .filter((a): a is ClipAnnotation => a !== null),
    [explanation.moments]
  );

  // the marker: the measured moment, else the loudest bar
  const marker: ClipAnnotation = useMemo(() => {
    if (clipAnnotations.length > 0) return clipAnnotations[0];
    const peak = waveform.indexOf(Math.max(...waveform));
    return {
      seconds: (peak / (waveform.length - 1)) * features.clip_seconds,
      label: "peak energy",
    };
  }, [clipAnnotations, waveform, features.clip_seconds]);

  const calloutMoment: Moment =
    explanation.moments.find((m) => parseClipStamp(m.timestamp) !== null) ??
    explanation.moments[0];

  function onStampClick(m: Moment) {
    const clipS = parseClipStamp(m.timestamp);
    if (clipS !== null) {
      player.seek(clipS);
      if (!player.playing) player.toggle();
      return;
    }
    const songS = parseSongStamp(m.timestamp);
    if (songS !== null && lyrics.synced) {
      const idx = nearestLineIndex(
        lyricLines.filter((l) => l.time >= 0),
        songS
      );
      if (idx !== null) {
        setLyricsOpen(true);
        setLitLine(idx);
        requestAnimationFrame(() =>
          lineRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" })
        );
      }
    }
  }

  const reveal = (order: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: BLOOM_AT_MS / 1000 + 0.4 + order * 0.14, duration: 0.55, ease: "easeOut" as const },
  });

  return (
    <div className="col-wide" style={{ paddingTop: 40, paddingBottom: 96 }}>
      {/* --------------------------------- title row: identity | data */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="title-row"
        style={{ marginBottom: 30 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {track.cover && (
            <img
              src={track.cover}
              alt={`${track.album ?? track.title} cover`}
              width={68}
              height={68}
              style={{ borderRadius: 6, border: "1px solid var(--line)" }}
            />
          )}
          <div>
            <h1
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 600,
                fontSize: 38,
                lineHeight: 1.12,
                letterSpacing: "-0.01em",
              }}
            >
              {track.title}
            </h1>
            <p style={{ color: "var(--grey)", fontSize: 15.5, marginTop: 2 }}>{track.artist}</p>
          </div>
        </div>

        <div className="meta-stack">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="chip">{features.tempo_bpm} bpm</span>
            <span className="chip">{features.key_estimate.toLowerCase()}</span>
            <span className="chip">hybrid · clip + arc</span>
            {analysis.cached && <span className="chip">from cache</span>}
          </div>
          <p className="mono-faint">
            matched: {track.album} · {formatTime(track.duration)} ·{" "}
            <button className="mono-faint" onClick={onBack} style={{ textDecoration: "underline" }}>
              wrong version?
            </button>
          </p>
        </div>
      </motion.div>

      {/* --------------------------------------------- the hero */}
      <Waveform
        bars={waveform}
        duration={features.clip_seconds}
        marker={marker}
        annotations={clipAnnotations}
        shifts={features.biggest_energy_shifts}
        player={player}
        bloom={bloom}
      />

      {/* controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 2 }}>
        <button
          onClick={player.toggle}
          aria-label={player.playing ? "pause preview" : "play preview"}
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "1px solid var(--ink)",
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            lineHeight: 1,
            transition: "background-color 0.2s ease-out, color 0.2s ease-out",
            background: player.playing ? "var(--ink)" : "transparent",
            color: player.playing ? "var(--canvas)" : "var(--ink)",
          }}
        >
          {player.playing ? "❚❚" : "▶"}
        </button>
        <span className="mono">
          {formatTime(player.time)} / {formatTime(features.clip_seconds)}
        </span>
        <span className="mono-faint" style={{ marginLeft: "auto" }}>
          30s preview · the wave is measured, the arc is read
        </span>
      </div>

      {/* ----------------------------------- the spread: read | rail */}
      <div className="result-grid" style={{ marginTop: 52 }}>
        <motion.div {...reveal(0)}>
          <p className="mono-faint" style={{ marginBottom: 12 }}>
            the read
          </p>
          <h2
            style={{
              fontFamily: "var(--serif)",
              fontWeight: 560,
              fontSize: 25,
              lineHeight: 1.35,
              marginBottom: 20,
            }}
          >
            {explanation.headline}
          </h2>
          {explanation.overall
            .split("\n")
            .filter((p) => p.trim())
            .map((p, i) => (
              <p key={i} style={{ fontSize: 16, lineHeight: 1.72, marginBottom: 14 }}>
                {p}
              </p>
            ))}

          {calloutMoment && (
            <aside
              style={{
                borderLeft: "2px solid var(--accent)",
                paddingLeft: 20,
                margin: "32px 0 0",
              }}
            >
              <p className="mono" style={{ marginBottom: 6 }}>
                the moment · {calloutMoment.timestamp}
              </p>
              <p style={{ fontFamily: "var(--serif)", fontSize: 18.5, lineHeight: 1.5 }}>
                {calloutMoment.why_it_hits}
              </p>
            </aside>
          )}

          {explanation.lyric_read && (
            <div style={{ marginTop: 44 }}>
              <p className="mono-faint" style={{ marginBottom: 12 }}>
                the lyrics
              </p>
              <p style={{ fontSize: 16, lineHeight: 1.72 }}>{explanation.lyric_read}</p>
            </div>
          )}
        </motion.div>

        <motion.div {...reveal(1)} className="result-side">
          <p className="mono-faint" style={{ marginBottom: 14 }}>
            the moments
          </p>
          {explanation.moments.map((m, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "78px 1fr",
                gap: 14,
                padding: "14px 0",
                borderTop: "1px solid var(--line)",
              }}
            >
              <button
                className="mono"
                onClick={() => onStampClick(m)}
                title={
                  parseClipStamp(m.timestamp) !== null
                    ? "play this moment"
                    : "find it in the lyrics"
                }
                style={{ textAlign: "left", alignSelf: "start", textDecoration: "underline" }}
              >
                {m.timestamp}
              </button>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 3 }}>
                  {m.moment}{" "}
                  <span className="mono-faint" style={{ fontWeight: 400, marginLeft: 6 }}>
                    {m.basis}
                  </span>
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink-soft)" }}>
                  {m.what_happens}
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 5 }}>{m.why_it_hits}</p>
              </div>
            </div>
          ))}

          {lyricLines.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 12 }}>
                <p className="mono-faint">the words · full song</p>
                <button
                  className="mono"
                  onClick={() => setLyricsOpen((o) => !o)}
                  style={{ textDecoration: "underline" }}
                >
                  {lyricsOpen ? "collapse" : "show all"}
                </button>
              </div>
              <div
                style={{
                  maxHeight: lyricsOpen ? "none" : 250,
                  overflow: "hidden",
                  borderBottom: lyricsOpen ? "none" : "1px solid var(--line)",
                }}
              >
                {lyricLines.map((l, i) => (
                  <p
                    key={i}
                    ref={(el) => {
                      lineRefs.current[i] = el;
                    }}
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 14.5,
                      lineHeight: 1.85,
                      color: litLine === i ? "var(--ink)" : "var(--ink-soft)",
                      borderLeft:
                        litLine === i ? "2px solid var(--accent)" : "2px solid transparent",
                      paddingLeft: 14,
                      transition: "color 0.4s ease-out, border-color 0.4s ease-out",
                    }}
                  >
                    {l.text}
                  </p>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
