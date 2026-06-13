// API contract with the FastAPI backend. These types mirror backend/engine.py
// and backend/main.py exactly — change them together.

// VITE_API_BASE overrides if set; otherwise production builds use the HF
// Space backend and local dev uses the local FastAPI server. Hardcoded so a
// missing/misconfigured Vercel env var can't break the live site.
const API_BASE =
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.PROD
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

export interface Explanation {
  overall: string;
  moments: Moment[];
  lyric_read: string | null;
  headline: string;
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
  const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  const body = (await res.json()) as { results: Track[] };
  return body.results;
}

export async function analyzeTrack(trackId: string): Promise<Analysis> {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(trackId)}`);
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `analyze failed: ${res.status}`);
  }
  return (await res.json()) as Analysis;
}
