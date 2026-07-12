import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { getChapters, getManga } from "@/lib/mangadex-server";
import {
  coverUrl,
  isReadable,
  pickFirstReadableChapter,
  sortChaptersByNumber,
} from "@/lib/mangadex";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { MangaCoverImage } from "@/components/manga/cover-image";
import { CoverTransitionElement } from "@/components/manga/cover-transition";
import { buttonClassName } from "@/components/ui/button";
import { FavoriteButton } from "@/components/manga/favorite-button";
import { Synopsis } from "@/components/manga/synopsis";
import { ChapterList } from "@/components/manga/chapter-list";
import { ContinueReadingCta } from "@/components/manga/continue-reading-cta";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AddToShelfButton } from "@/components/manga/add-to-shelf-button";
import { SeriesTintScope } from "@/components/manga/series-tint-scope";
import { SeriesTintCoverImage } from "@/components/manga/series-tint-cover-image";
import { getUserReadingAnalytics } from "@/lib/reading-analytics";

export const revalidate = 900;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const manga = await getManga(id);
  const title = manga?.title ?? "Manga";
  const description =
    manga?.description?.slice(0, 200) ||
    `Read ${title} online for free on ${SITE_NAME}.`;
  const cover = manga ? coverUrl(manga.id, manga.coverFileName, 512) : null;
  const canonical = `/manga/${id}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "book",
      title,
      description,
      url: canonical,
      images: cover ? [{ url: cover, width: 512, height: 728, alt: title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: cover ? [cover] : [],
    },
  };
}

export default async function MangaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const [manga, feed, shelves, readingAnalytics] = await Promise.all([
    getManga(id),
    // Fetch ascending so the earliest chapters are always in the window; a
    // desc + limit window drops chapter 1 for long series, breaking the picker.
    getChapters(id, { limit: 500, order: "asc" }),
    session?.user?.id
      ? prisma.shelf.findMany({
          where: { userId: session.user.id },
          include: { items: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    session?.user?.id
      ? getUserReadingAnalytics(session.user.id)
      : Promise.resolve(null),
  ]);

  if (!manga) notFound();

  const cover = coverUrl(manga.id, manga.coverFileName, 512);
  // Pick the readable chapter with the numerically smallest number (deduping
  // multiple scanlation-group rows per number, preferring a readable one).
  const firstChapter = pickFirstReadableChapter(feed.chapters);
  const readableCount = feed.chapters.filter(isReadable).length;
  // Numeric-ascending; the client ChapterList groups by volume and applies the
  // newest-first default + sort toggle. The Continue CTA also reads it ascending
  // to resolve the next chapter after a finished one.
  const sortedChapters = sortChaptersByNumber(feed.chapters);
  // All chapters are licensed/official links, so nothing can be read in-app.
  const licensedOnly = feed.chapters.length > 0 && readableCount === 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ComicSeries",
    name: manga.title,
    description: manga.description?.slice(0, 300) || undefined,
    image: cover || undefined,
    author: manga.author ? { "@type": "Person", name: manga.author } : undefined,
    genre: manga.tags.length ? manga.tags : undefined,
    url: `${SITE_URL}/manga/${manga.id}`,
    numberOfEpisodes: feed.total || undefined,
  };

  return (
    <div className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeriesTintScope mangaId={manga.id} className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-72 overflow-hidden">
          {cover && (
            <MangaCoverImage
              src={cover}
              alt=""
              fill
              // Blurred, 20%-opacity decoration — request a small variant instead
              // of letting `fill` default to sizes="100vw" (which fetches up to a
              // ~1536-1920px image for a layer no one reads).
              sizes="256px"
              className="object-cover opacity-20 blur-2xl"
            />
          )}
          <div
            aria-hidden="true"
            data-yomi-series-tint-consumer="detail-glow"
            className="absolute left-1/2 top-8 h-56 w-[min(48rem,92vw)] -translate-x-1/2 rounded-full opacity-25 blur-3xl [background:var(--series-tint)] dark:opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 pb-6 pt-8">
          <div className="flex flex-col items-center gap-5 text-center min-[480px]:flex-row min-[480px]:items-start min-[480px]:gap-6 min-[480px]:text-left">
            <div className="relative flex w-full justify-center min-[480px]:w-auto min-[480px]:justify-start">
              <div
                aria-hidden="true"
                data-yomi-series-tint-consumer="detail-cover-glow"
                className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl [background:var(--series-tint)] min-[480px]:hidden"
              />
              <CoverTransitionElement
                mangaId={manga.id}
                active
                className="relative aspect-[2/3] w-44 shrink-0 overflow-hidden rounded-cover border border-line-subtle bg-surface-muted shadow-2xl"
              >
                {cover ? (
                  <SeriesTintCoverImage
                    mangaId={manga.id}
                    src={cover}
                    alt={manga.title}
                    fill
                    loading="eager"
                    fetchPriority="high"
                    sizes="176px"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-muted-foreground">
                    No cover
                  </div>
                )}
              </CoverTransitionElement>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <h1 className="font-display mx-auto max-w-[24rem] text-2xl font-extrabold tracking-tight [text-wrap:balance] min-[480px]:mx-0 min-[480px]:max-w-none min-[480px]:text-2xl sm:text-3xl">
                  {manga.title}
                </h1>
                {manga.author && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {manga.author}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground min-[480px]:justify-start">
                {[
                  manga.status ? (
                    <span key="status" className="capitalize text-foreground">
                      {manga.status}
                    </span>
                  ) : null,
                  manga.year ? <span key="year">{manga.year}</span> : null,
                  ...manga.tags.slice(0, 5),
                ].filter(Boolean).map((item, i, arr) => (
                  <span key={i}>
                    {item}
                    {i < arr.length - 1 && (
                      <span className="ml-1.5 opacity-50">&middot;</span>
                    )}
                  </span>
                ))}
              </div>

              <div className="mx-auto flex w-full max-w-sm flex-wrap justify-center gap-2 min-[480px]:mx-0 min-[480px]:max-w-none min-[480px]:justify-start">
                {firstChapter && (
                  <Link
                    href={`/read/${firstChapter.id}`}
                    prefetch={false}
                    className={buttonClassName({
                      size: "lg",
                      className: "flex-1 min-[480px]:flex-none",
                    })}
                  >
                    <BookOpen className="h-5 w-5" /> Start reading
                  </Link>
                )}
                <ContinueReadingCta
                  mangaId={manga.id}
                  chapters={sortedChapters}
                />
                {session?.user?.id && (
                  <AddToShelfButton
                    shelves={shelves}
                    mangaId={manga.id}
                    title={manga.title}
                    coverUrl={cover}
                  />
                )}
                <FavoriteButton
                  mangaId={manga.id}
                  title={manga.title}
                  coverUrl={cover}
                  variant="full"
                  size="lg"
                />
              </div>

              <Synopsis text={manga.description} />
            </div>
          </div>
        </div>
      </SeriesTintScope>

      <div className="relative mx-auto max-w-5xl px-4 pb-8 pt-2">
        <div className="space-y-4">
          {licensedOnly && (
            <div className="rounded-card border border-warning-line bg-warning-surface p-4 text-sm text-warning-content">
              <p className="font-medium">
                This title is officially licensed
              </p>
              <p className="mt-1 text-warning-content/80">
                The publisher holds the rights, so chapters can’t be read here.
                Each chapter below links to the official source where you can read
                it legally. Please support the creators.
              </p>
            </div>
          )}
          <ChapterList
            chapters={sortedChapters}
            mangaId={manga.id}
            secondsPerPage={readingAnalytics?.averageSecondsPerPage}
            total={feed.total}
          />
        </div>
      </div>
    </div>
  );
}
