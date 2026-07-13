import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

interface ReadingSessionSummary {
  mangaId: string;
  mangaTitle: string;
  pagesRead: number;
  durationSeconds: number;
}

export interface UserReadingAnalytics {
  totalPages: number;
  totalSeconds: number;
  formattedTime: string;
  averageSecondsPerPage: number | null;
  topManga: { title: string; pages: number; coverUrl: string | null }[];
}

export function calculateAverageSecondsPerPage(
  sessions: Pick<ReadingSessionSummary, "pagesRead" | "durationSeconds">[],
) {
  const totalPages = sessions.reduce((acc, curr) => acc + curr.pagesRead, 0);
  const totalSeconds = sessions.reduce(
    (acc, curr) => acc + curr.durationSeconds,
    0,
  );

  return totalPages > 0 ? totalSeconds / totalPages : null;
}

function formatTotalTime(totalSeconds: number, totalPages: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  // Under a minute of recorded time. Showing "0m" next to pages read looks
  // broken, so floor to a truthful "<1 min" whenever there are pages; only a
  // genuinely empty recap (no pages) stays "0m".
  return totalPages > 0 ? "<1 min" : "0m";
}

async function getUserReadingAnalyticsUncached(
  userId: string,
): Promise<UserReadingAnalytics> {
  const sessions = await prisma.readingSession.findMany({
    where: { userId },
    select: {
      mangaId: true,
      mangaTitle: true,
      pagesRead: true,
      durationSeconds: true,
    },
  });

  const totalPages = sessions.reduce((acc, curr) => acc + curr.pagesRead, 0);
  const totalSeconds = sessions.reduce(
    (acc, curr) => acc + curr.durationSeconds,
    0,
  );

  const mangaMap: Record<string, { mangaId: string; title: string; pages: number }> =
    {};
  sessions.forEach((session) => {
    if (!mangaMap[session.mangaId]) {
      mangaMap[session.mangaId] = {
        mangaId: session.mangaId,
        title: session.mangaTitle,
        pages: 0,
      };
    }
    mangaMap[session.mangaId].pages += session.pagesRead;
  });

  const ranked = Object.values(mangaMap)
    .sort((a, b) => b.pages - a.pages)
    .slice(0, 3);

  // ReadingSession carries no cover, but ReadingProgress does (same mangaId,
  // same user). Look up covers for just the top 3 and attach them additively.
  const topIds = ranked.map((m) => m.mangaId);
  const covers = topIds.length
    ? await prisma.readingProgress.findMany({
        where: { userId, mangaId: { in: topIds } },
        select: { mangaId: true, coverUrl: true },
      })
    : [];
  const coverByMangaId = new Map(covers.map((c) => [c.mangaId, c.coverUrl]));

  return {
    totalPages,
    totalSeconds,
    formattedTime: formatTotalTime(totalSeconds, totalPages),
    averageSecondsPerPage: calculateAverageSecondsPerPage(sessions),
    topManga: ranked.map((m) => ({
      title: m.title,
      pages: m.pages,
      coverUrl: coverByMangaId.get(m.mangaId) ?? null,
    })),
  };
}

export const getUserReadingAnalytics = unstable_cache(
  getUserReadingAnalyticsUncached,
  ["user-reading-analytics-v2"],
  { revalidate: 300 },
);
