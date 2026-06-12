// LRC synced-lyrics parsing and timestamp helpers.
//
// Honesty note that shapes the UI: LRC timestamps are FULL-SONG times, but
// the 30s preview's position within the song is unknown (we measured — it
// can't be reliably estimated). So lyric times never drive the clip
// playhead; they only locate lines within the lyric column.

export interface LyricLine {
  time: number; // seconds, full-song
  text: string;
}

export function parseLrc(synced: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of synced.split("\n")) {
    const m = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (!m) continue;
    const text = m[3].trim();
    if (!text) continue;
    lines.push({ time: parseInt(m[1], 10) * 60 + parseFloat(m[2]), text });
  }
  return lines;
}

/** "clip 0:14" -> 14 (clip-relative seconds), else null. */
export function parseClipStamp(stamp: string): number | null {
  const m = stamp.match(/clip\s+(\d+):(\d+)/i);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

/** "2:18" (full-song) -> 138, else null. Ignores clip stamps. */
export function parseSongStamp(stamp: string): number | null {
  if (/clip/i.test(stamp)) return null;
  const m = stamp.match(/(\d+):(\d+)/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

/** Index of the lyric line nearest a full-song timestamp, or null. */
export function nearestLineIndex(lines: LyricLine[], time: number): number | null {
  if (lines.length === 0) return null;
  let best = 0;
  for (let i = 1; i < lines.length; i++) {
    if (Math.abs(lines[i].time - time) < Math.abs(lines[best].time - time)) best = i;
  }
  return Math.abs(lines[best].time - time) <= 6 ? best : null;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
