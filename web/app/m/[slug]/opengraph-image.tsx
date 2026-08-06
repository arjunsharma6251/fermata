import { ImageResponse } from "next/og";
import { parseMomentSlug } from "@/lib/slug";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "fermata — the exact moment this song gets you";

// The moment card: the quote is the hero, set over the waveform motif with
// the accent blooming at the moment's position. Satori is flexbox-only —
// every multi-child div needs display:flex. All data rides in the slug
// (accent included) so no lookup can slow or break the preview.

const BARS = 64;

/** Deterministic per-song bar heights: seeded pseudo-noise under an
 *  envelope that swells toward the moment. Composed, not jagged. */
function barHeights(seedStr: string, momentFrac: number): number[] {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) % 100000;
  const peak = momentFrac * (BARS - 1);
  return Array.from({ length: BARS }, (_, i) => {
    const noise = Math.abs(Math.sin(seed + i * 7.13) * 43758.5453) % 1;
    const swell = 0.35 + 0.65 * Math.exp(-Math.pow((i - peak) / 16, 2));
    return swell * (0.45 + 0.55 * noise);
  });
}

/** "clip 0:14" -> its fraction of the 30s clip; song stamps have no clip
 *  position, so those sit at a composed off-center point. */
function momentFraction(stamp: string | null): number {
  const m = stamp?.match(/clip\s+(\d+):(\d+)/i);
  if (!m) return 0.62;
  const s = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return Math.min(0.95, Math.max(0.05, s / 30));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = parseMomentSlug(slug);

  const title = p.title ?? p.query.replace(/\b\w/g, (c) => c.toUpperCase());
  const artist = p.artist ?? "";
  const why = p.why ?? "the exact moment this song gets you — and why it hits.";

  const CANVAS = "#faf8f5";
  const INK = "#16130f";
  const GREY = "#97907f";
  const BAR = "#e3ddd2";
  const ACCENT = p.accent ?? "#d6273c";

  const frac = momentFraction(p.stamp);
  const bars = barHeights(`${title}${artist}`, frac);
  const peakIdx = Math.round(frac * (BARS - 1));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: CANVAS,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 72px 52px",
          fontFamily: "serif",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: INK, display: "flex" }}>
            fermata<span style={{ color: ACCENT }}>.</span>
          </div>
          <div style={{ fontSize: 21, color: GREY, letterSpacing: 2, display: "flex" }}>
            THE MOMENT{p.stamp ? ` · ${p.stamp.toUpperCase()}` : ""}
          </div>
        </div>

        {/* the quote — the hero */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 1010 }}>
          {p.label && (
            <div style={{ fontSize: 24, color: ACCENT, letterSpacing: 1, marginBottom: 18, display: "flex" }}>
              {p.label.toLowerCase()}
            </div>
          )}
          <div
            style={{
              fontSize: why.length > 110 ? 40 : 48,
              fontWeight: 600,
              color: INK,
              lineHeight: 1.28,
              display: "flex",
            }}
          >
            “{why}”
          </div>
        </div>

        {/* waveform motif, accent blooming at the moment */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, height: 96 }}>
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                width: 12,
                height: `${Math.round(h * 100)}%`,
                borderRadius: 4,
                background: Math.abs(i - peakIdx) <= 2 ? ACCENT : BAR,
              }}
            />
          ))}
        </div>

        {/* footer: song identity */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            {p.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.cover}
                width={92}
                height={92}
                style={{ borderRadius: 10, border: "1px solid #eae5db" }}
                alt=""
              />
            )}
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: INK, display: "flex" }}>{title}</div>
              {artist && <div style={{ fontSize: 24, color: GREY, marginTop: 4, display: "flex" }}>{artist}</div>}
            </div>
          </div>
          <div style={{ fontSize: 22, color: GREY, display: "flex" }}>hearfermata.com</div>
        </div>
      </div>
    ),
    size
  );
}
