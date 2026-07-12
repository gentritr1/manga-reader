// Client-only derivation of "my week" reading stats from the locally persisted
// yomi-progress:* entries the reader writes for every reader (signed in or out;
// see components/reader/reader.tsx writeStoredProgress). The authenticated
// analytics endpoints (/api/analytics, /api/analytics/streak) are auth-gated and
// return 401 anonymously, so the home stats strip and the share cards derive
// these numbers locally instead. This keeps the strip working for anonymous
// readers and adds zero network requests.

import { calculateReadingRhythm } from "@/lib/reading-rhythm";
import { DEFAULT_SECONDS_PER_PAGE } from "@/lib/read-time";

const PROGRESS_STORAGE_PREFIX = "yomi-progress:";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * MS_PER_DAY;
const MS_PER_MINUTE = 60 * 1000;

export interface LocalProgressEntry {
  mangaId: string;
  chapterId: string;
  title: string | null;
  coverUrl: string | null;
  chapter: string | null;
  page: number;
  totalPages: number | null;
  updatedAt: number;
}

/**
 * Every locally stored chapter-progress entry (one per chapter, across all
 * manga). Returns [] during SSR / before mount. Malformed entries are skipped —
 * progressive enhancement, never throws.
 */
export function readAllLocalProgress(): LocalProgressEntry[] {
  if (typeof window === "undefined") return [];

  const entries: LocalProgressEntry[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(PROGRESS_STORAGE_PREFIX)) continue;

    try {
      const parsed = JSON.parse(
        localStorage.getItem(key) ?? "{}",
      ) as Partial<LocalProgressEntry>;

      if (typeof parsed.mangaId !== "string") continue;
      const rawPage = typeof parsed.page === "number" ? parsed.page : NaN;
      if (!Number.isFinite(rawPage)) continue;

      const updatedAtRaw = Number(parsed.updatedAt);
      const totalPages =
        typeof parsed.totalPages === "number" && parsed.totalPages >= 1
          ? Math.trunc(parsed.totalPages)
          : null;

      entries.push({
        mangaId: parsed.mangaId,
        chapterId:
          typeof parsed.chapterId === "string"
            ? parsed.chapterId
            : key.slice(PROGRESS_STORAGE_PREFIX.length),
        title: typeof parsed.title === "string" ? parsed.title : null,
        coverUrl: typeof parsed.coverUrl === "string" ? parsed.coverUrl : null,
        chapter: typeof parsed.chapter === "string" ? parsed.chapter : null,
        page: Math.max(1, Math.trunc(rawPage)),
        totalPages,
        updatedAt: Number.isFinite(updatedAtRaw) ? updatedAtRaw : 0,
      });
    } catch {
      // Ignore malformed entries.
    }
  }
  return entries;
}

export interface LocalWeekStats {
  /** Current consecutive-night reading rhythm (house grace rules). 0 = none. */
  rhythmNights: number;
  /** Distinct local nights with any reading in the last 7 days. */
  nightsThisWeek: number;
  /** Furthest page reached across chapters touched in the last 7 days. */
  pagesThisWeek: number;
  /** pagesThisWeek at the house read-time estimate. */
  minutesThisWeek: number;
  hasHistory: boolean;
}

function localDayKey(time: number, timezoneOffsetMinutes: number) {
  return Math.floor((time - timezoneOffsetMinutes * MS_PER_MINUTE) / MS_PER_DAY);
}

/**
 * "My week" stats derived from local progress. `pagesThisWeek` sums the furthest
 * page reached in each chapter touched within the window — a proxy for pages
 * read, since the reader stores only the latest page per chapter, not per
 * session. Streak uses the shared calculateReadingRhythm so it matches the
 * authenticated rhythm elsewhere in the app.
 */
export function computeLocalWeekStats(
  entries: LocalProgressEntry[],
  now: number = Date.now(),
  timezoneOffsetMinutes: number = typeof window === "undefined"
    ? 0
    : new Date().getTimezoneOffset(),
): LocalWeekStats {
  if (entries.length === 0) {
    return {
      rhythmNights: 0,
      nightsThisWeek: 0,
      pagesThisWeek: 0,
      minutesThisWeek: 0,
      hasHistory: false,
    };
  }

  const since = now - WEEK_MS;
  const weekEntries = entries.filter((entry) => entry.updatedAt >= since);

  const pagesThisWeek = weekEntries.reduce((sum, entry) => sum + entry.page, 0);
  const minutesThisWeek =
    pagesThisWeek > 0
      ? Math.max(1, Math.round((pagesThisWeek * DEFAULT_SECONDS_PER_PAGE) / 60))
      : 0;

  const nights = new Set(
    weekEntries.map((entry) =>
      localDayKey(entry.updatedAt, timezoneOffsetMinutes),
    ),
  );

  const rhythm = calculateReadingRhythm(
    entries.map((entry) => entry.updatedAt),
    timezoneOffsetMinutes,
    now,
  );

  return {
    rhythmNights: rhythm.rhythmDays,
    nightsThisWeek: nights.size,
    pagesThisWeek,
    minutesThisWeek,
    hasHistory: true,
  };
}

/**
 * A single pressure-free "my week" line for the share cards, e.g.
 * "4 nights in a row  ·  128 pages  ·  17 min". Returns null when there is
 * nothing warm to show (never a shaming zero-state).
 */
export function formatWeekLine(stats: LocalWeekStats | null): string | null {
  if (!stats || !stats.hasHistory) return null;
  const parts: string[] = [];
  if (stats.rhythmNights > 0) {
    parts.push(
      `${stats.rhythmNights} night${stats.rhythmNights === 1 ? "" : "s"} in a row`,
    );
  } else if (stats.nightsThisWeek > 0) {
    parts.push(
      `${stats.nightsThisWeek} night${stats.nightsThisWeek === 1 ? "" : "s"} this week`,
    );
  }
  if (stats.pagesThisWeek > 0) parts.push(`${stats.pagesThisWeek} pages`);
  if (stats.minutesThisWeek > 0) parts.push(`${stats.minutesThisWeek} min`);
  return parts.length > 0 ? parts.join("  ·  ") : null;
}
