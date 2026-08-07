import type { Metadata } from "next";
import Home from "@/components/Home";
import { parseMomentSlug } from "@/lib/slug";

type Props = { params: Promise<{ slug: string }> };

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function starsText(stars: number | null): string {
  if (!stars) return "";
  return "★".repeat(Math.floor(stars)) + (stars % 1 >= 0.5 ? "½" : "");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { title, artist, query, stamp, why, stars } = parseMomentSlug(slug);
  const name = title && artist ? `${title} — ${artist}` : titleCase(query);
  const at = stamp ? ` at ${stamp}` : "";
  const desc = why ?? `The exact moment “${name}” gets you — and why, read by fermata.`;
  const rated = stars ? `${starsText(stars)} · ${desc}` : desc;
  return {
    title: `the moment${at} · ${name}`,
    description: rated,
    openGraph: {
      title: `the moment${at} · ${name}`,
      description: rated,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function MomentPage({ params }: Props) {
  const { slug } = await params;
  const { query, stamp, label, stars, take } = parseMomentSlug(slug);
  return (
    <Home
      autoQuery={query}
      autoMoment={stamp && label ? { stamp, label, stars, take } : undefined}
    />
  );
}
