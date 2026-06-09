import { type SimpleManga } from "@/lib/mangadex";
import { MangaCard } from "./manga-card";
import { Skeleton } from "@/components/ui/skeleton";

export function MangaGrid({ manga }: { manga: SimpleManga[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {manga.map((m, index) => (
        <MangaCard key={m.id} manga={m} eager={index < 6} />
      ))}
    </div>
  );
}

export function MangaGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3] w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}
