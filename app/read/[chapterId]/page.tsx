import { notFound } from "next/navigation";
import {
  getChapterInfo,
  getChapterPages,
  getChapters,
  getManga,
} from "@/lib/mangadex-server";
import { coverUrl, pageImageUrl } from "@/lib/mangadex";
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

  // External / licensed chapters have no in-app pages, so skip the pages fetch.
  const needPages = !(info.externalUrl || info.pages === 0);
  const [manga, feed, pages] = await Promise.all([
    mangaId ? getManga(mangaId) : Promise.resolve(null),
    mangaId
      ? getChapters(mangaId, { order: "asc", limit: 500 })
      : Promise.resolve({ chapters: [], total: 0 }),
    needPages ? getChapterPages(chapterId) : Promise.resolve(null),
  ]);

  const idx = feed.chapters.findIndex((c) => c.id === chapterId);
  const prevId = idx > 0 ? feed.chapters[idx - 1].id : null;
  const nextId =
    idx >= 0 && idx < feed.chapters.length - 1 ? feed.chapters[idx + 1].id : null;

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

  const useDataSaver = false;
  const imageUrls = pages.data.map((_, i) => pageImageUrl(pages, i, useDataSaver));

  return (
    <Reader
      key={chapterId}
      chapterId={chapterId}
      imageUrls={imageUrls}
      useDataSaver={useDataSaver}
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
