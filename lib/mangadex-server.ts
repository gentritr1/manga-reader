// Server-only MangaDex fetchers. Calls api.mangadex.org directly with the
// required User-Agent and Next.js caching. Do NOT import from client components.
import "server-only";
import { unstable_cache } from "next/cache";
import {
  MD_API,
  buildMangaQuery,
  isReadable,
  simplifyChapter,
  simplifyManga,
  type ChapterPages,
  type SearchParams,
  type SimpleChapter,
  type SimpleManga,
} from "./mangadex";

const UA = "MangaReader/1.0 (https://github.com/manga-reader; contact@example.com)";

async function mdFetch<T>(
  path: string,
  revalidate = 600,
): Promise<T | null> {
  try {
    const res = await fetch(`${MD_API}${path}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface ListResponse {
  data?: unknown[];
  total?: number;
}

export interface SearchResult {
  manga: SimpleManga[];
  total: number;
}

export async function searchManga(params: SearchParams): Promise<SearchResult> {
  const json = await mdFetch<ListResponse>(`/manga?${buildMangaQuery(params)}`);
  if (!json?.data) return { manga: [], total: 0 };
  return {
    manga: json.data.map((m) => simplifyManga(m as never)),
    total: json.total ?? json.data.length,
  };
}

export async function getManga(id: string): Promise<SimpleManga | null> {
  const json = await mdFetch<{ data?: unknown }>(
    `/manga/${id}?includes[]=cover_art&includes[]=author`,
    3600,
  );
  if (!json?.data) return null;
  return simplifyManga(json.data as never);
}

export async function getChapters(
  mangaId: string,
  opts: { limit?: number; offset?: number; order?: "asc" | "desc" } = {},
): Promise<{ chapters: SimpleChapter[]; total: number }> {
  const q = new URLSearchParams();
  q.set("limit", String(opts.limit ?? 100));
  q.set("offset", String(opts.offset ?? 0));
  q.append("translatedLanguage[]", "en");
  q.append("includes[]", "scanlation_group");
  for (const cr of ["safe", "suggestive", "erotica"])
    q.append("contentRating[]", cr);
  q.set("order[volume]", opts.order ?? "asc");
  q.set("order[chapter]", opts.order ?? "asc");
  q.set("includeFutureUpdates", "0");

  const json = await mdFetch<ListResponse>(`/manga/${mangaId}/feed?${q}`, 600);
  if (!json?.data) return { chapters: [], total: 0 };
  return {
    chapters: json.data.map((c) => simplifyChapter(c as never)),
    total: json.total ?? json.data.length,
  };
}

export interface ChapterInfo extends SimpleChapter {
  mangaId: string | null;
}

export async function getChapterInfo(
  chapterId: string,
): Promise<ChapterInfo | null> {
  const json = await mdFetch<{
    data?: {
      relationships?: { id: string; type: string }[];
    };
  }>(
    `/chapter/${chapterId}?includes[]=scanlation_group&includes[]=manga`,
    600,
  );
  if (!json?.data) return null;
  return {
    ...simplifyChapter(json.data as never),
    mangaId: json.data.relationships?.find((r) => r.type === "manga")?.id ?? null,
  };
}

export async function getChapterPages(
  chapterId: string,
): Promise<ChapterPages | null> {
  // At-home server URLs are short-lived; cache briefly.
  const json = await mdFetch<{
    baseUrl?: unknown;
    chapter?: { hash?: unknown; data?: unknown; dataSaver?: unknown };
  }>(`/at-home/server/${chapterId}`, 60);
  const chapter = json?.chapter;
  const data = toStringArray(chapter?.data);

  if (
    typeof json?.baseUrl !== "string" ||
    typeof chapter?.hash !== "string" ||
    data.length === 0
  ) {
    return null;
  }

  return {
    baseUrl: json.baseUrl,
    hash: chapter.hash,
    data,
    dataSaver: toStringArray(chapter.dataSaver),
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * True when a manga has at least one readable (non-licensed) English chapter.
 * Cached for 6h since licensing status changes rarely. On API failure it returns
 * `true` so a transient error never wrongly hides everything.
 */
export async function hasReadableEnglish(mangaId: string): Promise<boolean> {
  const q = new URLSearchParams();
  q.set("limit", "100");
  q.append("translatedLanguage[]", "en");
  for (const cr of ["safe", "suggestive", "erotica"])
    q.append("contentRating[]", cr);
  q.set("includeFutureUpdates", "0");
  const json = await mdFetch<ListResponse>(
    `/manga/${mangaId}/feed?${q}`,
    21600,
  );
  if (!json?.data) return true;
  return json.data.some((c) => isReadable(simplifyChapter(c as never)));
}

/** Run an async predicate over a list with bounded concurrency. */
async function readableIdSet(
  manga: SimpleManga[],
  concurrency = 5,
): Promise<Set<string>> {
  const readable = new Set<string>();
  let cursor = 0;
  async function worker() {
    while (cursor < manga.length) {
      const m = manga[cursor++];
      if (await hasReadableEnglish(m.id)) readable.add(m.id);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, manga.length) }, worker),
  );
  return readable;
}

/** Keep only manga with readable English chapters, preserving order. */
export async function filterReadableManga(
  manga: SimpleManga[],
  need: number,
): Promise<SimpleManga[]> {
  const readable = await readableIdSet(manga);
  return manga.filter((m) => readable.has(m.id)).slice(0, need);
}

async function getPopularUncached(limit = 12): Promise<SimpleManga[]> {
  // Over-fetch, then drop licensed/external-only titles so the grid stays full.
  const { manga } = await searchManga({
    sort: "popular",
    limit: Math.min(limit * 2 + 6, 100),
  });
  return filterReadableManga(manga, limit);
}

export const getPopular = unstable_cache(
  getPopularUncached,
  ["mangadex-popular-readable-v1"],
  { revalidate: 1800 },
);

export async function getLatest(limit = 24): Promise<SimpleManga[]> {
  const { manga } = await searchManga({ sort: "latest", limit });
  return manga;
}

/**
 * True "latest updates": newest English chapter releases, de-duplicated to one
 * entry per manga, ordered by actual release time (readableAt desc).
 */
async function getLatestUpdatesUncached(limit = 24): Promise<SimpleManga[]> {
  const q = new URLSearchParams();
  q.set("limit", "100"); // over-fetch so we can dedupe to `limit` unique manga
  q.append("translatedLanguage[]", "en");
  q.set("order[readableAt]", "desc");
  q.append("includes[]", "manga");
  for (const cr of ["safe", "suggestive"]) q.append("contentRating[]", cr);
  q.set("includeFutureUpdates", "0");

  const json = await mdFetch<{ data?: unknown[] }>(`/chapter?${q}`, 300);
  if (!json?.data) return [];

  const seen = new Set<string>();
  const orderedIds: string[] = [];
  const latestUploadedAtById = new Map<string, string>();
  for (const ch of json.data as {
    attributes?: {
      externalUrl?: string | null;
      pages?: number;
      readableAt?: string | null;
      publishAt?: string | null;
    };
    relationships?: { id: string; type: string }[];
  }[]) {
    // Skip licensed/external chapters — these can't be read in-app.
    if (ch.attributes?.externalUrl || ch.attributes?.pages === 0) continue;
    const mangaRel = ch.relationships?.find((r) => r.type === "manga");
    if (mangaRel && !seen.has(mangaRel.id)) {
      seen.add(mangaRel.id);
      orderedIds.push(mangaRel.id);
      latestUploadedAtById.set(
        mangaRel.id,
        ch.attributes?.readableAt ?? ch.attributes?.publishAt ?? "",
      );
    }
    if (orderedIds.length >= limit) break;
  }

  const manga = await getMangaByIds(orderedIds);
  const byId = new Map(manga.map((m) => [m.id, m]));
  const orderedManga: SimpleManga[] = [];

  for (const id of orderedIds) {
    const item = byId.get(id);
    if (!item) continue;
    orderedManga.push({
      ...item,
      latestUploadedAt: latestUploadedAtById.get(id) || null,
    });
  }

  return orderedManga;
}

export const getLatestUpdates = unstable_cache(
  getLatestUpdatesUncached,
  ["mangadex-latest-updates-v1"],
  { revalidate: 300 },
);

export async function getMangaByIds(ids: string[]): Promise<SimpleManga[]> {
  if (ids.length === 0) return [];
  const q = new URLSearchParams();
  q.set("limit", String(Math.min(ids.length, 100)));
  for (const id of ids.slice(0, 100)) q.append("ids[]", id);
  q.append("includes[]", "cover_art");
  q.append("includes[]", "author");
  for (const cr of ["safe", "suggestive", "erotica", "pornographic"])
    q.append("contentRating[]", cr);
  const json = await mdFetch<ListResponse>(`/manga?${q}`, 600);
  if (!json?.data) return [];
  return json.data.map((m) => simplifyManga(m as never));
}
