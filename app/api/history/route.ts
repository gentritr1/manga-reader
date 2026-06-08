import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  mangaId: z.string().min(1),
  chapterId: z.string().min(1),
  title: z.string().min(1),
  coverUrl: z.string().optional(),
  chapter: z.string().optional(),
});

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
  const { mangaId, chapterId, title, coverUrl, chapter } = parsed.data;
  await prisma.readingProgress.upsert({
    where: { userId_mangaId: { userId: session.user.id, mangaId } },
    update: { chapterId, title, coverUrl, chapter },
    create: { userId: session.user.id, mangaId, chapterId, title, coverUrl, chapter },
  });
  return NextResponse.json({ ok: true });
}
