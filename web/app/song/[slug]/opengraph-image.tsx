import { ImageResponse } from "next/og";
import { parseSongSlug } from "@/lib/slug";
import { OgStars } from "@/lib/OgStars";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "fermata — the craft behind why a song hits";

// Satori (used by ImageResponse) is flexbox-only: no grid, no absolute
// positioning. The slug carries the exact title/artist/cover (Deezer is
// IP-blocked server-side, so we can't re-resolve them) — iTunes is only a
// fallback for hand-typed slugs without encoded data.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = parseSongSlug(slug);

  let title = parsed.title ?? parsed.query.replace(/\b\w/g, (c) => c.toUpperCase());
  let artist = parsed.artist ?? "";
  let cover = parsed.cover;

  if (!parsed.title) {
    try {
      const r = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(parsed.query)}&entity=song&limit=1`,
        { signal: AbortSignal.timeout(2500) }
      );
      const d = await r.json();
      const t = d.results?.[0];
      if (t) {
        title = t.trackName ?? title;
        artist = t.artistName ?? "";
        cover = (t.artworkUrl100 ?? "").replace(/\d+x\d+bb/, "600x600bb") || null;
      }
    } catch {
      /* text-only card */
    }
  }

  const CANVAS = "#faf8f5";
  const INK = "#16130f";
  const GREY = "#97907f";
  const ACCENT = "#d6273c";

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
          padding: 72,
          fontFamily: "serif",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: INK, display: "flex" }}>
            fermata<span style={{ color: ACCENT }}>.</span>
          </div>
          <div style={{ fontSize: 22, color: GREY, letterSpacing: 2, display: "flex" }}>
            THE MOMENT
          </div>
        </div>

        {/* center: cover + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              width={236}
              height={236}
              style={{ borderRadius: 16, border: "1px solid #eae5db" }}
              alt=""
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
            <div style={{ fontSize: 76, fontWeight: 700, color: INK, lineHeight: 1.05 }}>
              {title}
            </div>
            {artist && (
              <div style={{ fontSize: 36, color: GREY, marginTop: 12, display: "flex" }}>
                {artist}
              </div>
            )}
            {parsed.stars ? (
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
                <OgStars stars={parsed.stars} size={28} accent={ACCENT} />
                {parsed.take && (
                  <div
                    style={{
                      fontSize: 24,
                      fontStyle: "italic",
                      color: GREY,
                      display: "flex",
                      maxWidth: 560,
                    }}
                  >
                    “{parsed.take.slice(0, 60)}”
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 14, height: 14, borderRadius: 14, background: ACCENT }} />
          <div style={{ fontSize: 30, color: INK, display: "flex" }}>
            the craft behind why it hits — hearfermata.com
          </div>
        </div>
      </div>
    ),
    size
  );
}
