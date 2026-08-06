import type { Metadata } from "next";
import Home from "@/components/Home";
import { parseMomentSlug } from "@/lib/slug";

type Props = { params: Promise<{ slug: string }> };

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { title, artist, query, stamp, why } = parseMomentSlug(slug);
  const name = title && artist ? `${title} — ${artist}` : titleCase(query);
  const at = stamp ? ` at ${stamp}` : "";
  return {
    title: `the moment${at} · ${name}`,
    description: why ?? `The exact moment “${name}” gets you — and why, read by fermata.`,
    openGraph: {
      title: `the moment${at} · ${name}`,
      description: why ?? `The exact moment “${name}” gets you — and why.`,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function MomentPage({ params }: Props) {
  const { slug } = await params;
  const { query, stamp, label } = parseMomentSlug(slug);
  return (
    <Home
      autoQuery={query}
      autoMoment={stamp && label ? { stamp, label } : undefined}
    />
  );
}
