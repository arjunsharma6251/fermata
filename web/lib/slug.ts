// Shareable song slugs. Format: "ivy-frank-ocean~<base64url>", where the
// readable prefix is for humans + the page's Deezer search, and the encoded
// suffix carries the EXACT title/artist/cover so the server-rendered OG image
// is correct even for songs iTunes mis-ranks (Deezer is IP-blocked server-side,
// so the OG can't re-resolve the cover itself).

interface SongData {
  t: string; // title
  a: string; // artist
  c: string | null; // cover URL
}

function readable(title: string, artist: string): string {
  return `${title} ${artist}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
}

// Unicode-safe base64url, works in both the browser and Node (Next server)
function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function toSongSlug(title: string, artist: string, cover: string | null = null): string {
  const data: SongData = { t: title, a: artist, c: cover };
  return `${readable(title, artist)}~${b64urlEncode(JSON.stringify(data))}`;
}

export interface ParsedSlug {
  query: string; // for Deezer search on the page
  title: string | null;
  artist: string | null;
  cover: string | null;
}

export function parseSongSlug(slug: string): ParsedSlug {
  const decoded = decodeURIComponent(slug);
  const [pretty, encoded] = decoded.split("~");
  let title: string | null = null;
  let artist: string | null = null;
  let cover: string | null = null;
  if (encoded) {
    try {
      const d = JSON.parse(b64urlDecode(encoded)) as SongData;
      title = d.t ?? null;
      artist = d.a ?? null;
      cover = d.c ?? null;
    } catch {
      /* malformed — fall back to the readable part */
    }
  }
  const query = title && artist ? `${title} ${artist}` : pretty.replace(/-/g, " ").trim();
  return { query, title, artist, cover };
}
