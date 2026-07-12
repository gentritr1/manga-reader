import { BookOpen, Sparkles } from "lucide-react";
import { coverUrl, type SimpleManga } from "@/lib/mangadex";
import { MangaCoverImage } from "@/components/manga/cover-image";
import {
  CoverTransitionElement,
  CoverTransitionLink,
} from "@/components/manga/cover-transition";
import { FavoriteButton } from "@/components/manga/favorite-button";
import { buttonClassName } from "@/components/ui/button";

export interface TonightsBingePick {
  manga: SimpleManga;
  reason: string;
}

export function TonightsBinge({ pick }: { pick: TonightsBingePick }) {
  const cover = coverUrl(pick.manga.id, pick.manga.coverFileName, 512);

  return (
    <section className="space-y-4">
      <div className="max-w-2xl space-y-1">
        <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          Tonight&apos;s binge
        </h2>
        <p className="text-sm leading-6 text-content-secondary sm:text-base">
          A complete or long read from today&apos;s shelf.
        </p>
      </div>

      <article
        className="relative overflow-hidden rounded-card border border-line-subtle bg-surface-shelf p-4 shadow-[var(--elevation-shelf)] sm:grid sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center sm:gap-6 sm:p-6"
        data-yomi-cover-transition-root
      >
        {/* Soft ambient glow behind the cover for depth — one restrained
            brand accent instead of a loud multi-color edge. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-brand-primary/12 blur-[90px] sm:h-72 sm:w-72"
        />

        <CoverTransitionLink
          mangaId={pick.manga.id}
          href={`/manga/${pick.manga.id}`}
          prefetch={false}
          aria-label={`Open ${pick.manga.title}`}
          className="group relative mx-auto block w-28 rounded-cover focus-visible:ring-2 focus-visible:ring-focus sm:mx-0 sm:w-full"
        >
          <CoverTransitionElement
            mangaId={pick.manga.id}
            className="relative aspect-[2/3] w-full overflow-hidden rounded-cover border border-line-subtle bg-surface-muted shadow-[var(--elevation-cover)]"
          >
            {cover ? (
              <MangaCoverImage
                src={cover}
                alt={`${pick.manga.title} cover`}
                fill
                sizes="(max-width: 640px) 112px, 144px"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="grid h-full place-items-center text-xs text-content-secondary">
                No cover
              </div>
            )}
          </CoverTransitionElement>
        </CoverTransitionLink>

        <div className="relative mt-4 flex min-w-0 flex-col items-center text-center sm:mt-0 sm:items-start sm:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-discovery-line bg-discovery-surface px-2.5 py-1 text-xs font-semibold text-discovery-foreground">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {pick.reason}
          </span>
          <h3 className="mt-3 max-w-2xl text-2xl font-black tracking-tight text-content-primary [text-wrap:balance]">
            {pick.manga.title}
          </h3>
          {pick.manga.description && (
            <p className="mt-2.5 line-clamp-2 max-w-2xl text-sm leading-6 text-content-secondary">
              {pick.manga.description}
            </p>
          )}

          <div className="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <CoverTransitionLink
              mangaId={pick.manga.id}
              href={`/manga/${pick.manga.id}`}
              prefetch={false}
              className={buttonClassName({
                size: "lg",
                className:
                  "w-full bg-action-primary text-action-primary-foreground hover:brightness-110 sm:w-auto",
              })}
            >
              <BookOpen className="h-5 w-5" aria-hidden="true" />
              Start chapter 1
            </CoverTransitionLink>
            <FavoriteButton
              mangaId={pick.manga.id}
              title={pick.manga.title}
              coverUrl={cover}
              variant="full"
              size="lg"
              compactMobileLabel={false}
              className="w-full sm:w-auto"
            />
          </div>
        </div>
      </article>
    </section>
  );
}
