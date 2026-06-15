// Short-link storage for shared discovery maps (Upstash Redis via Vercel).
// A map's encoded payload is stored under a short id so the share URL is
// /u/<id> — short enough for iMessage/Twitter to preview, unlike the
// whole-map-in-the-URL approach.

import { Redis } from "@upstash/redis";

function client(): Redis | null {
  // Vercel's Upstash integration may use either naming convention
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function shortId(len = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

const YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function storeMap(payload: string): Promise<string | null> {
  const redis = client();
  if (!redis) return null;
  const id = shortId();
  await redis.set(`map:${id}`, payload, { ex: YEAR_SECONDS });
  return id;
}

export async function loadMap(id: string): Promise<string | null> {
  const redis = client();
  if (!redis) return null;
  try {
    return (await redis.get<string>(`map:${id}`)) ?? null;
  } catch {
    return null;
  }
}
