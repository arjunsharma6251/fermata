// API contract with the FastAPI backend. These types mirror backend/engine.py
// and backend/main.py exactly — change them together.

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export interface Track {
  id: number;
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

export async function analyzeTrack(trackId: number): Promise<Analysis> {
  const res = await fetch(`${API_BASE}/api/analyze/${trackId}`);
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `analyze failed: ${res.status}`);
  }
  return (await res.json()) as Analysis;
}
