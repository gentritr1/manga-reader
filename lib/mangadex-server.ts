// Server-only MangaDex fetchers. Calls api.mangadex.org directly with the
// required User-Agent and Next.js caching. Do NOT import from client components.
import "server-only";
import {
  MD_API,
  buildMangaQuery,
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
    `/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`,
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

export async function getChapterInfo(
  chapterId: string,
): Promise<SimpleChapter | null> {
  const json = await mdFetch<{ data?: unknown }>(
    `/chapter/${chapterId}?includes[]=scanlation_group&includes[]=manga`,
    600,
  );
  if (!json?.data) return null;
  return simplifyChapter(json.data as never);
}

/** Returns the manga id a chapter belongs to. */
export async function getChapterMangaId(
  chapterId: string,
): Promise<string | null> {
  const json = await mdFetch<{ data?: { relationships?: { id: string; type: string }[] } }>(
    `/chapter/${chapterId}`,
    3600,
  );
  return json?.data?.relationships?.find((r) => r.type === "manga")?.id ?? null;
}

export async function getChapterPages(
  chapterId: string,
): Promise<ChapterPages | null> {
  // At-home server URLs are short-lived; cache briefly.
  const json = await mdFetch<{
    baseUrl?: string;
    chapter?: { hash: string; data: string[]; dataSaver: string[] };
  }>(`/at-home/server/${chapterId}`, 60);
  if (!json?.baseUrl || !json.chapter) return null;
  return {
    baseUrl: json.baseUrl,
    hash: json.chapter.hash,
    data: json.chapter.data,
    dataSaver: json.chapter.dataSaver,
  };
}

export async function getPopular(limit = 12): Promise<SimpleManga[]> {
  const { manga } = await searchManga({ sort: "popular", limit });
  return manga;
}

export async function getLatest(limit = 24): Promise<SimpleManga[]> {
  const { manga } = await searchManga({ sort: "latest", limit });
  return manga;
}

/**
 * True "latest updates": newest English chapter releases, de-duplicated to one
 * entry per manga, ordered by actual release time (readableAt desc).
 */
export async function getLatestUpdates(limit = 24): Promise<SimpleManga[]> {
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
  for (const ch of json.data as {
    relationships?: { id: string; type: string }[];
  }[]) {
    const mangaRel = ch.relationships?.find((r) => r.type === "manga");
    if (mangaRel && !seen.has(mangaRel.id)) {
      seen.add(mangaRel.id);
      orderedIds.push(mangaRel.id);
    }
    if (orderedIds.length >= limit) break;
  }

  const manga = await getMangaByIds(orderedIds);
  const byId = new Map(manga.map((m) => [m.id, m]));
  return orderedIds
    .map((id) => byId.get(id))
    .filter((m): m is SimpleManga => Boolean(m));
}

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
