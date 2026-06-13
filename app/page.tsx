import { getLatestUpdates, getPopular } from "@/lib/mangadex-server";
import { Hero } from "@/components/home/hero";
import { ContinueReading } from "@/components/home/continue-reading";
import { Section } from "@/components/manga/section";
import { MangaGrid } from "@/components/manga/manga-grid";
import { MangaCarousel } from "@/components/manga/manga-carousel";
import { InternalAdPreview } from "@/components/ads/internal-ad-preview";

export const revalidate = 300;

export default async function HomePage() {
  const [popular, latest] = await Promise.all([
    getPopular(18),
    getLatestUpdates(24),
  ]);

  if (popular.length === 0 && latest.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Could not load the shelf</h1>
        <p className="mt-2 text-muted-foreground">
          The story feed is temporarily unavailable. Refresh in a moment or try browsing again shortly.
        </p>
      </div>
    );
  }

  const featured = popular[0] ?? latest[0];
  const popularRail = popular.filter((manga) => manga.id !== featured?.id);
  const latestRail = latest.filter((manga) => manga.id !== featured?.id);
  const starterManga = [...popularRail, ...latestRail].slice(0, 3);

  return (
    <div className="w-full">
      {featured && <Hero manga={featured} />}

      <div className="mx-auto w-full max-w-7xl space-y-[var(--section-gap)] px-4 py-10 sm:py-12">
        <ContinueReading starterManga={starterManga} />

        {popularRail.length > 0 && (
          <Section
            title="Popular right now"
            description="Story-forward picks readers are opening, saving, and testing for a first chapter."
            href="/browse?sort=popular"
            actionLabel="Browse popular"
          >
            <MangaCarousel
              manga={popularRail}
              ariaLabel="Popular manga"
            />
          </Section>
        )}

        <InternalAdPreview placement="banner" />

        {latestRail.length > 0 && (
          <Section
            title="Fresh chapter drops"
            description="New English updates ready for quick reads and easy saves."
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
