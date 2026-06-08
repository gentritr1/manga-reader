import Image from "next/image";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { coverUrl, type SimpleManga } from "@/lib/mangadex";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/manga/favorite-button";

export function Hero({ manga }: { manga: SimpleManga }) {
  const cover = coverUrl(manga.id, manga.coverFileName, 512);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border">
      {cover && (
        <Image
          src={cover}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-30 blur-xl"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />

      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:p-10">
        {cover && (
          <div className="relative aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-xl border border-border shadow-2xl sm:w-44">
            <Image src={cover} alt={manga.title} fill sizes="176px" className="object-cover" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <Badge className="bg-accent/15 text-accent border-accent/20">
            Featured
          </Badge>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
            {manga.title}
          </h1>
          <p className="line-clamp-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {manga.description || "No description available."}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Link href={`/manga/${manga.id}`}>
              <Button size="lg">
                <BookOpen className="h-5 w-5" /> Read now
              </Button>
            </Link>
            <FavoriteButton
              mangaId={manga.id}
              title={manga.title}
              coverUrl={cover}
              variant="full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
