"use client";

// A composed, exportable poster of "the moment" — the share artifact.
// Rendered at CSS size; html-to-image exports it at 2x for a crisp PNG.
// Deliberately editorial: canvas, ink, one accent, generous negative space.

import { forwardRef } from "react";
import type { Analysis, Moment } from "@/lib/api";
import { formatTime } from "@/lib/lrc";
import { starsText } from "@/lib/ratings";
import type { SlugVerdict } from "@/lib/slug";

interface ShareCardProps {
  analysis: Analysis;
  moment: Moment;
  verdict?: SlugVerdict | null;
}

const CARD_W = 540;
const CARD_H = 680;
const BARS = 56;

function shape(v: number): number {
  return 0.1 + 0.9 * Math.pow(Math.min(1, Math.max(0, v)), 0.85);
}

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ analysis, moment, verdict }, ref) => {
    const { track, features, waveform } = analysis;

    // downsample the 96-bar waveform to BARS and find the peak
    const step = waveform.length / BARS;
    const bars = Array.from({ length: BARS }, (_, i) =>
      shape(waveform[Math.floor(i * step)] ?? 0)
    );
    const peak = bars.indexOf(Math.max(...bars));

    // fixed-height card, flexShrink:0 everywhere — scale the quote to the
    // text load instead of letting flex silently crush the waveform
    const take = verdict?.take.trim() ?? "";
    const quoteLoad = moment.why_it_hits.length + (take ? 50 : 0) + (verdict ? 20 : 0);
    const quoteSize =
      quoteLoad > 300 ? 16 : quoteLoad > 240 ? 17.5 : quoteLoad > 190 ? 19 : quoteLoad > 150 ? 20.5 : 23;
    const titleSize = track.title.length > 48 ? 24 : track.title.length > 30 ? 28 : 32;

    return (
      <div
        ref={ref}
        style={{
          width: CARD_W,
          height: CARD_H,
          background: "var(--canvas)",
          padding: 40,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--sans)",
          color: "var(--ink)",
          position: "relative",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexShrink: 0 }}>
          <span
            style={{
              fontFamily: "var(--serif)",
              fontWeight: 620,
              fontSize: 22,
              letterSpacing: "-0.015em",
            }}
          >
            fermata<span style={{ color: "var(--accent)" }}>.</span>
          </span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            the moment
          </span>
        </div>

        {/* title block */}
        <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 40, flexShrink: 0 }}>
          {track.cover && (
            <img
              src={track.cover}
              alt=""
              crossOrigin="anonymous"
              width={92}
              height={92}
              style={{ borderRadius: 8, border: "1px solid var(--line)", flexShrink: 0 }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 600,
                fontSize: titleSize,
                lineHeight: 1.08,
                letterSpacing: "-0.01em",
              }}
            >
              {track.title}
            </div>
            <div style={{ color: "var(--grey)", fontSize: 15, marginTop: 4 }}>{track.artist}</div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--ink-soft)",
                marginTop: 10,
                letterSpacing: "0.02em",
              }}
            >
              {features.tempo_bpm} bpm · {features.key_estimate.toLowerCase()}
            </div>
          </div>
        </div>

        {/* waveform */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            height: 88,
            marginTop: 40,
            flexShrink: 0,
          }}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h * 100}%`,
                borderRadius: 2,
                background: Math.abs(i - peak) <= 1 ? "var(--accent)" : "var(--bar)",
              }}
            />
          ))}
        </div>

        {/* the moment */}
        <div style={{ borderLeft: "2px solid var(--accent)", paddingLeft: 18, marginTop: 40, flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--ink-soft)",
              letterSpacing: "0.02em",
              marginBottom: 10,
            }}
          >
            {moment.moment} · {moment.timestamp}
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: quoteSize, lineHeight: 1.42 }}>
            {moment.why_it_hits}
          </div>
          {verdict && (
            <div style={{ marginTop: 14, lineHeight: 1.45 }}>
              <span
                style={{
                  color: "var(--accent)",
                  letterSpacing: 2.5,
                  fontSize: 18,
                  lineHeight: 1,
                  display: "block",
                }}
              >
                {starsText(verdict.stars)}
              </span>
              {verdict.take.trim() && (
                <span
                  style={{
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    fontSize: 15.5,
                    display: "block",
                    marginTop: 6,
                  }}
                >
                  “{verdict.take.trim().slice(0, 120)}”
                </span>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        <div
          style={{
            marginTop: "auto",
            flexShrink: 0,
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--grey)",
            letterSpacing: "0.04em",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>hearfermata.com</span>
          <span>clip {formatTime(features.clip_seconds)} · measured + read</span>
        </div>
      </div>
    );
  }
);
ShareCard.displayName = "ShareCard";