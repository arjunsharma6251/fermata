"use client";

// The 9:16 story-format share artifact (Instagram/Snapchat stories) —
// rendered at 540×960 CSS, exported at 2x for a crisp 1080×1920 PNG.
// Same forensic-editorial system as ShareCard, recomposed for a phone
// screen: the quote is the centerpiece, the sharer's verdict rides
// Letterboxd-style under the title, and the waveform's accent bloom
// sits on the featured moment's actual clip position (energy peak when
// the moment has no clip stamp). One accent, generous negative space.

import { forwardRef } from "react";
import type { Analysis, Moment } from "@/lib/api";
import { formatTime, parseClipStamp } from "@/lib/lrc";
import { starsText } from "@/lib/ratings";
import type { SlugVerdict } from "@/lib/slug";

interface StoryCardProps {
  analysis: Analysis;
  moment: Moment;
  verdict?: SlugVerdict | null;
}

const CARD_W = 540;
const CARD_H = 960;
const BARS = 52;

function shape(v: number): number {
  return 0.1 + 0.9 * Math.pow(Math.min(1, Math.max(0, v)), 0.85);
}

export const StoryCard = forwardRef<HTMLDivElement, StoryCardProps>(
  ({ analysis, moment, verdict }, ref) => {
    const { track, features, waveform } = analysis;

    const step = waveform.length / BARS;
    const bars = Array.from({ length: BARS }, (_, i) =>
      shape(waveform[Math.floor(i * step)] ?? 0)
    );
    const peak = bars.indexOf(Math.max(...bars));

    // center the accent bloom on the featured moment when it lives inside
    // the clip; lyric/inferred moments fall back to the energy peak
    const clipS = parseClipStamp(moment.timestamp);
    const clipTotal = features.clip_seconds || 30;
    const onMoment = clipS !== null;
    const center = onMoment
      ? Math.round(Math.min(0.98, Math.max(0.02, clipS / clipTotal)) * (BARS - 1))
      : peak;
    const markerLeft = `${((center + 0.5) / BARS) * 100}%`;

    const take = verdict?.take.trim() ?? "";
    // the card is fixed-height with flexShrink:0 everywhere, so type scales
    // to the combined text load instead of letting flex collapse a block
    const longTitle = track.title.length > 24;
    const quoteLoad =
      moment.why_it_hits.length + (take ? 40 : 0) + (longTitle ? 20 : 0);
    const quoteSize =
      quoteLoad > 240 ? 17.5 : quoteLoad > 190 ? 19 : quoteLoad > 150 ? 21 : quoteLoad > 110 ? 23 : 26;

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

        {/* identity: cover, title, artist */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 32,
            flexShrink: 0,
          }}
        >
          {track.cover && (
            <img
              src={track.cover}
              alt=""
              crossOrigin="anonymous"
              width={124}
              height={124}
              style={{ borderRadius: 12, border: "1px solid var(--line)" }}
            />
          )}
          <div
            style={{
              fontFamily: "var(--serif)",
              fontWeight: 600,
              fontSize: longTitle ? 28 : 32,
              lineHeight: 1.12,
              letterSpacing: "-0.01em",
              textAlign: "center",
              marginTop: 22,
              maxWidth: 430,
            }}
          >
            {track.title}
          </div>
          <div style={{ color: "var(--grey)", fontSize: 16, marginTop: 7 }}>
            {track.artist}
          </div>
        </div>

        {/* the sharer's verdict — stars framed by hairlines, the take in ink */}
        {verdict && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: 18,
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 26, height: 1, background: "var(--line)" }} />
              <span
                style={{
                  color: "var(--accent)",
                  fontSize: 22,
                  letterSpacing: 3,
                  lineHeight: 1,
                }}
              >
                {starsText(verdict.stars)}
              </span>
              <span style={{ width: 26, height: 1, background: "var(--line)" }} />
            </div>
            {take && (
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: take.length > 80 ? 15.5 : 17,
                  lineHeight: 1.45,
                  textAlign: "center",
                  maxWidth: 400,
                  marginTop: 10,
                }}
              >
                “{take}”
              </div>
            )}
          </div>
        )}

        {/* waveform band — accent blooms around the featured moment */}
        <div style={{ width: "100%", marginTop: 32, flexShrink: 0 }}>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 3,
              height: 76,
              width: "100%",
            }}
          >
            {bars.map((h, i) => {
              const d = Math.abs(i - center);
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${h * 100}%`,
                    borderRadius: 3,
                    background: d <= 2 ? "var(--accent)" : "var(--bar)",
                    opacity: d === 0 ? 1 : d === 1 ? 0.65 : d === 2 ? 0.35 : 1,
                  }}
                />
              );
            })}
            <div
              style={{
                position: "absolute",
                left: markerLeft,
                top: -7,
                bottom: -7,
                width: 1.5,
                transform: "translateX(-50%)",
                background: "var(--accent)",
                borderRadius: 1,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 13,
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.04em",
              color: "var(--ink-soft)",
            }}
          >
            <span>
              {features.tempo_bpm} bpm · {features.key_estimate.toLowerCase()}
            </span>
            <span>
              {onMoment
                ? moment.timestamp.toLowerCase()
                : `energy peak · clip ${formatTime(clipTotal)}`}
            </span>
          </div>
        </div>

        {/* the moment — the centerpiece */}
        <div
          style={{
            width: "100%",
            borderLeft: "2px solid var(--accent)",
            paddingLeft: 22,
            marginTop: 30,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11.5,
              color: "var(--ink-soft)",
              letterSpacing: "0.04em",
              marginBottom: 12,
            }}
          >
            {moment.moment} · {moment.timestamp}
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: quoteSize,
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
