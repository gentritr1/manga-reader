import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AnalyticsClient } from "./analytics-client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chapter Pulse",
};

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/analytics");
  }

  const sessions = await prisma.readingSession.findMany({
    where: { userId: session.user.id },
  });

  const totalPages = sessions.reduce((acc, curr) => acc + curr.pagesRead, 0);
  const totalSeconds = sessions.reduce((acc, curr) => acc + curr.durationSeconds, 0);
  
  // Aggregate top manga by pages read
  const mangaMap: Record<string, { title: string; pages: number }> = {};
  sessions.forEach(s => {
    if (!mangaMap[s.mangaId]) {
      mangaMap[s.mangaId] = { title: s.mangaTitle, pages: 0 };
    }
    mangaMap[s.mangaId].pages += s.pagesRead;
  });

  const topManga = Object.values(mangaMap)
    .sort((a, b) => b.pages - a.pages)
    .slice(0, 3);

  const averageSpeed = totalPages > 0 ? (totalSeconds / totalPages).toFixed(1) : "0";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const formattedTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <main className="flex-1 w-full bg-surface-canvas min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="mb-12 space-y-4 max-w-3xl">
          <h1 className="text-4xl font-black tracking-tight text-content-primary sm:text-5xl">
            Chapter Pulse
          </h1>
          <p className="text-lg text-content-secondary leading-relaxed">
            Your private reading recap, built from the chapters you actually open.
          </p>
        </div>
        
        <AnalyticsClient 
          totalPages={totalPages} 
          formattedTime={formattedTime} 
          averageSpeed={averageSpeed}
          topManga={topManga}
          name={session.user.name || "Reader"}
        />
      </div>
    </main>
  );
}
