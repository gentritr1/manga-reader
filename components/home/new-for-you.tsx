"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { MangaCoverImage } from "@/components/manga/cover-image";
import { Section } from "@/components/manga/section";
import { useFavorites } from "@/lib/use-favorites";

const PROGRESS_STORAGE_PREFIX = "yomi-progress:";
const DAY_MS = 24 * 60 * 60 * 1000;
// A followed title is "new for you" when its latest upload is either newer than
// the user's last read of it, or landed inside this recency window.
const RECENT_WINDOW_MS = 14 * DAY_MS;
const MAX_CANDIDATES = 12;
const MAX_SHOWN = 6;

interface Candidate {
  mangaId: string;
  title: string;
  coverUrl: string | null;
  /** Epoch ms of the user's most recent read of this title, if any. */
  lastReadAt: number | null;
}

interface DropItem extends Candidate {
  chapter: string | null;
  updatedAt: number;
}

interface HistoryRecord {
  mangaId: string;
  title: string;
  coverUrl: string | null;
  updatedAt: number | null;
}

/** Deduped per-manga reading history from localStorage (signed-out readers). */
function readLocalHistory(): HistoryRecord[] {
  if (typeof window === "undefined") return [];
  const byManga = new Map<string, HistoryRecord>();
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(PROGRESS_STORAGE_PREFIX)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "{}") as {
        mangaId?: unknown;
        title?: unknown;
        coverUrl?: unknown;
        updatedAt?: unknown;
      };
      if (typeof parsed.mangaId !== "string" || typeof parsed.title !== "string") {
        continue;
      }
      const updatedAt = Number(parsed.updatedAt);
      const record: HistoryRecord = {
        mangaId: parsed.mangaId,
        title: parsed.title,
        coverUrl:
          typeof parsed.coverUrl === "string" ? parsed.coverUrl : null,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : null,
      };
      const existing = byManga.get(record.mangaId);
      if (!existing || (record.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
        byManga.set(record.mangaId, record);
      }
    } catch {
      // Ignore malformed entries — progressive enhancement, never throw.
    }
  }
  return Array.from(byManga.values());
}

async function fetchNewForYou(candidates: Candidate[]): Promise<DropItem[]> {
  const ids = candidates.map((c) => c.mangaId);
  if (ids.length === 0) return [];

  // Request 1 (batched): resolve each followed manga's latest-upload chapter id.
  const mangaParams = new URLSearchParams();
  for (const id of ids) mangaParams.append("ids[]", id);
  mangaParams.set("limit", String(ids.length));
  const mangaRes = await fetch(`/api/md/manga?${mangaParams.toString()}`);
  if (!mangaRes.ok) return [];
  const mangaJson = (await mangaRes.json()) as {
    data?: { id?: string; attributes?: { latestUploadedChapter?: unknown } }[];
  };
  const latestChapterByManga = new Map<string, string>();
  for (const entry of mangaJson.data ?? []) {
    const chapterId = entry?.attributes?.latestUploadedChapter;
    if (entry?.id && typeof chapterId === "string") {
      latestChapterByManga.set(entry.id, chapterId);
    }
  }

  const chapterIds = Array.from(new Set(latestChapterByManga.values()));
  if (chapterIds.length === 0) return [];

  // Request 2 (batched): resolve those chapter ids to a number + release date.
  const chapterParams = new URLSearchParams();
  for (const id of chapterIds) chapterParams.append("ids[]", id);
  chapterParams.set("limit", String(chapterIds.length));
  const chapterRes = await fetch(`/api/md/chapter?${chapterParams.toString()}`);
  const chapterJson = chapterRes.ok
    ? ((await chapterRes.json()) as {
        data?: {
          id?: string;
          attributes?: {
            chapter?: unknown;
            readableAt?: unknown;
            publishAt?: unknown;
          };
        }[];
      })
    : { data: [] };
  const chapterInfo = new Map<string, { chapter: string | null; at: number }>();
  for (const entry of chapterJson.data ?? []) {
    if (!entry?.id) continue;
    const attrs = entry.attributes ?? {};
    const rawDate =
      (typeof attrs.readableAt === "string" && attrs.readableAt) ||
      (typeof attrs.publishAt === "string" && attrs.publishAt) ||
      "";
    const at = Date.parse(rawDate);
    chapterInfo.set(entry.id, {
      chapter: typeof attrs.chapter === "string" ? attrs.chapter : null,
      at: Number.isFinite(at) ? at : 0,
    });
  }

  const now = Date.now();
  const items: DropItem[] = [];
  for (const candidate of candidates) {
    const chapterId = latestChapterByManga.get(candidate.mangaId);
    if (!chapterId) continue;
    const info = chapterInfo.get(chapterId);
    if (!info || !info.at) continue;
    const isNew =
      info.at >= now - RECENT_WINDOW_MS ||
      (candidate.lastReadAt != null && info.at > candidate.lastReadAt);
    if (!isNew) continue;
    items.push({ ...candidate, chapter: info.chapter, updatedAt: info.at });
  }

  items.sort((a, b) => b.updatedAt - a.updatedAt);
  return items.slice(0, MAX_SHOWN);
}

