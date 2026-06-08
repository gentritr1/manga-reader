import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { getChapters, getManga } from "@/lib/mangadex-server";
import { coverUrl, isReadable } from "@/lib/mangadex";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/manga/favorite-button";
import { Synopsis } from "@/components/manga/synopsis";
import { ChapterList } from "@/components/manga/chapter-list";
import { AdSlot } from "@/components/ads/ad-slot";

export const revalidate = 900;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const manga = await getManga(id);
  return {
    title: manga?.title ?? "Manga",
    description: manga?.description?.slice(0, 160),
  };
}

export default async function MangaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [manga, feed] = await Promise.all([
    getManga(id),
    getChapters(id, { limit: 200, order: "desc" }),
  ]);

  if (!manga) notFound();

  const cover = coverUrl(manga.id, manga.coverFileName, 512);
  // feed is newest-first; the earliest readable chapter is the last readable one.
  const firstChapter = [...feed.chapters].reverse().find(isReadable);
  const readableCount = feed.chapters.filter(isReadable).length;
  // All chapters are licensed/official links — nothing can be read in-app.
  const licensedOnly = feed.chapters.length > 0 && readableCount === 0;

  return (
    <div className="relative">
      {/* Backdrop */}
      <div className="absolute inset-x-0 top-0 h-72 overflow-hidden">
        {cover && (
          <Image src={cover} alt="" fill priority className="object-cover opacity-20 blur-2xl" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="relative mx-auto aspect-[2/3] w-44 shrink-0 overflow-hidden rounded-xl border border-border shadow-2xl sm:mx-0">
            {cover ? (
              <Image src={cover} alt={manga.title} fill sizes="176px" className="object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-xs text-muted-foreground">
                No cover
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {manga.title}
              </h1>
              {manga.author && (
                <p className="mt-1 text-sm text-muted-foreground">{manga.author}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {manga.status && (
                <Badge className="capitalize">{manga.status}</Badge>
              )}
              {manga.year && <Badge>{manga.year}</Badge>}
              {manga.tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {firstChapter && (
                <Link href={`/read/${firstChapter.id}`}>
                  <Button size="lg">
                    <BookOpen className="h-5 w-5" /> Start reading
                  </Button>
                </Link>
              )}
              <FavoriteButton
                mangaId={manga.id}
                title={manga.title}
                coverUrl={cover}
                variant="full"
              />
            </div>

            <Synopsis text={manga.description} />
          </div>
        </div>

        <div className="my-8">
          <AdSlot placement="banner" />
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">
            Chapters{" "}
            <span className="text-base font-normal text-muted-foreground">
              ({feed.total})
            </span>
          </h2>
          {licensedOnly && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">
                This title is officially licensed
              </p>
              <p className="mt-1 text-muted-foreground">
                The publisher holds the rights, so chapters can’t be read here.
                Each chapter below links to the official source where you can read
                it legally — please support the creators.
              </p>
            </div>
          )}
          <ChapterList chapters={feed.chapters} />
        </div>
      </div>
    </div>
  );
}
