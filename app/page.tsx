import { getLatestUpdates, getPopular } from "@/lib/mangadex-server";
import { Hero } from "@/components/home/hero";
import { ContinueReading } from "@/components/home/continue-reading";
import { Section } from "@/components/manga/section";
import { MangaGrid } from "@/components/manga/manga-grid";
import { MangaCarousel } from "@/components/manga/manga-carousel";
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
        <h1 className="text-2xl font-bold">Could not reach MangaDex</h1>
        <p className="mt-2 text-muted-foreground">
          The manga service is temporarily unavailable. Please try again shortly.
        </p>
      </div>
    );
  }

  const featured = popular[0] ?? latest[0];
  const popularRail = popular.filter((manga) => manga.id !== featured?.id);
  const latestRail = latest.filter((manga) => manga.id !== featured?.id);
  const supportingManga = [...popularRail, ...latestRail].slice(0, 4);

  return (
    <div className="w-full">
      {featured && <Hero manga={featured} supportingManga={supportingManga} />}

      <div className="mx-auto w-full max-w-7xl space-y-14 px-4 py-10 sm:py-12">
        <ContinueReading />

        {popularRail.length > 0 && (
          <Section
            title="Reader heat"
            description="Series pulling attention right now, chosen for quick first chapters and easy library saves."
            href="/browse?sort=popular"
            actionLabel="Browse popular"
          >
            <MangaCarousel manga={popularRail} />
          </Section>
        )}

        <AdSlot placement="banner" />

        {latestRail.length > 0 && (
          <Section
            title="Fresh chapter drops"
            description="New English updates from MangaDex, de-duplicated so every cover points to a different series."
            href="/browse?sort=latest"
            actionLabel="Browse updates"
          >
            <MangaGrid manga={latestRail} />
          </Section>
        )}
      </div>
    </div>
  );
}
