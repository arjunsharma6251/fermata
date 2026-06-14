// Deezer from the browser via JSONP.
//
// Deezer's API blocks datacenter IPs (our HF backend) and sends no CORS
// header, so the server can't use it and a normal fetch would be blocked.
// But visitors' browsers are on residential IPs Deezer doesn't block, and
// JSONP sidesteps CORS entirely. Deezer has a far better catalog + search
// than the iTunes fallback (e.g. it actually returns Frank Ocean's "Ivy").
// The chosen track (with its preview URL) is then POSTed to the backend.

import type { Track } from "./api";

interface DeezerTrack {
  id: number;
  title: string;
  artist: { name: string };
  album: { title?: string; cover_xl?: string; cover_big?: string };
  duration: number;
  isrc?: string;
  preview: string;
}

let jsonpSeq = 0;

function jsonp<T>(url: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const cb = `__dz_cb_${jsonpSeq++}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("deezer jsonp timeout"));
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[cb];
      script.remove();
    }
    (window as unknown as Record<string, unknown>)[cb] = (data: T) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("deezer jsonp failed"));
    };
    script.src = `${url}${url.includes("?") ? "&" : "?"}output=jsonp&callback=${cb}`;
    document.body.appendChild(script);
  });
}

function toTrack(t: DeezerTrack): Track {
  return {
    id: `deezer:${t.id}`,
    title: t.title,
    artist: t.artist.name,
    album: t.album?.title ?? null,
    cover: t.album?.cover_xl ?? t.album?.cover_big ?? null,
    duration: t.duration,
    preview: t.preview,
    isrc: t.isrc ?? null,
  };
}

export async function deezerSearch(query: string): Promise<Track[]> {
  const data = await jsonp<{ data?: DeezerTrack[]; error?: unknown }>(
    `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=8`
  );
  if (data.error) throw new Error("deezer error");
  return (data.data ?? []).filter((t) => t.preview).map(toTrack);
}