function relativeDays(at: number): string {
  const days = Math.floor((Date.now() - at) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function NewForYou() {
  const { status } = useSession();
  const { favorites } = useFavorites();
  const [localHistory, setLocalHistory] = useState<HistoryRecord[]>([]);

  // Authenticated history shares the ["history"] cache with the Continue rail.
  const { data: serverHistory = [] } = useQuery({
    queryKey: ["history"],
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<HistoryRecord[]> => {
      const res = await fetch("/api/history");
      if (!res.ok) return [];
      const json = (await res.json()) as { history?: HistoryRecord[] };
      return json.history ?? [];
    },
  });

  useEffect(() => {
    if (status === "authenticated") return;
    // Client-only read after mount keeps SSR + first paint identical (no flash).
    const timer = window.setTimeout(() => setLocalHistory(readLocalHistory()), 0);
    return () => window.clearTimeout(timer);
  }, [status]);

  const candidates = useMemo(() => {
    const map = new Map<string, Candidate>();
    // Library (followed) titles are the primary signal.
    for (const fav of favorites) {
      map.set(fav.mangaId, {
        mangaId: fav.mangaId,
        title: fav.title,
        coverUrl: fav.coverUrl ?? null,
        lastReadAt: null,
      });
    }
    // Reading history fills in last-read timing and acts as the fallback source.
    const history = status === "authenticated" ? serverHistory : localHistory;
    for (const record of history) {
      const at =
        typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
          ? record.updatedAt
          : null;
      const existing = map.get(record.mangaId);
      if (existing) {
        if (at != null && (existing.lastReadAt == null || at > existing.lastReadAt)) {
          existing.lastReadAt = at;
        }
        if (!existing.coverUrl && record.coverUrl) existing.coverUrl = record.coverUrl;
      } else {
        map.set(record.mangaId, {
          mangaId: record.mangaId,
          title: record.title,
          coverUrl: record.coverUrl ?? null,
          lastReadAt: at,
        });
      }
    }
    return Array.from(map.values()).slice(0, MAX_CANDIDATES);
  }, [favorites, serverHistory, localHistory, status]);

  const candidateKey = useMemo(
    () =>
      candidates
        .map((c) => c.mangaId)
        .sort()
        .join(","),
    [candidates],
  );

  const { data: drops = [] } = useQuery({
    queryKey: ["new-for-you", candidateKey],
    enabled: candidates.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: () => fetchNewForYou(candidates),
  });

  // Empty (no follows/history, or nothing fresh) renders nothing at all — no
  // section header, no reserved space, so there is no layout shift.
  if (drops.length === 0) return null;

  return (
    <Section
      title="New for you"
      description="Fresh chapters in titles you follow and have been reading."
    >
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {drops.map((item) => {
            const chapterLabel = item.chapter ? `Ch. ${item.chapter}` : "New chapter";
            const relative = relativeDays(item.updatedAt);
            return (
              <Link
                key={item.mangaId}
                href={`/manga/${item.mangaId}`}
                prefetch={false}
                aria-label={`${item.title}, ${chapterLabel} · ${relative}`}
                className="group w-36 shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-surface-muted">
                  {item.coverUrl && (
                    <MangaCoverImage
                      src={item.coverUrl}
                      alt={`${item.title} cover`}
                      fill
                      sizes="144px"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
                  {item.title}
                </p>
                <p className="mt-1 text-xs text-content-secondary">
                  {chapterLabel} · {relative}
                </p>
              </Link>
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
