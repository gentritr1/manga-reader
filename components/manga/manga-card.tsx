import Image from "next/image";
import Link from "next/link";
import { coverUrl, type SimpleManga } from "@/lib/mangadex";
import { FavoriteButton } from "./favorite-button";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  ongoing: "bg-emerald-500/90",
  completed: "bg-sky-500/90",
  hiatus: "bg-amber-500/90",
  cancelled: "bg-red-500/90",
};

export function MangaCard({ manga }: { manga: SimpleManga }) {
  const cover = coverUrl(manga.id, manga.coverFileName, 512);

  return (
    <Link href={`/manga/${manga.id}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted">
        {cover ? (
          <Image
            src={cover}
            alt={manga.title}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 200px"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">
            No cover
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />

        <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
          <FavoriteButton
            mangaId={manga.id}
            title={manga.title}
            coverUrl={cover}
          />
        </div>

        {manga.status && (
          <span
            className={cn(
              "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize text-white",
              STATUS_STYLES[manga.status] ?? "bg-gray-500/90",
            )}
          >
            {manga.status}
          </span>
        )}

        {manga.lastChapter && (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
            Ch. {manga.lastChapter}
          </span>
        )}
      </div>

      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug transition group-hover:text-accent">
        {manga.title}
      </h3>
    </Link>
  );
}
