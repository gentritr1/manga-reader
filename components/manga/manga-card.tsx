import Image from "next/image";
import Link from "next/link";
import { coverUrl, type SimpleManga } from "@/lib/mangadex";
import { FavoriteButton } from "./favorite-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  ongoing: "bg-status-ongoing text-status-ongoing-foreground",
  completed: "bg-status-completed text-status-completed-foreground",
  hiatus: "bg-status-hiatus text-status-hiatus-foreground",
  cancelled: "bg-status-cancelled text-status-cancelled-foreground",
  unknown: "bg-status-unknown text-status-unknown-foreground",
};

export function MangaCard({
  manga,
  eager = false,
}: {
  manga: SimpleManga;
  eager?: boolean;
}) {
  const cover = coverUrl(manga.id, manga.coverFileName, 512);

  return (
    <article className="group flex flex-col gap-3">
      <Link
        href={`/manga/${manga.id}`}
        aria-label={`Open ${manga.title}`}
        className="block rounded-cover focus-visible:ring-2 focus-visible:ring-focus"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-cover border border-line-subtle bg-surface-muted">
          {cover ? (
            <Image
              src={cover}
              alt={manga.title}
              fill
              loading={eager ? "eager" : "lazy"}
              fetchPriority={eager ? "high" : "auto"}
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 200px"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full place-items-center text-xs text-content-secondary">
              No cover
            </div>
          )}

          {manga.status && (
            <span
              className={cn(
                "absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold capitalize shadow-sm",
                STATUS_STYLES[manga.status] ?? STATUS_STYLES.unknown,
              )}
            >
              {manga.status}
            </span>
          )}

          {manga.lastChapter && (
            <Badge variant="chapter" className="absolute bottom-2 left-2 px-2 py-0.5 text-xs backdrop-blur rounded-md">
              Ch. {manga.lastChapter}
            </Badge>
          )}
        </div>
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium leading-snug">
          <Link
            href={`/manga/${manga.id}`}
            className="line-clamp-2 block rounded-sm transition hover:text-brand-primary focus-visible:text-brand-primary"
          >
            {manga.title}
          </Link>
        </h3>
        <FavoriteButton
          mangaId={manga.id}
          title={manga.title}
          coverUrl={cover}
          className="h-9 w-9 shrink-0 bg-surface-panel text-content-secondary hover:bg-surface-panel hover:text-content-primary shadow-none backdrop-blur-none"
        />
      </div>
    </article>
  );
}
