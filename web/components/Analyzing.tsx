"use client";

// The wait should feel like forensic work, not a spinner: a skeleton
// waveform being scanned, with mono status text narrating the real stages.
// Librosa + fetches take ~5s; the LLM takes 30–90s, so after the early
// stages the text settles into alternating between the last two lines.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const STAGES = [
  "fetching the record…",
  "downloading the 30-second clip…",
  "measuring tempo, key, energy…",
  "reading the lyrics…",
  "writing the explanation…",
  "finding the moment…",
];

export function Analyzing({ title, artist }: { title: string; artist: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => s + 1), 3200);
    return () => clearInterval(id);
  }, []);

  const stage =
    step < STAGES.length
      ? STAGES[step]
      : STAGES[STAGES.length - 2 + ((step - STAGES.length) % 2)];

  // deterministic skeleton heights — calm, symmetric-ish, obviously placeholder
  const bars = useMemo(
    () =>
      Array.from({ length: 96 }, (_, i) => {
        const t = i / 95;
        return 0.18 + 0.5 * Math.abs(Math.sin(t * 9.2)) * (0.55 + 0.45 * Math.sin(t * 3.1 + 1));
      }),
    []
  );

  return (
    <div className="col-wide" style={{ paddingTop: 72 }}>
      <p className="mono-faint" style={{ marginBottom: 6 }}>
        analyzing
      </p>
      <h2
        style={{
          fontFamily: "var(--serif)",
          fontWeight: 560,
          fontSize: 28,
          lineHeight: 1.25,
          marginBottom: 40,
        }}
      >
        {title} <span style={{ color: "var(--grey)" }}>— {artist}</span>
      </h2>

      <div
        style={{
          position: "relative",
          height: "clamp(132px, 17vh, 200px)",
          display: "flex",
          alignItems: "center",
          gap: 2,
          overflow: "hidden",
        }}
      >
        {bars.map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h * 100}%`,
              borderRadius: 2,
              background: "var(--line)",
            }}
          />
        ))}
        {/* the scanning sweep */}
        <motion.div
          initial={{ left: "-15%" }}
          animate={{ left: "110%" }}
          transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.4 }}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: "14%",
            background:
              "linear-gradient(90deg, transparent, rgba(22, 19, 15, 0.07), transparent)",
            pointerEvents: "none",
          }}
        />
      </div>

      <div style={{ height: 28, marginTop: 18 }}>
        <AnimatePresence mode="wait">
          <motion.p
            key={stage}
            className="mono"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {stage}
          </motion.p>
        </AnimatePresence>
      </div>

      <p className="mono-faint" style={{ marginTop: 48 }}>
        first analysis of a song takes a minute — it's being read, not looked up
      </p>
    </div>
  );
}