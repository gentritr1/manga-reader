"use client";

import Link from "next/link";
import { Heart, HeartOff } from "lucide-react";
import { useFavorites } from "@/lib/use-favorites";
import { MangaCoverImage } from "@/components/manga/cover-image";
import { MangaGridSkeleton } from "@/components/manga/manga-grid";
import { buttonClassName } from "@/components/ui/button";

export function FavoritesGrid() {
  const { favorites, isLoading, remove } = useFavorites();

  if (isLoading) return <MangaGridSkeleton count={12} />;

  if (favorites.length === 0) {
    return (
      <div className="grid place-items-center rounded-card border border-dashed border-line-subtle py-24 text-center">
        <Heart className="mb-3 h-10 w-10 text-content-secondary" />
        <p className="text-lg font-medium">Your library is empty</p>
        <p className="mt-1 max-w-sm text-sm text-content-secondary">
          Tap the heart on any manga to save it here and sync across devices.
        </p>
        <Link
          href="/browse"
          className={buttonClassName({ className: "mt-4" })}
        >
          Browse manga
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {favorites.map((f) => (
        <div key={f.id} className="group">
          <div className="relative">
            <Link
              href={`/manga/${f.mangaId}`}
              prefetch={false}
              aria-label={`Open ${f.title}`}
              className="block rounded-cover focus-visible:ring-2 focus-visible:ring-focus"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-cover border border-line-subtle bg-surface-muted">
                {f.coverUrl ? (
                  <MangaCoverImage
                    src={f.coverUrl}
                    alt={f.title}
                    fill
                    sizes="(max-width: 640px) 45vw, 200px"
                    className="object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-content-secondary">
                    No cover
                  </div>
                )}
              </div>
            </Link>
            <button
              type="button"
              onClick={() => remove.mutate(f.mangaId)}
              aria-label={`Remove ${f.title} from library`}
              className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-surface-spotlight/70 text-content-inverse [box-shadow:var(--elevation-panel)] backdrop-blur transition hover:bg-surface-spotlight/90"
            >
              <HeartOff className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug">
            <Link
              href={`/manga/${f.mangaId}`}
              prefetch={false}
              className="rounded-sm transition hover:text-brand-primary focus-visible:text-brand-primary"
            >
              {f.title}
            </Link>
          </h3>
        </div>
      ))}
    </div>
  );
}
