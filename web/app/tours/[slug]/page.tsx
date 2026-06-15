import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { SongLinks } from "@/components/SongLinks";
import { getTour, TOURS } from "@/lib/tours";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return TOURS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tour = getTour(slug);
  if (!tour) return {};
  return {
    title: tour.title,
    description: `${tour.move} ${tour.blurb}`,
    openGraph: { title: `${tour.title} · a fermata craft tour`, description: tour.move },
  };
}

export default async function TourPage({ params }: Props) {
  const { slug } = await params;
  const tour = getTour(slug);
  if (!tour) notFound();

  return (
    <PageShell>
      <p className="mono-faint" style={{ marginBottom: 12 }}>
        craft tour
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
        {tour.title}
      </h1>
      <p style={{ fontSize: 17.5, lineHeight: 1.7, marginBottom: 12, maxWidth: 580 }}>{tour.move}</p>
      <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--ink-soft)", marginBottom: 40, maxWidth: 580 }}>
        {tour.blurb}
      </p>

      <SongLinks songs={tour.songs} />

      <p className="mono-faint" style={{ marginTop: 44 }}>
        <a href="/tours" className="editorial-link">
          ← all craft tours
        </a>
      </p>
    </PageShell>
  );
}
