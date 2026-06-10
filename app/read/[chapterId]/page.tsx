import { notFound } from "next/navigation";
import {
  getChapterInfo,
  getChapterMangaId,
  getChapterPages,
  getChapters,
  getManga,
} from "@/lib/mangadex-server";
import { coverUrl, pageImageUrl } from "@/lib/mangadex";
import { Reader } from "@/components/reader/reader";
import { ExternalChapterNotice } from "@/components/reader/external-notice";

export const revalidate = 60;

export default async function ReadPage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const { chapterId } = await params;

  const [info, mangaId] = await Promise.all([
    getChapterInfo(chapterId),
    getChapterMangaId(chapterId),
  ]);

  if (!info) notFound();

  const [manga, feed] = await Promise.all([
    mangaId ? getManga(mangaId) : Promise.resolve(null),
    mangaId
      ? getChapters(mangaId, { order: "asc", limit: 500 })
      : Promise.resolve({ chapters: [], total: 0 }),
  ]);

  const idx = feed.chapters.findIndex((c) => c.id === chapterId);
  const prevId = idx > 0 ? feed.chapters[idx - 1].id : null;
  const nextId =
    idx >= 0 && idx < feed.chapters.length - 1 ? feed.chapters[idx + 1].id : null;

  const chapterLabel = info.chapter ? `Chapter ${info.chapter}` : "Oneshot";
  const cover = manga ? coverUrl(manga.id, manga.coverFileName, 256) : null;

  // External / licensed chapters have no in-app pages — show a notice instead.
  const pages =
    info.externalUrl || info.pages === 0 ? null : await getChapterPages(chapterId);

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

  const imageUrls = pages.data.map((_, i) => pageImageUrl(pages, i, false));

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
    />
  );
}
