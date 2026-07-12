import { coverUrl, type SimpleManga } from "@/lib/mangadex";
import { FavoriteButton } from "./favorite-button";
import { Badge } from "@/components/ui/badge";
import { MangaCoverImage } from "@/components/manga/cover-image";
import {
  CoverTransitionElement,
  CoverTransitionLink,
} from "@/components/manga/cover-transition";

// One dot color per status; the pill surface stays constant across every badge.
const STATUS_DOT: Record<string, string> = {
  ongoing: "bg-status-ongoing",
  completed: "bg-status-completed",
  hiatus: "bg-status-hiatus",
  cancelled: "bg-status-cancelled",
  unknown: "bg-status-unknown",
};

export function MangaCard({
  manga,
  eager = false,
  renderCover = true,
}: {
  manga: SimpleManga;
  eager?: boolean;
  /**
   * When false, the cover image element is not mounted. The aspect-[2/3] box
   * still reserves identical space, so toggling this never shifts layout. The
   * browse grid flips this off for cards far outside the viewport to bound the
   * number of decoded cover images held in memory (image windowing). Defaults
   * to true so every other usage (home, shelves) is unaffected.
   */
  renderCover?: boolean;
}) {
  const cover = coverUrl(manga.id, manga.coverFileName, 512);

  return (
    <article
      className="group flex flex-col gap-2.5"
      data-yomi-cover-transition-root
    >
      <div className="relative">
        <CoverTransitionLink
          mangaId={manga.id}
          href={`/manga/${manga.id}`}
          prefetch={false}
          aria-label={`Open ${manga.title}`}
          className="block rounded-cover focus-visible:ring-2 focus-visible:ring-focus"
        >
          <CoverTransitionElement
            mangaId={manga.id}
            className="relative aspect-[2/3] w-full overflow-hidden rounded-cover border border-line-subtle bg-surface-muted shadow-sm transition duration-300 group-hover:-translate-y-0.5 group-hover:border-line-shelf group-hover:shadow-[var(--elevation-hover)]"
          >
            {!cover ? (
              <div className="grid h-full place-items-center text-xs text-content-secondary">
                No cover
              </div>
            ) : renderCover ? (
              <MangaCoverImage
                src={cover}
                alt={manga.title}
                fill
                loading={eager ? "eager" : "lazy"}
                fetchPriority={eager ? "high" : "auto"}
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 200px"
                className="object-cover transition duration-200 ease-out group-hover:scale-[1.04]"
              />
            ) : null}

            {/* Bottom scrim keeps overlay chrome legible over any artwork. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-spotlight/60 to-transparent"
            />

            {manga.status && (
              <Badge
                variant="status"
                className="absolute left-2 top-2 gap-1.5 px-2 py-0.5 text-[11px] font-semibold capitalize"
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[manga.status] ?? STATUS_DOT.unknown}`}
                />
                {manga.status}
              </Badge>
            )}

            {manga.lastChapter && (
              <Badge
                variant="chapter"
                className="absolute bottom-2 left-2 px-2 py-0.5 text-[11px] font-semibold"
              >
                Ch. {manga.lastChapter}
              </Badge>
            )}
          </CoverTransitionElement>
        </CoverTransitionLink>

        {/* Favorite lives on the cover, top-right: resting quietly, lifting into
            focus on hover/keyboard so the affordance is part of the tile.
            Hit-area pattern: the visual pill stays a compact 36px (h-9 w-9) so it
            doesn't dominate the cover, but `after:-inset-1` extends an invisible
            pseudo-element 4px on every side → a 44px (WCAG 2.5.8) tap target
            without inflating the visual. Reused wherever a control must read
            small but stay thumb-friendly. */}
        <FavoriteButton
          mangaId={manga.id}
          title={manga.title}
          coverUrl={cover}
          className="absolute right-2 top-2 h-9 w-9 opacity-0 transition duration-200 after:absolute after:-inset-1 after:content-[''] focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 max-[640px]:opacity-100"
        />
      </div>

      <h3 className="min-h-[2.5rem] text-sm font-medium leading-snug">
        <CoverTransitionLink
          mangaId={manga.id}
          href={`/manga/${manga.id}`}
          prefetch={false}
          title={manga.title}
          className="line-clamp-2 rounded-sm transition hover:text-brand-primary focus-visible:text-brand-primary"
        >
          {manga.title}
        </CoverTransitionLink>
      </h3>
    </article>
  );
}
