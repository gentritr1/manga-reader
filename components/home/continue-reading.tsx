"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, LogIn, Play } from "lucide-react";
import { coverUrl, type SimpleManga } from "@/lib/mangadex";
import { MangaCoverImage } from "@/components/manga/cover-image";
import {
  CoverTransitionElement,
  CoverTransitionLink,
} from "@/components/manga/cover-transition";
import { Section } from "@/components/manga/section";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PROGRESS_STORAGE_PREFIX = "yomi-progress:";

interface HistoryItem {
  mangaId: string;
  chapterId: string;
  title: string;
  coverUrl: string | null;
  chapter: string | null;
  page: number | null;
  totalPages: number | null;
  updatedAt?: string | number;
}

function readLocalHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];

  const items: HistoryItem[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(PROGRESS_STORAGE_PREFIX)) continue;

    try {
      const parsed = JSON.parse(
        localStorage.getItem(key) ?? "{}",
      ) as Partial<HistoryItem>;
      const page = typeof parsed.page === "number" ? parsed.page : NaN;
      const totalPages =
        typeof parsed.totalPages === "number" ? parsed.totalPages : NaN;
      if (
        typeof parsed.mangaId !== "string" ||
        typeof parsed.chapterId !== "string" ||
        typeof parsed.title !== "string" ||
        !Number.isFinite(page)
      ) {
        continue;
      }

      items.push({
        mangaId: parsed.mangaId,
        chapterId: parsed.chapterId,
        title: parsed.title,
        coverUrl:
          typeof parsed.coverUrl === "string" || parsed.coverUrl === null
            ? parsed.coverUrl
            : null,
        chapter: typeof parsed.chapter === "string" ? parsed.chapter : null,
        page: Math.max(1, Math.trunc(page)),
        totalPages: Number.isFinite(totalPages)
          ? Math.max(1, Math.trunc(totalPages))
          : null,
        updatedAt: parsed.updatedAt,
      });
    } catch {}
  }

  const seenManga = new Set<string>();
  return items
    .sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0))
    .filter((item) => {
      if (seenManga.has(item.mangaId)) return false;
      seenManga.add(item.mangaId);
      return true;
    })
    .slice(0, 12);
}

function progressPercent(item: HistoryItem) {
  if (!item.page || !item.totalPages) return null;
  return Math.min(100, Math.max(0, (item.page / item.totalPages) * 100));
}

export function ContinueReading({
  starterManga = [],
  reservedMangaIds = [],
}: {
  starterManga?: SimpleManga[];
  reservedMangaIds?: string[];
}) {
  const { status } = useSession();
  const reduceMotion = useReducedMotion();
  const [localHistory, setLocalHistory] = useState<HistoryItem[]>([]);
  const { data = [], isLoading } = useQuery({
    queryKey: ["history"],
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<HistoryItem[]> => {
      const res = await fetch("/api/history");
      if (!res.ok) return [];
      return (await res.json()).history as HistoryItem[];
    },
  });

  useEffect(() => {
    if (status === "authenticated") return;
    const timer = window.setTimeout(() => {
      setLocalHistory(readLocalHistory());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [status]);

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

  const history = status === "authenticated" ? data : localHistory;
  const reservedManga = new Set(reservedMangaIds);

  if (history.length === 0) {
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
          {history.map((item) => {
            const percent = progressPercent(item);
            return (
              <CoverTransitionLink
                mangaId={item.mangaId}
                key={item.mangaId}
                href={`/read/${item.chapterId}`}
                prefetch={false}
                className="group relative flex min-h-28 w-64 shrink-0 gap-3 overflow-hidden rounded-card border border-line-subtle bg-surface-panel p-3 transition hover:-translate-y-0.5 hover:border-brand-primary/45 hover:[box-shadow:var(--elevation-hover)] focus-visible:border-brand-primary"
                data-yomi-cover-transition-root
              >
                <CoverTransitionElement
                  mangaId={item.mangaId}
                  enabled={!reservedManga.has(item.mangaId)}
                  className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-md bg-surface-muted"
                >
                  {item.coverUrl && (
                    <MangaCoverImage
                      src={item.coverUrl}
                      alt={`${item.title} cover`}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  )}
                </CoverTransitionElement>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">
                    {item.title}
                  </p>
                  {item.chapter && (
                    <p className="mt-1 text-xs text-content-secondary">
                      Chapter {item.chapter}
                    </p>
                  )}
                  {item.page && (
                    <p className="mt-1 text-xs text-content-secondary">
                      Page {item.page}
                      {item.totalPages ? ` of ${item.totalPages}` : ""}
                    </p>
                  )}
                  {percent !== null && item.totalPages && item.page && (
                    <div
                      role="progressbar"
                      aria-label={`${item.title} reading progress`}
                      aria-valuemin={1}
                      aria-valuemax={item.totalPages}
                      aria-valuenow={Math.min(item.page, item.totalPages)}
                      className="mt-2 h-1 overflow-hidden rounded-full bg-library-surface"
                    >
                      {reduceMotion ? (
                        <div
                          className="h-full rounded-full bg-library"
                          style={{ width: `${percent}%` }}
                        />
                      ) : (
                        <motion.div
                          className="h-full origin-left rounded-full bg-library"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{
                            duration: 0.4,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          style={{ width: `${percent}%` }}
                        />
                      )}
                    </div>
                  )}
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-primary">
                    <Play className="h-3 w-3 fill-current" /> Resume chapter
                  </span>
                </div>
              </CoverTransitionLink>
            );
          })}
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
                <CoverTransitionLink
                  mangaId={manga.id}
                  key={manga.id}
                  href={`/manga/${manga.id}`}
                  prefetch={false}
                  className="group grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 rounded-lg p-2 transition hover:bg-surface-muted/40 focus-visible:bg-surface-muted/40 focus-visible:ring-2 focus-visible:ring-focus sm:block"
                  data-yomi-cover-transition-root
                >
                  <CoverTransitionElement
                    mangaId={manga.id}
                    className="relative aspect-[2/3] overflow-hidden rounded-md bg-surface-muted sm:w-full"
                  >
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
                  </CoverTransitionElement>
                  <div className="min-w-0 self-center sm:mt-2">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">
                      {manga.title}
                    </p>
                    <p className="mt-1 truncate text-xs text-content-secondary">
                      {tag}
                    </p>
                  </div>
                </CoverTransitionLink>
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
