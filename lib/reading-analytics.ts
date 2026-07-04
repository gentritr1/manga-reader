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
  topManga: { title: string; pages: number }[];
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

function formatTotalTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
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

  const mangaMap: Record<string, { title: string; pages: number }> = {};
  sessions.forEach((session) => {
    if (!mangaMap[session.mangaId]) {
      mangaMap[session.mangaId] = { title: session.mangaTitle, pages: 0 };
    }
    mangaMap[session.mangaId].pages += session.pagesRead;
  });

  return {
    totalPages,
    totalSeconds,
    formattedTime: formatTotalTime(totalSeconds),
    averageSecondsPerPage: calculateAverageSecondsPerPage(sessions),
    topManga: Object.values(mangaMap)
      .sort((a, b) => b.pages - a.pages)
      .slice(0, 3),
  };
}

export const getUserReadingAnalytics = unstable_cache(
  getUserReadingAnalyticsUncached,
  ["user-reading-analytics-v1"],
  { revalidate: 300 },
);
