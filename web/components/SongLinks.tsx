"use client";

// A grid of songs that link to their shareable /song/[slug] pages, with
// album art enriched client-side via Deezer (so covers are correct and the
// slug carries the exact cover for the OG card).

import { useEffect, useState } from "react";
import Link from "next/link";
import { searchTracks } from "@/lib/api";
import { toSongSlug } from "@/lib/slug";
import type { TourSong } from "@/lib/tours";

export function SongLinks({ songs }: { songs: TourSong[] }) {
  const [covers, setCovers] = useState<(string | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      songs.map((s) =>
        searchTracks(`${s.title} ${s.artist}`)
          .then((r) => r[0]?.cover ?? null)
          .catch(() => null)
      )
    ).then((c) => {
      if (!cancelled) setCovers(c);
    });
    return () => {
      cancelled = true;
    };
  }, [songs]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 18,
      }}
    >
      {songs.map((s, i) => {
        const cover = covers[i] ?? null;
        return (
          <Link
            key={`${s.title}-${i}`}
            href={`/song/${toSongSlug(s.title, s.artist, cover)}`}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              padding: "16px 18px",
              border: "1px solid var(--line)",
              borderRadius: 4,
              textDecoration: "none",
              color: "inherit",
              transition: "border-color 0.2s ease-out, background-color 0.2s ease-out",
            }}
            className="song-link-card"
          >
            <div
              style={{
                width: 58,
                height: 58,
                flexShrink: 0,
                borderRadius: 4,
                border: "1px solid var(--line)",
                background: "var(--line)",
                overflow: "hidden",
              }}
            >
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  width={58}
                  height={58}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: "var(--serif)", fontSize: 17, lineHeight: 1.22 }}>
                {s.title}
              </p>
              <p className="mono-faint" style={{ marginBottom: s.note ? 8 : 0 }}>
                {s.artist}
              </p>
              {s.note && (
                <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--ink-soft)" }}>
                  {s.note}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
