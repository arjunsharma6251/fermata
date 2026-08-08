// API contract with the FastAPI backend. These types mirror backend/engine.py
// and backend/main.py exactly — change them together.

// VITE_API_BASE overrides if set; otherwise production builds use the HF
// Space backend and local dev uses the local FastAPI server. Hardcoded so a
// missing/misconfigured Vercel env var can't break the live site.
import { deezerSearch } from "./deezer";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  (process.env.NODE_ENV === "production"
    ? "https://arjunsh6251-fermata.hf.space"
    : "http://localhost:8000");

export interface Track {
  id: string; // namespaced by source, e.g. "deezer:123" / "itunes:456"
  title: string;
  artist: string;
  album: string | null;
  cover: string | null;
  duration: number;
  preview: string | null;
  isrc: string | null;
}

export interface Moment {
  timestamp: string;
  moment: string;
  what_happens: string;
  why_it_hits: string;
  basis: "measured" | "lyrics" | "inferred";
}

export interface Suggestion {
  title: string;
  artist: string;
  why: string;
}

export interface Explanation {
  overall: string;
  moments: Moment[];
  lyric_read: string | null;
  headline: string;
  suggestions?: Suggestion[];
}

export interface Analysis {
  track: Track;
  features: {
    clip_seconds: number;
    tempo_bpm: number;
    key_estimate: string;
    key_confidence: number;
    energy_curve_time_value: [number, number][];
    biggest_energy_shifts: {
      time_s: number;
      direction: "rise" | "drop";
      energy_before: number;
      energy_after: number;
    }[];
    brightness_hz_by_third: number[];
    onset_density_per_s: number;
    beat_count: number;
  };
  waveform: number[];
  lyrics: { plain: string | null; synced: string | null };
  explanation: Explanation;
  cached: boolean;
}

export async function searchTracks(query: string): Promise<Track[]> {
  // Deezer (browser JSONP) is primary — better catalog + search. The backend
  // (iTunes) is the fallback for when Deezer JSONP fails.
  try {
    const tracks = await deezerSearch(query);
    if (tracks.length > 0) return tracks;
  } catch {
    /* fall through to the backend */
  }
  const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  const body = (await res.json()) as { results: Track[] };
  return body.results;
}

export async function fetchSuggestions(title: string, artist: string): Promise<Suggestion[]> {
  const res = await fetch(`${API_BASE}/api/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, artist }),
  });
  if (!res.ok) throw new Error(`suggest failed: ${res.status}`);
  const body = (await res.json()) as { suggestions: Suggestion[] };
  return body.suggestions;
}

/** Album art as a data URI for share-card export. html-to-image re-fetches
 *  <img> sources, which fails on signed Deezer URLs (extra params break the
 *  signature) and CORS-less mzstatic — so the card gets inlined bytes.
 *  Direct CORS fetch first, backend proxy as fallback, null if both fail. */
export async function fetchCoverDataUrl(cover: string): Promise<string | null> {
  async function toDataUrl(res: globalThis.Response): Promise<string> {
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }
  try {
    return await toDataUrl(await fetch(cover, { mode: "cors" }));
  } catch {
    try {
      return await toDataUrl(
        await fetch(`${API_BASE}/api/cover?url=${encodeURIComponent(cover)}`)
      );
    } catch {
      return null;
    }
  }
}

export async function analyzeTrack(track: Track): Promise<Analysis> {
  // POST the full track (incl. its preview URL) so the backend never needs
  // to reach Deezer's API itself — it just downloads the preview + analyzes.
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(track),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `analyze failed: ${res.status}`);
  }
  return (await res.json()) as Analysis;
}
