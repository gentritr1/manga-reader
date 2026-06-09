import Image from "next/image";
import Link from "next/link";
import { BookOpen, Compass } from "lucide-react";
import { coverUrl, type SimpleManga } from "@/lib/mangadex";
import { buttonClassName } from "@/components/ui/button";
import { FavoriteButton } from "@/components/manga/favorite-button";

export function Hero({
  manga,
  supportingManga = [],
}: {
  manga: SimpleManga;
  supportingManga?: SimpleManga[];
}) {
  const cover = coverUrl(manga.id, manga.coverFileName, 512);
  const supportingCovers = supportingManga
    .map((item) => ({
      id: item.id,
      cover: coverUrl(item.id, item.coverFileName, 256),
    }))
    .filter((item) => item.cover)
    .slice(0, 4);
  const tags = manga.tags.slice(0, 3);
  const detailLine = [
    manga.status ? manga.status : null,
    manga.year ? String(manga.year) : null,
    manga.author,
  ].filter(Boolean);

  return (
    <section className="relative isolate overflow-hidden bg-spotlight text-spotlight-foreground">
      {cover && (
        <Image
          src={cover}
          alt=""
          fill
          loading="eager"
          sizes="100vw"
          className="object-cover object-center opacity-35 blur-2xl"
        />
      )}
      <div className="absolute inset-0 bg-spotlight/80" />
      <div className="absolute inset-0 bg-gradient-to-r from-spotlight via-spotlight/90 to-spotlight/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-spotlight via-transparent to-transparent" />

      <div className="relative mx-auto grid min-h-[560px] w-full max-w-7xl min-w-0 gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,480px)] lg:items-center lg:px-8">
        <div className="min-w-0 max-w-3xl space-y-5">
          <p className="inline-flex rounded-full border border-spotlight-foreground/20 bg-spotlight-foreground/10 px-3 py-1 text-sm font-medium text-spotlight-foreground/90">
            Yomi spotlight
          </p>
          <div className="space-y-4">
            <h1 className="max-w-4xl break-words text-4xl font-black tracking-tight sm:text-6xl">
              Open with {manga.title}
            </h1>
            <p className="line-clamp-4 max-w-2xl break-words text-base leading-7 text-spotlight-foreground/80 sm:text-lg sm:leading-8">
              {manga.description ||
                "A spotlight pick from today's shelf, ready for a first chapter or a quiet save for later."}
            </p>
          </div>

          {(tags.length > 0 || detailLine.length > 0) && (
            <div className="flex flex-wrap gap-2 text-sm">
              {detailLine.length > 0 && (
                <span className="max-w-full break-words rounded-full border border-spotlight-foreground/20 bg-spotlight-foreground/10 px-3 py-1 text-spotlight-foreground/75">
                  {detailLine.join(" / ")}
                </span>
              )}
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="max-w-full break-words rounded-full border border-spotlight-foreground/15 bg-spotlight-foreground/10 px-3 py-1 text-spotlight-foreground/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={`/manga/${manga.id}`}
              className={buttonClassName({
                size: "lg",
                className:
                  "bg-accent-warm text-spotlight shadow-accent-warm/20 hover:opacity-95",
              })}
            >
              <BookOpen className="h-5 w-5" /> Read spotlight
            </Link>
            <FavoriteButton
              mangaId={manga.id}
              title={manga.title}
              coverUrl={cover}
              variant="full"
              className="border border-spotlight-foreground/20 bg-spotlight-foreground/10 text-spotlight-foreground hover:bg-spotlight-foreground/15"
            />
            <Link
              href="/browse?sort=popular"
              className={buttonClassName({
                variant: "outline",
                size: "lg",
                className:
                  "border-spotlight-foreground/20 bg-transparent text-spotlight-foreground hover:bg-spotlight-foreground/10",
              })}
            >
              <Compass className="h-5 w-5" /> Browse the heat
            </Link>
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-[28rem] items-center justify-center pb-6 lg:pb-0">
          {supportingCovers.length > 0 && (
            <div className="absolute right-0 top-8 hidden w-36 grid-cols-2 gap-3 sm:grid lg:w-40">
              {supportingCovers.map((item, index) => (
                <div
                  key={item.id}
                  className="relative aspect-[2/3] overflow-hidden rounded-lg border border-spotlight-foreground/20 bg-spotlight-foreground/10 shadow-2xl shadow-black/25"
                  style={{ transform: `translateY(${index % 2 ? 24 : 0}px)` }}
                >
                  <Image
                    src={item.cover as string}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="relative z-10 aspect-[2/3] w-[min(70vw,18rem)] overflow-hidden rounded-xl border border-spotlight-foreground/20 bg-spotlight-foreground/10 shadow-2xl shadow-black/35 sm:w-80">
            {cover ? (
              <Image
                src={cover}
                alt={`${manga.title} cover`}
                fill
                loading="eager"
                fetchPriority="high"
                sizes="(max-width: 640px) 70vw, 320px"
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center p-6 text-center text-sm text-spotlight-foreground/70">
                Cover coming soon
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
