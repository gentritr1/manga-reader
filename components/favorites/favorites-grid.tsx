"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, HeartOff } from "lucide-react";
import { useFavorites } from "@/lib/use-favorites";
import { MangaGridSkeleton } from "@/components/manga/manga-grid";

export function FavoritesGrid() {
  const { favorites, isLoading, remove } = useFavorites();

  if (isLoading) return <MangaGridSkeleton count={12} />;

  if (favorites.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border py-24 text-center">
        <Heart className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-medium">Your library is empty</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Tap the heart on any manga to save it here and sync across devices.
        </p>
        <Link
          href="/browse"
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
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
          <Link href={`/manga/${f.mangaId}`} className="block">
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted">
              {f.coverUrl ? (
                <Image
                  src={f.coverUrl}
                  alt={f.title}
                  fill
                  sizes="(max-width: 640px) 45vw, 200px"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="grid h-full place-items-center text-xs text-muted-foreground">
                  No cover
                </div>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  remove.mutate(f.mangaId);
                }}
                aria-label="Remove from library"
                className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition hover:bg-black/70 group-hover:opacity-100"
              >
                <HeartOff className="h-4 w-4" />
              </button>
            </div>
          </Link>
          <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug">
            {f.title}
          </h3>
        </div>
      ))}
    </div>
  );
}
