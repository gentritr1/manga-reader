import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateReadingRhythm } from "@/lib/reading-rhythm";
import { calculateAverageSecondsPerPage } from "@/lib/reading-analytics";

const querySchema = z.object({
  tz: z.coerce.number().int().min(-14 * 60).max(14 * 60).default(0),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    tz: url.searchParams.get("tz") ?? "0",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }

  const since = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.readingSession.findMany({
    where: {
      userId: session.user.id,
      createdAt: { gte: since },
    },
    select: { createdAt: true, pagesRead: true, durationSeconds: true },
    orderBy: { createdAt: "desc" },
  });

  const rhythm = calculateReadingRhythm(
    sessions.map((readingSession) => readingSession.createdAt),
    parsed.data.tz,
  );

  return NextResponse.json({
    ...rhythm,
    averageSecondsPerPage: calculateAverageSecondsPerPage(sessions),
  });
}
