import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  mangaId: z.string().min(1),
  mangaTitle: z.string().min(1),
  chapterId: z.string().min(1),
  pagesRead: z.number().int().min(1),
  durationSeconds: z.number().int().min(1).max(36000), // Cap at 10 hours max
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    await prisma.readingSession.create({
      data: {
        userId: session.user.id,
        mangaId: parsed.data.mangaId,
        mangaTitle: parsed.data.mangaTitle,
        chapterId: parsed.data.chapterId,
        pagesRead: parsed.data.pagesRead,
        durationSeconds: parsed.data.durationSeconds,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to save reading session:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
