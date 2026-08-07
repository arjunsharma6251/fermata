// Shareable song slugs. Format: "ivy-frank-ocean~<base64url>", where the
// readable prefix is for humans + the page's Deezer search, and the encoded
// suffix carries the EXACT title/artist/cover so the server-rendered OG image
// is correct even for songs iTunes mis-ranks (Deezer is IP-blocked server-side,
// so the OG can't re-resolve the cover itself).

interface SongData {
  t: string; // title
  a: string; // artist
  c: string | null; // cover URL
  r?: number; // sharer's rating, 0.5–5 half steps
  k?: string; // sharer's one-line take
}

export interface SlugVerdict {
  stars: number;
  take: string;
}

const TAKE_SLUG_MAX = 140;

function verdictFields(v?: SlugVerdict | null): { r?: number; k?: string } {
  if (!v || !v.stars) return {};
  const out: { r?: number; k?: string } = { r: v.stars };
  if (v.take.trim()) out.k = v.take.trim().slice(0, TAKE_SLUG_MAX);
  return out;
}

function parseVerdict(d: { r?: unknown; k?: unknown }): { stars: number | null; take: string | null } {
  const raw = typeof d.r === "number" ? d.r : NaN;
  // only accept the exact shape we mint: half steps within 0.5–5
  const stars = raw >= 0.5 && raw <= 5 && (raw * 2) % 1 === 0 ? raw : null;
  return { stars, take: stars && typeof d.k === "string" ? d.k.slice(0, TAKE_SLUG_MAX) : null };
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

export function toSongSlug(
  title: string,
  artist: string,
  cover: string | null = null,
  verdict?: SlugVerdict | null
): string {
  const data: SongData = { t: title, a: artist, c: cover, ...verdictFields(verdict) };
  return `${readable(title, artist)}~${b64urlEncode(JSON.stringify(data))}`;
}

// Moment slugs (/m/<slug>) additionally carry one annotated moment — its
// stamp, label, and a why_it_hits excerpt — plus the song's clamped accent,
// so the OG card can quote the moment in the song's own color without any
// server-side lookup (the analysis cache is ephemeral and slow to miss).
interface MomentData extends SongData {
  ts: string; // moment timestamp string, e.g. "clip 0:14" or "2:18"
  mo: string; // moment label
  w: string; // why_it_hits excerpt
  x?: string; // clamped accent hex
}

const WHY_MAX = 180;

function excerpt(s: string): string {
  if (s.length <= WHY_MAX) return s;
  const cut = s.slice(0, WHY_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), WHY_MAX - 20))}…`;
}

export function toMomentSlug(
  title: string,
  artist: string,
  cover: string | null,
  moment: { timestamp: string; moment: string; why_it_hits: string },
  accent?: string,
  verdict?: SlugVerdict | null
): string {
  const data: MomentData = {
    t: title,
    a: artist,
    c: cover,
    ts: moment.timestamp,
    mo: moment.moment,
    w: excerpt(moment.why_it_hits),
    ...(accent ? { x: accent } : {}),
    ...verdictFields(verdict),
  };
  return `${readable(title, artist)}~${b64urlEncode(JSON.stringify(data))}`;
}

export interface ParsedSlug {
  query: string; // for Deezer search on the page
  title: string | null;
  artist: string | null;
  cover: string | null;
  stars: number | null; // sharer's verdict, if the link carries one
  take: string | null;
}

export interface ParsedMomentSlug extends ParsedSlug {
  stamp: string | null;
  label: string | null;
  why: string | null;
  accent: string | null;
}

export function parseMomentSlug(slug: string): ParsedMomentSlug {
  const decoded = decodeURIComponent(slug);
  const [pretty, encoded] = decoded.split("~");
  const out: ParsedMomentSlug = {
    query: pretty.replace(/-/g, " ").trim(),
    title: null,
    artist: null,
    cover: null,
    stars: null,
    take: null,
    stamp: null,
    label: null,
    why: null,
    accent: null,
  };
  if (encoded) {
    try {
      const d = JSON.parse(b64urlDecode(encoded)) as MomentData;
      out.title = d.t ?? null;
      out.artist = d.a ?? null;
      out.cover = d.c ?? null;
      out.stamp = d.ts ?? null;
      out.label = d.mo ?? null;
      out.why = d.w ?? null;
      // never let slug data inject styles — accept a strict hex color only
      out.accent = d.x && /^#[0-9a-fA-F]{6}$/.test(d.x) ? d.x : null;
      ({ stars: out.stars, take: out.take } = parseVerdict(d));
    } catch {
      /* malformed — fall back to the readable part */
    }
  }
  if (out.title && out.artist) out.query = `${out.title} ${out.artist}`;
  return out;
}

export function parseSongSlug(slug: string): ParsedSlug {
  const decoded = decodeURIComponent(slug);
  const [pretty, encoded] = decoded.split("~");
  let title: string | null = null;
  let artist: string | null = null;
  let cover: string | null = null;
  let stars: number | null = null;
  let take: string | null = null;
  if (encoded) {
    try {
      const d = JSON.parse(b64urlDecode(encoded)) as SongData;
      title = d.t ?? null;
      artist = d.a ?? null;
      cover = d.c ?? null;
      ({ stars, take } = parseVerdict(d));
    } catch {
      /* malformed — fall back to the readable part */
    }
  }
  const query = title && artist ? `${title} ${artist}` : pretty.replace(/-/g, " ").trim();
  return { query, title, artist, cover, stars, take };
}
