import Link from "next/link";
import { BookOpen, Compass, Sparkles, TrendingUp } from "lucide-react";
import { coverUrl, type SimpleManga } from "@/lib/mangadex";
import { MangaCoverImage } from "@/components/manga/cover-image";
import {
  CoverTransitionElement,
  CoverTransitionLink,
} from "@/components/manga/cover-transition";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/manga/favorite-button";
import { cn } from "@/lib/utils";

export function Hero({
  manga,
  sideManga = [],
}: {
  manga: SimpleManga;
  sideManga?: SimpleManga[];
}) {
  const cover = coverUrl(manga.id, manga.coverFileName, 512);
  const sides = sideManga
    .map((m) => coverUrl(m.id, m.coverFileName, 256))
    .filter((c): c is string => Boolean(c))
    .slice(0, 2);
  const genre = manga.tags?.[0];
  const detailLine = [
    manga.status ? manga.status : null,
    manga.year ? String(manga.year) : null,
    manga.author,
  ].filter(Boolean);

  return (
    <section
      className="relative isolate overflow-hidden bg-surface-spotlight text-content-inverse"
      data-yomi-cover-transition-root
    >
      {/* Ambient backdrop: the spotlight's own cover, blurred, so the front
          door feels as immersive as the reader. Scrim preserves text contrast. */}
      {cover && (
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt=""
            className="h-full w-full scale-125 object-cover opacity-40 blur-2xl"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-surface-spotlight via-surface-spotlight/90 to-surface-spotlight/70 sm:to-surface-spotlight/55" />
        </div>
      )}
      <div className="relative z-10 mx-auto grid w-full max-w-7xl min-w-0 gap-8 px-4 py-8 sm:min-h-[500px] sm:gap-12 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:items-center lg:px-8 lg:py-6">
        <div className="yomi-rise-slow relative mx-auto w-[min(13rem,58vw)] sm:w-[19rem] lg:order-2 lg:w-[18rem]">
          <CoverCollage
            cover={cover}
            mangaId={manga.id}
            title={manga.title}
            sides={sides}
          />
        </div>

        <div className="yomi-rise yomi-delay-1 mx-0 w-full min-w-0 max-w-[22rem] space-y-4 text-center sm:mx-auto sm:max-w-3xl sm:space-y-6 lg:order-1 lg:mx-0 lg:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <Badge variant="inverse" className="w-fit px-3 py-1 text-sm font-semibold tracking-wide">
              Manga Orbit spotlight
            </Badge>
            {genre && (
              <Badge
                variant="inverse"
                className="inline-flex w-fit items-center gap-1.5 px-3 py-1 text-sm font-semibold capitalize tracking-wide"
              >
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                {genre} pick
              </Badge>
            )}
          </div>

          <div className="min-w-0 space-y-4 sm:space-y-6">
            <h1 className="max-w-full break-words [overflow-wrap:anywhere] text-3xl font-black leading-[1.08] tracking-tight [text-wrap:balance] sm:text-5xl lg:text-6xl">
              {manga.title}
            </h1>
            <p className="mx-auto line-clamp-3 max-w-full break-words text-base leading-relaxed text-content-inverse-muted [overflow-wrap:anywhere] sm:max-w-2xl sm:text-xl sm:leading-8 lg:mx-0">
              {manga.description || "A story-forward pick chosen for a quick first chapter."}
            </p>
          </div>

          {detailLine.length > 0 && (
            <div className="hidden justify-center text-sm font-medium capitalize text-content-inverse-muted sm:flex lg:justify-start">
              {detailLine.join(" · ")}
            </div>
          )}

          <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:hidden">
            <Link
              href="/browse?sort=popular"
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-control border border-line-inverse bg-surface-inverse-tint px-3 text-sm font-semibold text-content-inverse transition hover:bg-surface-inverse-tint/80 focus-visible:ring-reader-focus"
            >
              <Compass className="h-4 w-4" aria-hidden="true" />
              Popular
            </Link>
            <Link
              href="/browse?sort=latest"
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-control border border-line-inverse bg-surface-inverse-tint px-3 text-sm font-semibold text-content-inverse transition hover:bg-surface-inverse-tint/80 focus-visible:ring-reader-focus"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Latest
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 lg:justify-start pt-2">
            <CoverTransitionLink
              mangaId={manga.id}
              href={`/manga/${manga.id}`}
              prefetch={false}
              className={buttonClassName({
                size: "lg",
                className: "w-full min-w-0 bg-action-primary text-action-primary-foreground shadow-action-primary/20 hover:brightness-110 sm:w-auto",
              })}
            >
              <BookOpen className="h-5 w-5" aria-hidden="true" /> View chapters
            </CoverTransitionLink>
            <FavoriteButton
              mangaId={manga.id}
              title={manga.title}
              coverUrl={cover}
              variant="full"
              size="lg"
              className="w-full border border-line-inverse bg-surface-inverse-tint text-content-inverse hover:bg-surface-inverse-tint/80 sm:w-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// The fanned spotlight: featured cover in front, two supporting covers angled
// behind it. Supporting covers are decorative and dimmed so the lead pops.
function CoverCollage({
  cover,
  mangaId,
  title,
  sides,
}: {
  cover: string | null;
  mangaId: string;
  title: string;
  sides: string[];
}) {
  return (
    <div className="relative aspect-[2/3] w-full [perspective:1200px]">
      {sides[0] && (
        <CollageSide
          cover={sides[0]}
          className="absolute inset-y-7 left-0 z-0 w-[74%] -translate-x-[18%] -rotate-[8deg] sm:inset-y-6 sm:w-[78%] sm:-translate-x-[26%] sm:-rotate-[10deg]"
        />
      )}
      {sides[1] && (
        <CollageSide
          cover={sides[1]}
          className="absolute inset-y-7 right-0 z-0 w-[74%] translate-x-[18%] rotate-[8deg] sm:inset-y-6 sm:w-[78%] sm:translate-x-[26%] sm:rotate-[10deg]"
        />
      )}
      <CoverFrame
        cover={cover}
        mangaId={mangaId}
        title={title}
        sizes="(max-width: 640px) 192px, (max-width: 1024px) 304px, 288px"
        priority
        className="absolute inset-0 z-10"
      />
    </div>
  );
}

function CollageSide({ cover, className }: { cover: string; className: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "overflow-hidden rounded-cover border border-line-inverse/50 shadow-[var(--elevation-cover)]",
        className,
      )}
    >
      <div className="relative aspect-[2/3] w-full">
        <MangaCoverImage
          src={cover}
          alt=""
          fill
          sizes="(max-width: 640px) 150px, 240px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-surface-spotlight/50" />
      </div>
    </div>
  );
}

function CoverFrame({
  cover,
  mangaId,
  title,
  className,
  sizes,
  priority = false,
}: {
  cover: string | null;
  mangaId: string;
  title: string;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <CoverTransitionElement
      mangaId={mangaId}
      preferred
      className={cn(
        "relative z-10 aspect-[2/3] w-full overflow-hidden rounded-cover border border-line-inverse bg-surface-inverse-tint shadow-[var(--elevation-cover)]",
        className,
      )}
    >
      {cover ? (
        <MangaCoverImage
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
    </CoverTransitionElement>
  );
}
