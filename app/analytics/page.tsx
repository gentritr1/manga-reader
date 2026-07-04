import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AnalyticsClient } from "./analytics-client";
import { Metadata } from "next";
import { getUserReadingAnalytics } from "@/lib/reading-analytics";

export const metadata: Metadata = {
  title: "Chapter Pulse",
};

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/analytics");
  }

  const analytics = await getUserReadingAnalytics(session.user.id);
  const averageSpeed = analytics.averageSecondsPerPage
    ? analytics.averageSecondsPerPage.toFixed(1)
    : "0";

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
          totalPages={analytics.totalPages}
          formattedTime={analytics.formattedTime}
          averageSpeed={averageSpeed}
          topManga={analytics.topManga}
          name={session.user.name || "Reader"}
        />
      </div>
    </main>
  );
}
