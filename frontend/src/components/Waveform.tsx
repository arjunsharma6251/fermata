// The hero. 96 mirrored bars of real, smoothed RMS energy. Neutral grey,
// except the measured key moment, which wears the song's accent after the
// bloom. The playhead sweeps it during preview playback; hovering surfaces
// what the analysis measured there; click/drag scrubs.

import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { Player } from "../usePlayer";
import { formatTime } from "../lrc";

export interface ClipAnnotation {
  seconds: number;
  label: string;
}

interface WaveformProps {
  bars: number[];
  duration: number; // clip seconds
  marker: ClipAnnotation | null; // the measured key moment
  annotations: ClipAnnotation[]; // all clip-stamped moments (hover surface)
  shifts: { time_s: number; direction: string; energy_before: number; energy_after: number }[];
  player: Player;
  bloom: boolean;
}

const HEIGHT = "clamp(132px, 17vh, 200px)";
const PEAK_SPREAD = 3; // bars on each side of the marker that take the accent

/** Real RMS data is jagged; lift quiet bars and soften loud ones so the
 *  measured curve still reads composed (spec: make real data beautiful). */
function shape(v: number): number {
  return 0.08 + 0.92 * Math.pow(Math.min(1, Math.max(0, v)), 0.85);
}

export function Waveform({ bars, duration, marker, annotations, shifts, player, bloom }: WaveformProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [hover, setHover] = useState<string | null>(null);

  const markerBar = marker ? Math.round((marker.seconds / duration) * (bars.length - 1)) : null;
  const playedBar = (player.time / duration) * bars.length;
  const showPlayhead = player.playing || player.time > 0;

  const shapedBars = useMemo(() => bars.map(shape), [bars]);

  function secondsAt(clientX: number): number {
    const rect = wrapRef.current!.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return frac * duration;
  }

  function surfaceAt(seconds: number): string | null {
    for (const a of annotations) {
      if (Math.abs(a.seconds - seconds) <= 2) {
        return `${a.label} · clip ${formatTime(a.seconds)}`;
      }
    }
    for (const s of shifts) {
      if (Math.abs(s.time_s - seconds) <= 1.5) {
        return `${s.direction} · clip ${formatTime(s.time_s)} · energy ${s.energy_before} → ${s.energy_after}`;
      }
    }
    return null;
  }

  return (
    <div>
      {/* marker label sits above the wave, anchored to its position */}
      <div style={{ position: "relative", height: 18 }}>
        {marker && markerBar !== null && (
          <motion.span
            className="mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: bloom ? 1 : 0 }}
            transition={{ duration: 0.6 }}
            style={{
              position: "absolute",
              bottom: 0,
              left: `${(markerBar / (bars.length - 1)) * 100}%`,
              transform: markerBar > bars.length / 2 ? "translateX(-100%)" : "none",
              whiteSpace: "nowrap",
              color: "var(--ink-soft)",
            }}
          >
            <span style={{ color: "var(--accent)" }}>●</span> {marker.label} · clip{" "}
            {formatTime(marker.seconds)}
          </motion.span>
        )}
      </div>

      <div
        ref={wrapRef}
        role="slider"
        aria-label="preview position"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(player.time)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") player.seek(player.time + 2);
          if (e.key === "ArrowLeft") player.seek(player.time - 2);
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            player.toggle();
          }
        }}
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          player.seek(secondsAt(e.clientX));
        }}
        onPointerMove={(e) => {
          const s = secondsAt(e.clientX);
          setHover(surfaceAt(s));
          if (draggingRef.current) player.seek(s);
        }}
        onPointerUp={() => (draggingRef.current = false)}
        onPointerLeave={() => {
          draggingRef.current = false;
          setHover(null);
        }}
        style={{
          position: "relative",
          height: HEIGHT,
          display: "flex",
          alignItems: "center",
          gap: 2,
          cursor: "crosshair",
          touchAction: "none",
        }}
      >
        {shapedBars.map((h, i) => {
          const inPeak = markerBar !== null && Math.abs(i - markerBar) <= PEAK_SPREAD;
          const passed = showPlayhead && i < playedBar;
          const color =
            inPeak && bloom ? "var(--accent)" : passed ? "var(--bar-passed)" : "var(--bar)";
          const dist = markerBar !== null ? Math.abs(i - markerBar) : 0;
          return (
            <motion.div
              key={i}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1, backgroundColor: undefined }}
              transition={{ delay: 0.1 + i * 0.007, duration: 0.45, ease: "easeOut" }}
              style={{
                flex: 1,
                height: `${h * 100}%`,
                borderRadius: 2,
                transformOrigin: "center",
                backgroundColor: color,
                transition: inPeak
                  ? `background-color 0.5s ease-out ${dist * 0.05}s`
                  : "background-color 0.15s ease-out",
              }}
            />
          );
        })}

        {/* the measured-moment hairline */}
        {markerBar !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: bloom ? 0.55 : 0 }}
            transition={{ duration: 0.6 }}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${(markerBar / (bars.length - 1)) * 100}%`,
              width: 1,
              background: "var(--accent)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* playhead */}
        {showPlayhead && (
          <div
            style={{
              position: "absolute",
              top: -4,
              bottom: -4,
              left: `${(player.time / duration) * 100}%`,
              width: 1.5,
              background: "var(--accent)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* fixed-height surface slot — no layout jump on hover */}
      <div style={{ height: 22, marginTop: 6 }} className="mono-faint">
        {hover}
      </div>
    </div>
  );
}
