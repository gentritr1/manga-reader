import { BookOpen } from "lucide-react";
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
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          Tonight&apos;s binge
        </h2>
        <p className="text-sm leading-6 text-content-secondary sm:text-base">
          A complete or long read from today&apos;s shelf.
        </p>
      </div>

      <article
        className="relative overflow-hidden rounded-card border border-line-shelf bg-surface-shelf p-4 shadow-[var(--elevation-shelf)] sm:grid sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-5 sm:p-5"
        data-yomi-cover-transition-root
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 [background:var(--shelf-edge)]"
        />

        <CoverTransitionLink
          mangaId={pick.manga.id}
          href={`/manga/${pick.manga.id}`}
          prefetch={false}
          aria-label={`Open ${pick.manga.title}`}
          className="group mx-auto block w-28 rounded-cover focus-visible:ring-2 focus-visible:ring-focus sm:mx-0 sm:w-full"
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
                sizes="(max-width: 640px) 112px, 136px"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="grid h-full place-items-center text-xs text-content-secondary">
                No cover
              </div>
            )}
          </CoverTransitionElement>
        </CoverTransitionLink>

        <div className="mt-4 flex min-w-0 flex-col items-center text-center sm:mt-0 sm:items-start sm:text-left">
          <p className="text-sm font-semibold text-discovery-foreground">
            {pick.reason}
          </p>
          <h3 className="mt-2 max-w-2xl text-2xl font-black tracking-tight text-content-primary [text-wrap:balance]">
            {pick.manga.title}
          </h3>
          {pick.manga.description && (
            <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-content-secondary">
              {pick.manga.description}
            </p>
          )}

          <div className="mt-5 flex w-full flex-col gap-2 sm:mt-auto sm:w-auto sm:flex-row">
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
