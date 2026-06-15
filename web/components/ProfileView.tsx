"use client";

// A shared discovery map at /u/<data> — renders someone else's craft map
// read-only. Clicking a song opens its own shareable analysis page, so a
// shared map is itself a discovery surface.

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Track } from "@/lib/api";
import { decodeMap } from "@/lib/discovery";
import { toSongSlug } from "@/lib/slug";
import { CraftMap } from "./CraftMap";

export function ProfileView({ data }: { data: string }) {
  const router = useRouter();
  const graph = useMemo(() => decodeMap(data), [data]);

  if (graph.nodes.length === 0) {
    return (
      <div className="col" style={{ paddingTop: 80, textAlign: "center" }}>
        <p className="mono-faint">this map link looks broken or empty.</p>
        <p style={{ marginTop: 16 }}>
          <a href="/" className="editorial-link">
            start your own →
          </a>
        </p>
      </div>
    );
  }

  return (
    <CraftMap
      open
      external={graph}
      focusKey={null}
      onClose={() => router.push("/")}
      onAnalyze={(title: string, artist: string, prefetched?: Track) => {
        router.push(`/song/${toSongSlug(title, artist, prefetched?.cover ?? null)}`);
      }}
    />
  );
}
