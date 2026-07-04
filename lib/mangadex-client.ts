// Client-side MangaDex fetching via our /api/md proxy.
import {
  buildMangaQuery,
  simplifyManga,
  type SearchParams,
  type SimpleManga,
} from "./mangadex";

export interface ClientSearchResult {
  manga: SimpleManga[];
  total: number;
}

export const MANGA_SEARCH_STALE_TIME_MS = 5 * 60 * 1000;
export const MANGA_SEARCH_GC_TIME_MS = 30 * 60 * 1000;

export async function searchMangaClient(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<ClientSearchResult> {
  const res = await fetch(`/api/md/manga?${buildMangaQuery(params)}`, { signal });
  if (!res.ok) return { manga: [], total: 0 };
  const json = (await res.json()) as { data?: unknown[]; total?: number };
  if (!json.data) return { manga: [], total: 0 };
  return {
    manga: json.data.map((m) => simplifyManga(m as never)),
    total: json.total ?? json.data.length,
  };
}
