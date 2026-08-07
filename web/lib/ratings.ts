// Personal song verdicts — half-star rating + a one-line take, stored
// locally like the discovery map (no accounts, no DB). The verdict's job
// is the share loop: it rides inside moment/song slugs and share cards,
// so the shared artifact reads as identity ("MY verdict"), not just
// analysis. No aggregate/visitor-facing scores — that needs volume.

import { track } from "@/lib/analytics";

export interface Verdict {
  stars: number; // 0.5–5 in half steps
  take: string; // one-liner, may be ""
  at: number;
}

const KEY = "fermata.verdicts.v1";
export const TAKE_MAX = 140;

function load(): Record<string, Verdict> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Verdict>;
  } catch {
    return {};
  }
}

export function getVerdict(songKey: string): Verdict | null {
  return load()[songKey] ?? null;
}

export function setVerdict(songKey: string, stars: number, take: string): void {
  try {
    const all = load();
    const prev = all[songKey];
    all[songKey] = { stars, take: take.slice(0, TAKE_MAX), at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(all));
    if (prev?.stars !== stars) {
      track("song_rated", { stars, has_take: take.trim().length > 0 });
    }
  } catch {
    /* private mode etc. */
  }
}

export function clearVerdict(songKey: string): void {
  try {
    const all = load();
    delete all[songKey];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** "★★★★½" — filled-only, Letterboxd-style; empty string for no rating. */
export function starsText(stars: number | null | undefined): string {
  if (!stars || stars <= 0) return "";
  return "★".repeat(Math.floor(stars)) + (stars % 1 >= 0.5 ? "½" : "");
}
