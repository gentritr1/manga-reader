import { getLatestUpdates, getPopular } from "@/lib/mangadex-server";
import { Hero } from "@/components/home/hero";
import { ContinueReading } from "@/components/home/continue-reading";
import { ReadingStats } from "@/components/home/reading-stats";
import { TonightsPlan } from "@/components/home/tonights-plan";
import { NewForYou } from "@/components/home/new-for-you";
import { Section } from "@/components/manga/section";
import { MangaGrid } from "@/components/manga/manga-grid";
import { MangaCarousel } from "@/components/manga/manga-carousel";
import { InternalAdPreview } from "@/components/ads/internal-ad-preview";
import {
  TonightsBinge,
  type TonightsBingePick,
} from "@/components/home/tonights-binge";
import type { SimpleManga } from "@/lib/mangadex";

export const revalidate = 300;

const LONG_SERIES_CHAPTERS = 80;

function parseChapterCount(manga: SimpleManga) {
  if (!manga.lastChapter) return null;
  const count = Number.parseFloat(manga.lastChapter);
  if (!Number.isFinite(count) || count <= 0) return null;
  return Math.floor(count);
}

function isUpdatedThisWeek(manga: SimpleManga) {
  if (!manga.latestUploadedAt) return false;
  const latest = Date.parse(manga.latestUploadedAt);
  if (!Number.isFinite(latest)) return false;
  return Date.now() - latest <= 7 * 24 * 60 * 60 * 1000;
}

function bingeReason(manga: SimpleManga) {
  const chapterCount = parseChapterCount(manga);
  const chapterText = chapterCount
    ? `${chapterCount} ${chapterCount === 1 ? "chapter" : "chapters"}`
    : null;

  if (manga.status === "completed" && chapterText) {
    return `Completed · ${chapterText}`;
  }
  if (manga.status === "completed") return "Completed";
  if (isUpdatedThisWeek(manga) && chapterText) {
    return `Updated this week · ${chapterText}`;
  }
  if (chapterText) return `${chapterText} ready`;
  return null;
}

function isBingeCandidate(manga: SimpleManga) {
  const chapterCount = parseChapterCount(manga);
  return manga.status === "completed" || (chapterCount ?? 0) >= LONG_SERIES_CHAPTERS;
}

function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function uniqueManga(manga: SimpleManga[]) {
  const seen = new Set<string>();
  return manga.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function pickTonightsBinge(
  manga: SimpleManga[],
  excludedMangaId: string | undefined,
): TonightsBingePick | null {
  const candidates = uniqueManga(manga)
    .filter((item) => item.id !== excludedMangaId)
    .filter(isBingeCandidate)
    .map((item) => ({ manga: item, reason: bingeReason(item) }))
    .filter((item): item is TonightsBingePick => Boolean(item.reason));

  if (candidates.length === 0) return null;

  const dateKey = utcDateKey();
  return candidates.reduce((winner, candidate) => {
    const winnerScore = hashString(`${dateKey}:${winner.manga.id}`);
    const candidateScore = hashString(`${dateKey}:${candidate.manga.id}`);
    return candidateScore > winnerScore ? candidate : winner;
  });
}

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
  const basePopularRail = popular.filter((manga) => manga.id !== featured?.id);
  const shownPopularIds = new Set([
    ...(featured ? [featured.id] : []),
    ...basePopularRail.map((manga) => manga.id),
  ]);
  const baseLatestRail = latest.filter((manga) => !shownPopularIds.has(manga.id));
  const starterManga = [...basePopularRail, ...baseLatestRail].slice(0, 3);
  const starterMangaIds = new Set(starterManga.map((manga) => manga.id));
  let popularRail = basePopularRail.filter(
    (manga) => !starterMangaIds.has(manga.id),
  );
  let latestRail = baseLatestRail.filter(
    (manga) => !starterMangaIds.has(manga.id),
  );
  const tonightsBinge = pickTonightsBinge(
    [...popularRail, ...latestRail],
    featured?.id,
  );

  if (tonightsBinge) {
    popularRail = popularRail.filter(
      (manga) => manga.id !== tonightsBinge.manga.id,
    );
    latestRail = latestRail.filter(
      (manga) => manga.id !== tonightsBinge.manga.id,
    );
  }

  const heroSides = popularRail.slice(0, 2);
  const reservedContinueReadingIds = [
    ...(featured ? [featured.id] : []),
    ...(tonightsBinge ? [tonightsBinge.manga.id] : []),
    ...popularRail.map((manga) => manga.id),
    ...latestRail.map((manga) => manga.id),
  ];

  return (
    <div className="w-full">
      {featured && <Hero manga={featured} sideManga={heroSides} />}

      <div className="mx-auto w-full max-w-7xl space-y-[var(--section-gap)] px-4 py-10 sm:py-12">
        <ContinueReading
          starterManga={starterManga}
          reservedMangaIds={reservedContinueReadingIds}
        />

        <ReadingStats />

        <TonightsPlan />

        <NewForYou />

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

        {tonightsBinge && <TonightsBinge pick={tonightsBinge} />}

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
