import { getLatestUpdates, getPopular } from "@/lib/mangadex-server";
import { Hero } from "@/components/home/hero";
import { ContinueReading } from "@/components/home/continue-reading";
import { Section } from "@/components/manga/section";
import { MangaGrid } from "@/components/manga/manga-grid";
import { AdSlot } from "@/components/ads/ad-slot";

export const revalidate = 300;

export default async function HomePage() {
  const [popular, latest] = await Promise.all([
    getPopular(18),
    getLatestUpdates(24),
  ]);

  if (popular.length === 0 && latest.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Couldn’t reach MangaDex</h1>
        <p className="mt-2 text-muted-foreground">
          The manga service is temporarily unavailable. Please try again shortly.
        </p>
      </div>
    );
  }

  const [featured, ...rest] = popular;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-12 px-4 py-8">
      {featured && <Hero manga={featured} />}

      <ContinueReading />

      {rest.length > 0 && (
        <Section title="Popular now" href="/browse?sort=popular">
          <MangaGrid manga={rest} />
        </Section>
      )}

      <AdSlot placement="banner" />

      <Section title="Latest updates" href="/browse?sort=latest">
        <MangaGrid manga={latest} />
      </Section>
    </div>
  );
}
