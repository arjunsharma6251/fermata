import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { TOURS } from "@/lib/tours";

export const metadata: Metadata = {
  title: "Craft tours",
  description:
    "Guided journeys through songs that share one specific craft move — the beat switch, the drop before the hook, the rhyme that breaks on the loss.",
};

export default function ToursPage() {
  return (
    <PageShell>
      <p className="mono-faint" style={{ marginBottom: 12 }}>
        craft tours
      </p>
      <h1
        style={{
          fontFamily: "var(--serif)",
          fontWeight: 600,
          fontSize: "clamp(30px, 3vw, 44px)",
          lineHeight: 1.1,
          marginBottom: 14,
        }}
      >
        Songs that share a move.
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--ink-soft)", marginBottom: 44, maxWidth: 560 }}>
        Each tour is built around one specific craft move — a structural trick, a production
        choice, a lyric device — and the songs that pull it off. Pick a thread and follow it.
      </p>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {TOURS.map((t) => (
          <Link
            key={t.slug}
            href={`/tours/${t.slug}`}
            style={{
              display: "block",
              padding: "22px 0",
              borderTop: "1px solid var(--line)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <p
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 560,
                fontSize: 22,
                marginBottom: 4,
              }}
            >
              {t.title}
            </p>
            <p style={{ fontSize: 15.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>{t.move}</p>
            <p className="mono-faint" style={{ marginTop: 8 }}>
              {t.songs.length} songs →
            </p>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
