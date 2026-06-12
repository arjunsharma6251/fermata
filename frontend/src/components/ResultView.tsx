// The full analysis page. Vertical rhythm per spec: title block, data
// chips, waveform hero, the read, the moment callout, moments, lyrics.
// Reveal order is choreographed: wave draws in, accent blooms into the
// peak, then the words rise — eye goes wave -> words.

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
    <div className="col" style={{ paddingTop: 56, paddingBottom: 120 }}>
      {/* ------------------------------------------------ title block */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 26 }}
      >
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
      </motion.div>

      {/* ------------------------------------------------ data chips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}
      >
        <span className="chip">{features.tempo_bpm} bpm</span>
        <span className="chip">{features.key_estimate.toLowerCase()}</span>
        <span className="chip">hybrid · clip + arc</span>
        {analysis.cached && <span className="chip">from cache</span>}
      </motion.div>
      <motion.p
        className="mono-faint"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        style={{ marginBottom: 36 }}
      >
        matched: {track.album} · {formatTime(track.duration)} ·{" "}
        <button className="mono-faint" onClick={onBack} style={{ textDecoration: "underline" }}>
          wrong version?
        </button>
      </motion.p>

      {/* ------------------------------------------------ the hero */}
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

      {/* ------------------------------------------------ the read */}
      <motion.section {...reveal(0)} style={{ marginTop: 64 }}>
        <p className="mono-faint" style={{ marginBottom: 14 }}>
          the read
        </p>
        <h2
          style={{
            fontFamily: "var(--serif)",
            fontWeight: 560,
            fontSize: 26,
            lineHeight: 1.35,
            marginBottom: 24,
          }}
        >
          {explanation.headline}
        </h2>
        {explanation.overall
          .split("\n")
          .filter((p) => p.trim())
          .map((p, i) => (
            <p key={i} style={{ fontSize: 16.5, lineHeight: 1.75, marginBottom: 16 }}>
              {p}
            </p>
          ))}
      </motion.section>

      {/* ------------------------------------------------ the moment */}
      {calloutMoment && (
        <motion.aside
          {...reveal(1)}
          style={{
            borderLeft: "2px solid var(--accent)",
            paddingLeft: 20,
            margin: "40px 0 0",
          }}
        >
          <p className="mono" style={{ marginBottom: 6 }}>
            the moment · {calloutMoment.timestamp}
          </p>
          <p style={{ fontFamily: "var(--serif)", fontSize: 19, lineHeight: 1.5 }}>
            {calloutMoment.why_it_hits}
          </p>
        </motion.aside>
      )}

      {/* ------------------------------------------------ the moments */}
      <motion.section {...reveal(2)} style={{ marginTop: 72 }}>
        <p className="mono-faint" style={{ marginBottom: 22 }}>
          the moments
        </p>
        {explanation.moments.map((m, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "92px 1fr",
              gap: 18,
              padding: "20px 0",
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
              <p style={{ fontWeight: 600, fontSize: 15.5, marginBottom: 4 }}>
                {m.moment}{" "}
                <span className="mono-faint" style={{ fontWeight: 400, marginLeft: 6 }}>
                  {m.basis}
                </span>
              </p>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--ink-soft)" }}>
                {m.what_happens}
              </p>
              <p style={{ fontSize: 15, lineHeight: 1.65, marginTop: 6 }}>{m.why_it_hits}</p>
            </div>
          </div>
        ))}
      </motion.section>

      {/* ------------------------------------------------ the lyrics */}
      {explanation.lyric_read && (
        <motion.section {...reveal(3)} style={{ marginTop: 56 }}>
          <p className="mono-faint" style={{ marginBottom: 14 }}>
            the lyrics
          </p>
          <p style={{ fontSize: 16.5, lineHeight: 1.75 }}>{explanation.lyric_read}</p>
        </motion.section>
      )}

      {lyricLines.length > 0 && (
        <motion.section {...reveal(4)} style={{ marginTop: 56 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 14 }}>
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
              maxHeight: lyricsOpen ? "none" : 280,
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
                  fontSize: 16,
                  lineHeight: 2.0,
                  color: litLine === i ? "var(--ink)" : "var(--ink-soft)",
                  borderLeft: litLine === i ? "2px solid var(--accent)" : "2px solid transparent",
                  paddingLeft: 14,
                  transition: "color 0.4s ease-out, border-color 0.4s ease-out",
                }}
              >
                {l.text}
              </p>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}
