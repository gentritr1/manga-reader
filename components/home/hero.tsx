import Image from "next/image";
import Link from "next/link";
import { BookOpen, Compass, TrendingUp } from "lucide-react";
import { coverUrl, type SimpleManga } from "@/lib/mangadex";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/manga/favorite-button";
import { SearchBar } from "@/components/layout/search-bar";
import { cn } from "@/lib/utils";

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
      title: item.title,
      cover: coverUrl(item.id, item.coverFileName, 256),
    }))
    .filter((item) => item.cover)
    .slice(0, 4);
  const tags = manga.tags.slice(0, 3);
  const moodTags = manga.tags.slice(0, 2);
  const spotlightReason = getSpotlightReason(manga);
  const detailLine = [
    manga.status ? manga.status : null,
    manga.year ? String(manga.year) : null,
    manga.author,
  ].filter(Boolean);

  return (
    <section className="relative isolate overflow-hidden bg-surface-spotlight text-content-inverse">
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
      <div className="absolute inset-0 bg-overlay-spotlight" />
      <div className="absolute inset-0 bg-gradient-to-r from-surface-spotlight via-surface-spotlight/90 to-surface-spotlight/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-surface-spotlight via-transparent to-transparent" />

      <div className="relative mx-auto grid w-full max-w-7xl min-w-0 gap-4 px-4 py-5 sm:min-h-[540px] sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(320px,480px)] lg:items-center lg:px-8">
        <div className="min-w-0 max-w-3xl mx-auto lg:mx-0 space-y-3 text-center sm:space-y-5 lg:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <Badge variant="inverse" className="w-fit px-3 py-1 text-sm text-content-inverse">
              Yomi spotlight
            </Badge>
            <Badge variant="discovery" className="w-fit gap-1 px-3 py-1 text-sm">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              {spotlightReason}
            </Badge>
          </div>

          <MobileCoverStage
            cover={cover}
            title={manga.title}
            supportingCovers={supportingCovers}
          />

          <div className="min-w-0 space-y-3 sm:space-y-4">
            <h1 className="max-w-full break-words text-[2rem] font-black leading-[1.05] tracking-tight [overflow-wrap:anywhere] [text-wrap:wrap] sm:text-5xl sm:[text-wrap:balance] lg:text-6xl">
              {manga.title}
            </h1>
            <p className="line-clamp-2 max-w-full break-words text-base leading-7 text-content-inverse-muted [overflow-wrap:anywhere] max-[380px]:line-clamp-1 sm:line-clamp-4 sm:max-w-2xl sm:text-lg sm:leading-8 mx-auto lg:mx-0">
              {manga.description ||
                "A story-forward pick chosen for a quick first chapter."}
            </p>
          </div>

          <div className="space-y-2 lg:hidden">
            <SearchBar
              placeholder="Search a title or mood"
              className="mx-auto max-w-xl lg:mx-0"
              inputClassName="border-line-inverse bg-surface-inverse-tint text-content-inverse placeholder:text-content-inverse-muted focus-visible:ring-content-inverse"
              iconClassName="text-content-inverse-muted"
            />
            <div className="hidden flex-wrap justify-center gap-2 text-sm sm:flex lg:hidden">
              <Link
                href="/browse?sort=popular"
                className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line-inverse bg-surface-inverse-tint px-3 font-medium text-content-inverse-muted transition hover:text-content-inverse focus-visible:text-content-inverse"
              >
                <Compass className="h-4 w-4" aria-hidden="true" />
                Popular
              </Link>
              <Link
                href="/browse?sort=latest"
                className="inline-flex min-h-10 items-center rounded-full border border-line-inverse bg-surface-inverse-tint px-3 font-medium text-content-inverse-muted transition hover:text-content-inverse focus-visible:text-content-inverse"
              >
                Latest updates
              </Link>
            </div>
          </div>

          {(tags.length > 0 || detailLine.length > 0) && (
            <div className="hidden flex-wrap justify-center gap-2 text-sm sm:flex lg:justify-start">
              {detailLine.length > 0 && (
                <Badge variant="inverse" className="max-w-full break-words px-3 py-1">
                  {detailLine.join(" / ")}
                </Badge>
              )}
              {moodTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="inverse"
                  className="max-w-full break-words px-3 py-1"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 sm:flex-wrap lg:justify-start lg:pt-2">
            <Link
              href={`/manga/${manga.id}`}
              className={buttonClassName({
                size: "lg",
                className:
                  "min-w-0 flex-1 bg-action-primary text-action-primary-foreground shadow-action-primary/20 hover:brightness-110 sm:flex-none",
              })}
            >
              <BookOpen className="h-5 w-5" aria-hidden="true" /> View chapters
            </Link>
            <FavoriteButton
              mangaId={manga.id}
              title={manga.title}
              coverUrl={cover}
              className="h-12 w-12 border border-line-inverse bg-surface-inverse-tint text-content-inverse hover:bg-surface-inverse-tint/80 sm:hidden"
            />
            <FavoriteButton
              mangaId={manga.id}
              title={manga.title}
              coverUrl={cover}
              variant="full"
              size="lg"
              className="hidden border border-line-inverse bg-surface-inverse-tint text-content-inverse hover:bg-surface-inverse-tint/80 sm:inline-flex"
            />
          </div>
        </div>

        <div className="relative hidden w-full max-w-[28rem] items-center justify-center pb-6 sm:mx-auto sm:pb-6 lg:flex lg:pb-0">
          {supportingCovers.length > 0 && (
            <div className="absolute right-0 top-8 hidden w-36 grid-cols-2 gap-3 lg:grid lg:w-40">
              {supportingCovers.map((item, index) => (
                <Link
                  key={item.id}
                  href={`/manga/${item.id}`}
                  aria-label={`Open ${item.title}`}
                  className="relative aspect-[2/3] overflow-hidden rounded-cover border border-line-inverse bg-surface-inverse-tint [box-shadow:var(--elevation-cover)] focus-visible:ring-2 focus-visible:ring-content-inverse"
                  style={{ transform: `translateY(${index % 2 ? 24 : 0}px)` }}
                >
                  <Image
                    src={item.cover as string}
                    alt=""
                    fill
                    loading="eager"
                    sizes="96px"
                    className="object-cover transition duration-300 hover:scale-105"
                  />
                </Link>
              ))}
            </div>
          )}

          <CoverFrame
            cover={cover}
            title={manga.title}
            className="w-[var(--cover-spotlight-desktop)]"
            sizes="320px"
            priority
          />
        </div>
      </div>
    </section>
  );
}

function getSpotlightReason(manga: SimpleManga) {
  if (manga.lastChapter) return `Chapters up to ${manga.lastChapter}`;
  if (manga.tags[0]) return `${manga.tags[0]} pick`;
  if (manga.status === "ongoing") return "Ongoing pick";
  return "Quick first chapter";
}

function MobileCoverStage({
  cover,
  title,
  supportingCovers,
}: {
  cover: string | null;
  title: string;
  supportingCovers: Array<{ id: string; title: string; cover: string | null }>;
}) {
  return (
    <div className="relative flex min-h-[calc(var(--cover-spotlight-mobile)*1.14)] items-center justify-center lg:hidden">
      {supportingCovers.slice(0, 2).map((item, index) => (
        <Link
          key={item.id}
          href={`/manga/${item.id}`}
          aria-label={`Open ${item.title}`}
          className={cn(
            "absolute aspect-[2/3] w-[calc(var(--cover-spotlight-mobile)*0.52)] overflow-hidden rounded-cover border border-line-inverse bg-surface-inverse-tint opacity-75 [box-shadow:var(--elevation-cover)] focus-visible:ring-2 focus-visible:ring-content-inverse",
            index === 0
              ? "left-1/2 -translate-x-[8.5rem] rotate-[-7deg]"
              : "left-1/2 translate-x-[3.5rem] rotate-[7deg]",
          )}
        >
          {item.cover ? (
            <Image
              src={item.cover}
              alt=""
              fill
              loading="eager"
              sizes="96px"
              className="object-cover"
            />
          ) : null}
        </Link>
      ))}
      <CoverFrame
        cover={cover}
        title={title}
        className="w-[var(--cover-spotlight-mobile)]"
        sizes="(max-width: 640px) 46vw, 224px"
        priority
      />
    </div>
  );
}

function CoverFrame({
  cover,
  title,
  className,
  sizes,
  priority = false,
}: {
  cover: string | null;
  title: string;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative z-10 aspect-[2/3] overflow-hidden rounded-cover border border-line-inverse bg-surface-inverse-tint [box-shadow:var(--elevation-cover)]",
        className,
      )}
    >
      {cover ? (
        <Image
          src={cover}
          alt={`${title} cover`}
          fill
          loading="eager"
          fetchPriority={priority ? "high" : undefined}
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <div className="grid h-full place-items-center p-4 text-center text-sm text-content-inverse-muted">
          Cover coming soon
        </div>
      )}
    </div>
  );
}
