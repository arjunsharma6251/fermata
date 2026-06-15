import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { SongLinks } from "@/components/SongLinks";
import { songOfTheDay } from "@/lib/tours";

// re-render hourly so the day rolls over without a rebuild
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Song of the day",
  description: "A new song every day, broken down by the craft that makes it hit.",
};

export default function DailyPage() {
  const song = songOfTheDay(new Date());
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <PageShell>
      <p className="mono-faint" style={{ marginBottom: 12 }}>
        song of the day · {today}
      </p>
      <h1
        style={{
          fontFamily: "var(--serif)",
          fontWeight: 600,
          fontSize: "clamp(30px, 3vw, 44px)",
          lineHeight: 1.1,
          marginBottom: 16,
        }}
      >
        Today, the craft behind one song.
      </h1>
      <p
        style={{
          fontSize: 16,
          lineHeight: 1.7,
          color: "var(--ink-soft)",
          marginBottom: 40,
          maxWidth: 560,
        }}
      >
        One song a day, read for the mechanical moves that make it land. Click through for the
        full analysis.
      </p>

      <SongLinks songs={[song]} />

      <p className="mono-faint" style={{ marginTop: 44 }}>
        <a href="/tours" className="editorial-link">
          explore craft tours →
        </a>
      </p>
    </PageShell>
  );
}
