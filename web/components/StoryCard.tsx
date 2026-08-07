"use client";

// The 9:16 story-format share artifact (Instagram/Snapchat stories) —
// rendered at 540×960 CSS, exported at 2x for a crisp 1080×1920 PNG.
// Same forensic-editorial system as ShareCard, recomposed for a phone
// screen: the quote is the centerpiece and everything is sized to be
// read full-bleed at arm's length. One accent, generous negative space.

import { forwardRef } from "react";
import type { Analysis, Moment } from "@/lib/api";

interface StoryCardProps {
  analysis: Analysis;
  moment: Moment;
}

const CARD_W = 540;
const CARD_H = 960;
const BARS = 44;

function shape(v: number): number {
  return 0.1 + 0.9 * Math.pow(Math.min(1, Math.max(0, v)), 0.85);
}

export const StoryCard = forwardRef<HTMLDivElement, StoryCardProps>(
  ({ analysis, moment }, ref) => {
    const { track, features, waveform } = analysis;

    const step = waveform.length / BARS;
    const bars = Array.from({ length: BARS }, (_, i) =>
      shape(waveform[Math.floor(i * step)] ?? 0)
    );
    const peak = bars.indexOf(Math.max(...bars));

    return (
      <div
        ref={ref}
        style={{
          width: CARD_W,
          height: CARD_H,
          background: "var(--canvas)",
          // IG stories overlay ~200px (top) / ~250px (bottom) of the 1080×1920
          // export with their own UI — keep everything inside the safe area
          padding: "104px 44px 128px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontFamily: "var(--sans)",
          color: "var(--ink)",
        }}
      >
        {/* header */}
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--serif)",
              fontWeight: 620,
              fontSize: 24,
              letterSpacing: "-0.015em",
            }}
          >
            fermata<span style={{ color: "var(--accent)" }}>.</span>
          </span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            the moment
          </span>
        </div>

        {/* identity: cover, title, artist, chips */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 36,
            flexShrink: 0,
          }}
        >
          {track.cover && (
            <img
              src={track.cover}
              alt=""
              crossOrigin="anonymous"
              width={140}
              height={140}
              style={{ borderRadius: 12, border: "1px solid var(--line)" }}
            />
          )}
          <div
            style={{
              fontFamily: "var(--serif)",
              fontWeight: 600,
              fontSize: 33,
              lineHeight: 1.12,
              letterSpacing: "-0.01em",
              textAlign: "center",
              marginTop: 24,
              maxWidth: 430,
            }}
          >
            {track.title}
          </div>
          <div style={{ color: "var(--grey)", fontSize: 16, marginTop: 8 }}>
            {track.artist}
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--ink-soft)",
              letterSpacing: "0.04em",
              marginTop: 14,
            }}
          >
            {features.tempo_bpm} bpm · {features.key_estimate.toLowerCase()}
          </div>
        </div>

        {/* waveform band */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            height: 56,
            width: "100%",
            marginTop: 36,
            flexShrink: 0,
          }}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h * 100}%`,
                borderRadius: 3,
                background: Math.abs(i - peak) <= 1 ? "var(--accent)" : "var(--bar)",
              }}
            />
          ))}
        </div>

        {/* the moment — the centerpiece */}
        <div
          style={{
            width: "100%",
            borderLeft: "2px solid var(--accent)",
            paddingLeft: 22,
            marginTop: 36,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11.5,
              color: "var(--ink-soft)",
              letterSpacing: "0.04em",
              marginBottom: 14,
            }}
          >
            {moment.moment} · {moment.timestamp}
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: moment.why_it_hits.length > 150 ? 21 : moment.why_it_hits.length > 110 ? 23.5 : 26,
              lineHeight: 1.42,
            }}
          >
            {moment.why_it_hits}
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            marginTop: "auto",
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            flexShrink: 0,
            fontFamily: "var(--mono)",
            fontSize: 11.5,
            letterSpacing: "0.05em",
            color: "var(--grey)",
          }}
        >
          <span>the craft behind why it hits</span>
          <span>hearfermata.com</span>
        </div>
      </div>
    );
  }
);
StoryCard.displayName = "StoryCard";
