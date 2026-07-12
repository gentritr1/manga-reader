import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  getChapterInfo,
  getChapterPages,
  getChapters,
  getManga,
} from "@/lib/mangadex-server";
import { chapterPageProxyUrl, coverUrl, sortChaptersByNumber } from "@/lib/mangadex";
import {
  READING_LANGUAGE_COOKIE,
  normalizeReadingLanguage,
} from "@/lib/reading-language";
import { Reader } from "@/components/reader/reader";
import { ExternalChapterNotice } from "@/components/reader/external-notice";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

export default async function ReadPage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const { chapterId } = await params;

  const [info, session] = await Promise.all([
    getChapterInfo(chapterId),
    auth(),
  ]);

  if (!info) notFound();
  const mangaId = info.mangaId;
  // Reader's global language preference (yomi-language cookie). Absent → "en".
  // Neighbor prev/next are resolved from a feed in this language; if the current
  // chapter isn't part of it, neighbors simply resolve to null (safe fallback).
  const language = normalizeReadingLanguage(
    (await cookies()).get(READING_LANGUAGE_COOKIE)?.value,
  );

  // External / licensed chapters have no in-app pages, so skip the pages fetch.
  const needPages = !(info.externalUrl || info.pages === 0);
  const [manga, feed, pages] = await Promise.all([
    mangaId ? getManga(mangaId) : Promise.resolve(null),
    mangaId
      ? // Neighbors only need chapter ids + numbers for ordering, so skip the
        // scanlation_group expansion to trim the per-row payload of this feed.
        getChapters(mangaId, {
          order: "asc",
          limit: 500,
          includeScanlationGroup: false,
          translatedLanguage: language,
        })
      : Promise.resolve({ chapters: [], total: 0 }),
    needPages ? getChapterPages(chapterId) : Promise.resolve(null),
  ]);

  // Numeric ordering (shared with the manga page) so prev/next follow chapter
  // numbers, not the raw feed order. Not deduped: the current chapter's own row
  // must stay in the list for findIndex to locate it.
  const orderedChapters = sortChaptersByNumber(feed.chapters);
  const idx = orderedChapters.findIndex((c) => c.id === chapterId);
  const prevId = idx > 0 ? orderedChapters[idx - 1].id : null;
  const nextId =
    idx >= 0 && idx < orderedChapters.length - 1
      ? orderedChapters[idx + 1].id
      : null;

  const chapterLabel = info.chapter ? `Chapter ${info.chapter}` : "Oneshot";
  const cover = manga ? coverUrl(manga.id, manga.coverFileName, 256) : null;

  // External / licensed chapters have no in-app pages, so show a notice instead.
  if (!pages || pages.data.length === 0) {
    if (info.externalUrl) {
      return (
        <ExternalChapterNotice
          externalUrl={info.externalUrl}
          mangaId={mangaId}
          mangaTitle={manga?.title ?? "Manga"}
          chapterLabel={chapterLabel}
          prevId={prevId}
          nextId={nextId}
        />
      );
    }
    notFound();
  }

  let recap = null;
  let initialProgressPage: number | null = null;
  let initialProgressTotalPages: number | null = null;
  let initialProgressUpdatedAt: string | null = null;
  if (session?.user?.id && mangaId) {
    const progress = await prisma.readingProgress.findUnique({
      where: { userId_mangaId: { userId: session.user.id, mangaId } },
    });
    if (progress) {
      if (progress.chapterId === chapterId) {
        initialProgressPage = progress.page;
        initialProgressTotalPages = progress.totalPages;
        initialProgressUpdatedAt = progress.updatedAt.toISOString();
      }
      const daysSince = (new Date().getTime() - progress.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 7) {
        recap = `Welcome back. It's been ${Math.floor(daysSince)} days since you last read ${progress.chapter ? `Chapter ${progress.chapter}` : "a chapter"}. Pick up from there.`;
      }
    }
  }

  // Render through the same-origin proxy; the direct at-home URL errors in the
  // browser. The proxy fetches upstream server-side and streams the bytes. These
  // are the original-quality URLs used for SSR/hydration; the client reader
  // re-points them to the data-saver variant after mount when the resolved
  // image-quality setting calls for it (see components/reader/reader.tsx).
  const imageUrls = pages.data.map((_, i) =>
    chapterPageProxyUrl(chapterId, i + 1, false),
  );

  return (
    <Reader
      key={chapterId}
      chapterId={chapterId}
      imageUrls={imageUrls}
      chapterLabel={chapterLabel}
      chapterTitle={info.title ?? null}
      mangaId={mangaId}
      mangaTitle={manga?.title ?? "Manga"}
      coverUrl={cover}
      prevId={prevId}
      nextId={nextId}
      recap={recap}
      initialProgressPage={initialProgressPage}
      initialProgressTotalPages={initialProgressTotalPages}
      initialProgressUpdatedAt={initialProgressUpdatedAt}
    />
  );
}
