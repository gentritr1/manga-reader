import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  mangaId: z.string().min(1),
  chapterId: z.string().min(1),
  title: z.string().min(1),
  coverUrl: z.string().nullable().optional(),
  chapter: z.string().optional(),
  totalPages: z.number().int().min(1).max(2000).optional(),
});

const progressSchema = schema
  .extend({
    page: z.number().int().min(1).max(2000),
  })
  .refine(
    ({ page, totalPages }) => totalPages === undefined || page <= totalPages,
    {
      message: "Page cannot exceed total pages",
      path: ["page"],
    },
  );

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ history: [] });
  const history = await prisma.readingProgress.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });
  return NextResponse.json({ history });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    // Silently accept for logged-out users so the reader never errors.
    return NextResponse.json({ ok: false });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { mangaId, chapterId, title, coverUrl, chapter, totalPages } = parsed.data;
  const existing = await prisma.readingProgress.findUnique({
    where: { userId_mangaId: { userId: session.user.id, mangaId } },
    select: { chapterId: true, page: true },
  });
  const chapterChanged = existing?.chapterId !== chapterId;
  const clampedExistingPage =
    !chapterChanged && existing?.page && totalPages
      ? Math.min(existing.page, totalPages)
      : undefined;
  await prisma.readingProgress.upsert({
    where: { userId_mangaId: { userId: session.user.id, mangaId } },
    update: {
      chapterId,
      title,
      coverUrl,
      chapter,
      totalPages,
      ...(chapterChanged ? { page: 1 } : {}),
      ...(clampedExistingPage ? { page: clampedExistingPage } : {}),
    },
    create: {
      userId: session.user.id,
      mangaId,
      chapterId,
      title,
      coverUrl,
      chapter,
      page: 1,
      totalPages,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    // Local progress still works for signed-out readers.
    return NextResponse.json({ ok: false });
  }
  const parsed = progressSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { mangaId, chapterId, title, coverUrl, chapter, page, totalPages } =
    parsed.data;
  await prisma.readingProgress.upsert({
    where: { userId_mangaId: { userId: session.user.id, mangaId } },
    update: { chapterId, title, coverUrl, chapter, page, totalPages },
    create: {
      userId: session.user.id,
      mangaId,
      chapterId,
      title,
      coverUrl,
      chapter,
      page,
      totalPages,
    },
  });
  return NextResponse.json({ ok: true });
}
