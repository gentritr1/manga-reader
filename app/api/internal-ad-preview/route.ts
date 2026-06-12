import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const noStore = {
  headers: { "Cache-Control": "private, no-store" },
};

function normalizeScriptUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const srcMatch = trimmed.match(/\bsrc=["']([^"']+)["']/i);
  const candidate = srcMatch?.[1] ?? trimmed;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const scriptUrl = normalizeScriptUrl(process.env.ADSTERRA_SCRIPT_URL);

    if (!scriptUrl) {
      return NextResponse.json({ show: false, scriptUrl: null }, noStore);
    }

    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ show: false, scriptUrl: null }, noStore);
    }

    const firstUsers = await prisma.user.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
      take: 2,
    });

    const show = firstUsers.some((user) => user.id === userId);

    return NextResponse.json({
      show,
      scriptUrl: show ? scriptUrl : null,
    }, noStore);
  } catch {
    return NextResponse.json({ show: false, scriptUrl: null }, noStore);
  }
}
