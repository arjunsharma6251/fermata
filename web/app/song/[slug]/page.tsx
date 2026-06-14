import type { Metadata } from "next";
import Home from "@/components/Home";
import { parseSongSlug } from "@/lib/slug";

type Props = { params: Promise<{ slug: string }> };

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { title, artist, query } = parseSongSlug(slug);
  const name = title && artist ? `${title} — ${artist}` : titleCase(query);
  return {
    title: name,
    description: `Why “${name}” hits — the mechanical craft behind the feeling, read by fermata.`,
    openGraph: {
      title: `${name} · fermata`,
      description: `The craft behind why “${name}” hits you.`,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function SongPage({ params }: Props) {
  const { slug } = await params;
  const { query } = parseSongSlug(slug);
  return <Home autoQuery={query} />;
}
