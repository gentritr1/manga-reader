import Image from "next/image";
import Link from "next/link";
import { BookOpen, Compass, Sparkles } from "lucide-react";
import { coverUrl, type SimpleManga } from "@/lib/mangadex";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/manga/favorite-button";
import { cn } from "@/lib/utils";

export function Hero({
  manga,
}: {
  manga: SimpleManga;
}) {
  const cover = coverUrl(manga.id, manga.coverFileName, 512);
  const detailLine = [
    manga.status ? manga.status : null,
    manga.year ? String(manga.year) : null,
    manga.author,
  ].filter(Boolean);

  return (
    <section className="relative isolate overflow-hidden bg-surface-spotlight text-content-inverse">
      <div className="relative mx-auto grid w-full max-w-7xl min-w-0 gap-6 px-4 py-6 sm:min-h-[500px] sm:gap-12 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-center lg:px-8 lg:py-6">
        <div className="relative mx-auto w-full max-w-[9rem] sm:max-w-[24rem] lg:order-2">
          <CoverFrame
            cover={cover}
            title={manga.title}
            sizes="(max-width: 640px) 160px, (max-width: 1024px) 80vw, 400px"
            priority
          />
        </div>

        <div className="mx-0 w-full min-w-0 max-w-[22rem] space-y-4 text-center sm:mx-auto sm:max-w-3xl sm:space-y-6 lg:order-1 lg:mx-0 lg:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <Badge variant="inverse" className="w-fit px-3 py-1 text-sm font-semibold tracking-wide">
              Spotlight
            </Badge>
          </div>

          <div className="min-w-0 space-y-4 sm:space-y-6">
            <h1 className="max-w-full break-all text-3xl font-black leading-[1.08] tracking-tight sm:break-normal sm:text-5xl sm:[overflow-wrap:anywhere] sm:[text-wrap:balance] lg:text-6xl">
              {manga.title}
            </h1>
            <p className="mx-auto line-clamp-3 max-w-full break-words text-base leading-relaxed text-content-inverse-muted [overflow-wrap:anywhere] sm:max-w-2xl sm:text-xl sm:leading-8 lg:mx-0">
              {manga.description || "A story-forward pick chosen for a quick first chapter."}
            </p>
          </div>

          {detailLine.length > 0 && (
            <div className="hidden justify-center text-sm font-medium text-content-inverse-muted sm:flex lg:justify-start">
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
            <Link
              href={`/manga/${manga.id}`}
              className={buttonClassName({
                size: "lg",
                className: "w-full min-w-0 bg-action-primary text-action-primary-foreground shadow-action-primary/20 hover:brightness-110 sm:w-auto",
              })}
            >
              <BookOpen className="h-5 w-5" aria-hidden="true" /> View chapters
            </Link>
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
        "relative z-10 aspect-[2/3] w-full overflow-hidden rounded-cover border border-line-inverse bg-surface-inverse-tint shadow-2xl",
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
