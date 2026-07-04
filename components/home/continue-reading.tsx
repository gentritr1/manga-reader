"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { ArrowRight, LogIn, Play } from "lucide-react";
import { coverUrl, type SimpleManga } from "@/lib/mangadex";
import { MangaCoverImage } from "@/components/manga/cover-image";
import { Section } from "@/components/manga/section";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HistoryItem {
  mangaId: string;
  chapterId: string;
  title: string;
  coverUrl: string | null;
  chapter: string | null;
}

export function ContinueReading({
  starterManga = [],
}: {
  starterManga?: SimpleManga[];
}) {
  const { status } = useSession();
  const { data = [], isLoading } = useQuery({
    queryKey: ["history"],
    enabled: status === "authenticated",
    queryFn: async (): Promise<HistoryItem[]> => {
      const res = await fetch("/api/history");
      if (!res.ok) return [];
      return (await res.json()).history as HistoryItem[];
    },
  });

  if (status === "authenticated" && isLoading) {
    return (
      <Section
        title="Continue reading"
        description="Your last opened chapters stay ready here."
      >
        <div className="flex gap-4 overflow-hidden pb-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-28 w-64 shrink-0 rounded-card border border-line-subtle bg-surface-panel skeleton"
            />
          ))}
        </div>
      </Section>
    );
  }

  if (status !== "authenticated" || data.length === 0) {
    return (
      <EmptyContinueReading
        authenticated={status === "authenticated"}
        syncPending={status === "loading"}
        starterManga={starterManga}
      />
    );
  }

  return (
    <Section
      title="Continue reading"
      description="Your last opened chapters stay ready here."
    >
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {data.map((item) => (
            <Link
              key={item.mangaId}
              href={`/read/${item.chapterId}`}
              prefetch={false}
              className="group relative flex min-h-28 w-64 shrink-0 gap-3 overflow-hidden rounded-card border border-line-subtle bg-surface-panel p-3 transition hover:-translate-y-0.5 hover:border-brand-primary/45 hover:[box-shadow:var(--elevation-hover)] focus-visible:border-brand-primary"
            >
              <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                {item.coverUrl && (
                  <MangaCoverImage
                    src={item.coverUrl}
                    alt={`${item.title} cover`}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                {item.chapter && (
                  <p className="mt-1 text-xs text-content-secondary">
                    Chapter {item.chapter}
                  </p>
                )}
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-primary">
                  <Play className="h-3 w-3 fill-current" /> Resume chapter
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface-canvas to-transparent sm:hidden"
          aria-hidden="true"
        />
      </div>
    </Section>
  );
}

function EmptyContinueReading({
  authenticated,
  syncPending,
  starterManga,
}: {
  authenticated: boolean;
  syncPending?: boolean;
  starterManga: SimpleManga[];
}) {
  const starters = starterManga
    .map((manga) => ({
      manga,
      cover: coverUrl(manga.id, manga.coverFileName, 256),
      tag: manga.tags[0] ?? manga.status ?? "Manga",
    }))
    .slice(0, 3);
  const sectionDescription = authenticated
    ? "Open any chapter and it will appear here."
    : syncPending
      ? "Checking your shelf…"
      : "Read freely now. Log in when you want your shelf across devices.";

  return (
    <Section
      title="Start your shelf"
      description={sectionDescription}
    >
      <div className="grid gap-8 md:grid-cols-[1fr_20rem] lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.65fr)] md:items-start">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Quick starts</p>
            <Link
              href="/browse?sort=popular"
              className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-medium text-content-secondary transition hover:text-brand-primary focus-visible:text-brand-primary"
            >
              Browse popular <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {starters.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {starters.map(({ manga, cover, tag }) => (
                <Link
                  key={manga.id}
                  href={`/manga/${manga.id}`}
                  prefetch={false}
                  className="group grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 rounded-lg p-2 transition hover:bg-surface-muted/40 focus-visible:bg-surface-muted/40 focus-visible:ring-2 focus-visible:ring-focus sm:block"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-surface-muted sm:w-full">
                    {cover ? (
                      <MangaCoverImage
                        src={cover}
                        alt={`${manga.title} cover`}
                        fill
                        sizes="(max-width: 640px) 68px, 180px"
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full place-items-center px-2 text-center text-xs text-content-secondary">
                        No cover
                      </div>
                    )}
                    {manga.lastChapter && (
                      <Badge variant="chapter" className="absolute bottom-1 left-1 px-1.5 py-0 text-[0.68rem] backdrop-blur rounded">
                        Ch. {manga.lastChapter}
                      </Badge>
                    )}
                  </div>
                  <div className="min-w-0 self-center sm:mt-2">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">
                      {manga.title}
                    </p>
                    <p className="mt-1 truncate text-xs text-content-secondary">
                      {tag}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg p-4 text-sm text-content-secondary">
              Browse the latest updates to start filling this shelf.
            </div>
          )}
        </div>

        <div className="space-y-4 md:mt-11">
          <div className="space-y-2">
            <h3 className="text-base font-bold tracking-tight sm:text-lg">
              {authenticated ? "Nothing paused yet." : "Find a chapter, start reading."}
            </h3>
            <p className="max-w-md text-sm leading-relaxed text-content-secondary md:text-base md:leading-relaxed">
              {authenticated
                ? "Your next opened chapter will show up here so you can pick up where you left off."
                : "Your reading history stays on this device. Log in to sync it across devices when you're ready."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/browse?sort=latest"
              className={buttonClassName({
                className:
                  "bg-action-primary text-action-primary-foreground hover:brightness-110",
              })}
            >
              Browse latest <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {!authenticated && (
              <Link
                href="/login"
                className={buttonClassName({ variant: "outline" })}
              >
                <LogIn className="h-4 w-4" aria-hidden="true" /> Log in to sync
              </Link>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
