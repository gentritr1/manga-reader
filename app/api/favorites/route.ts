import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const addSchema = z.object({
  mangaId: z.string().min(1),
  title: z.string().min(1),
  coverUrl: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ favorites });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { mangaId, title, coverUrl } = parsed.data;
  const favorite = await prisma.favorite.upsert({
    where: { userId_mangaId: { userId: session.user.id, mangaId } },
    update: { title, coverUrl },
    create: { userId: session.user.id, mangaId, title, coverUrl },
  });
  return NextResponse.json({ favorite }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const mangaId = new URL(req.url).searchParams.get("mangaId");
  if (!mangaId) {
    return NextResponse.json({ error: "mangaId required" }, { status: 400 });
  }
  await prisma.favorite
    .delete({ where: { userId_mangaId: { userId: session.user.id, mangaId } } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
