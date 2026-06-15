import { ImageResponse } from "next/og";
import { decodeMap } from "@/lib/discovery";
import { loadMap } from "@/lib/kv";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "a craft map on fermata";

export default async function Image({ params }: { params: Promise<{ data: string }> }) {
  const { data } = await params;
  const encoded = (await loadMap(data)) ?? data;
  const { nodes } = decodeMap(encoded);
  const explored = nodes.filter((n) => n.analyzed);
  const titles = explored.slice(0, 6).map((n) => n.title);

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: INK, display: "flex" }}>
            fermata<span style={{ color: ACCENT }}>.</span>
          </div>
          <div style={{ fontSize: 22, color: GREY, letterSpacing: 2, display: "flex" }}>
            A CRAFT MAP
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 700, color: INK, lineHeight: 1.05, display: "flex" }}>
            {`${explored.length} song${explored.length === 1 ? "" : "s"}, mapped by craft`}
          </div>
          <div style={{ fontSize: 30, color: GREY, marginTop: 18, display: "flex" }}>
            {titles.join("  ·  ") + (explored.length > titles.length ? "  ·  …" : "")}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 14, height: 14, borderRadius: 14, background: ACCENT }} />
          <div style={{ fontSize: 30, color: INK, display: "flex" }}>
            a discovery map of songs connected by craft — hearfermata.com
          </div>
        </div>
      </div>
    ),
    size
  );
}
