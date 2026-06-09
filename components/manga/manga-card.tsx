import Image from "next/image";
import Link from "next/link";
import { coverUrl, type SimpleManga } from "@/lib/mangadex";
import { FavoriteButton } from "./favorite-button";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  ongoing: "bg-status-ongoing",
  completed: "bg-status-completed",
  hiatus: "bg-status-hiatus",
  cancelled: "bg-status-cancelled",
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
    <article className="group">
      <div className="relative">
        <Link
          href={`/manga/${manga.id}`}
          aria-label={`Open ${manga.title}`}
          className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted">
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
              <div className="grid h-full place-items-center text-xs text-muted-foreground">
                No cover
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-spotlight/80 to-transparent" />

            {manga.status && (
              <span
                className={cn(
                  "absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold capitalize text-spotlight-foreground shadow-sm",
                  STATUS_STYLES[manga.status] ?? "bg-muted-foreground",
                )}
              >
                {manga.status}
              </span>
            )}

            {manga.lastChapter && (
              <span className="absolute bottom-2 left-2 rounded-md bg-spotlight/70 px-2 py-0.5 text-xs font-medium text-spotlight-foreground backdrop-blur">
                Ch. {manga.lastChapter}
              </span>
            )}
          </div>
        </Link>

        <div className="absolute right-2 top-2 z-10">
          <FavoriteButton
            mangaId={manga.id}
            title={manga.title}
            coverUrl={cover}
          />
        </div>
      </div>

      <h3 className="mt-2 text-sm font-medium leading-snug">
        <Link
          href={`/manga/${manga.id}`}
          className="line-clamp-2 block min-h-11 rounded-sm pt-1 transition hover:text-accent focus-visible:text-accent"
        >
          {manga.title}
        </Link>
      </h3>
    </article>
  );
}
