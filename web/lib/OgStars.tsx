// Star row for OG images. Satori's bundled font has no ★ glyph (renders
// tofu), so stars are drawn as SVG paths; the half star is a hard-stop
// linear gradient fill. DOM cards can keep using starsText() — system
// fonts have the glyph — this is only for next/og.

const STAR = "M12 1.8l3 6.9 7.4.6-5.6 4.9 1.7 7.3-6.5-3.9-6.5 3.9 1.7-7.3L1.6 9.3l7.4-.6z";

export function OgStars({
  stars,
  size = 30,
  accent,
}: {
  stars: number;
  size?: number;
  accent: string;
}) {
  const full = Math.floor(stars);
  const half = stars % 1 >= 0.5;
  const id = `halfstar-${Math.round(stars * 10)}`;
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {Array.from({ length: full }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24">
          <path d={STAR} fill={accent} />
        </svg>
      ))}
      {half && (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0.5" stopColor={accent} />
              <stop offset="0.5" stopColor="#e3ddd2" />
            </linearGradient>
          </defs>
          <path d={STAR} fill={`url(#${id})`} />
        </svg>
      )}
    </div>
  );
}
