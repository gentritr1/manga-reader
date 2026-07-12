// Client-only reader for locally persisted reading progress.
//
// The reader (components/reader/reader.tsx) persists per-chapter progress to
// localStorage under the key `yomi-progress:<chapterId>`, with a JSON value
// shaped like StoredChapterProgress:
//   { mangaId, chapterId, title, coverUrl, chapter, page, totalPages, updatedAt }
// The manga is identified by the `mangaId` field, the chapter by the key suffix
// (and mirrored in `chapterId`). This mirrors the same mechanism the home
// "Continue reading" rail uses (components/home/continue-reading.tsx) — we reuse
// the exact key prefix + schema here rather than inventing a second store.

export const PROGRESS_STORAGE_PREFIX = "yomi-progress:";

export interface ChapterProgress {
  mangaId: string;
  chapterId: string;
  chapter: string | null;
  page: number;
  totalPages: number | null;
  updatedAt: number;
}

/** A chapter counts as finished when a known total is reached. */
export function isChapterFinished(p: ChapterProgress): boolean {
  return p.totalPages != null && p.page >= p.totalPages;
}

/** Percent read (0-100) when a total is known, else null. */
export function progressPercent(p: ChapterProgress): number | null {
  if (!p.totalPages) return null;
  return Math.min(100, Math.max(0, (p.page / p.totalPages) * 100));
}

/**
 * Read every locally stored chapter progress belonging to `mangaId`, keyed by
 * chapterId (most-recent entry wins if a chapter somehow has duplicates).
 * Returns an empty map during SSR / before mount.
 */
export function readMangaChapterProgress(
  mangaId: string,
): Map<string, ChapterProgress> {
  const map = new Map<string, ChapterProgress>();
  if (typeof window === "undefined") return map;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(PROGRESS_STORAGE_PREFIX)) continue;

    try {
      const parsed = JSON.parse(
        localStorage.getItem(key) ?? "{}",
      ) as Partial<ChapterProgress> & { totalPages?: number | null };
      if (parsed.mangaId !== mangaId) continue;

      const chapterId =
        typeof parsed.chapterId === "string"
          ? parsed.chapterId
          : key.slice(PROGRESS_STORAGE_PREFIX.length);
      const rawPage = typeof parsed.page === "number" ? parsed.page : NaN;
      if (!Number.isFinite(rawPage)) continue;

      const page = Math.max(1, Math.trunc(rawPage));
      const totalPages =
        typeof parsed.totalPages === "number" && parsed.totalPages >= 1
          ? Math.trunc(parsed.totalPages)
          : null;
      const updatedAtRaw = Number(parsed.updatedAt);
      const updatedAt = Number.isFinite(updatedAtRaw) ? updatedAtRaw : 0;

      const entry: ChapterProgress = {
        mangaId,
        chapterId,
        chapter: typeof parsed.chapter === "string" ? parsed.chapter : null,
        page,
        totalPages,
        updatedAt,
      };

      const existing = map.get(chapterId);
      if (!existing || entry.updatedAt >= existing.updatedAt) {
        map.set(chapterId, entry);
      }
    } catch {
      // Ignore malformed entries — progressive enhancement, never throw.
    }
  }

  return map;
}

/** The single most-recently-updated progress entry for a manga, or null. */
export function readMostRecentMangaProgress(
  mangaId: string,
): ChapterProgress | null {
  let latest: ChapterProgress | null = null;
  for (const entry of readMangaChapterProgress(mangaId).values()) {
    if (!latest || entry.updatedAt > latest.updatedAt) latest = entry;
  }
  return latest;
}
