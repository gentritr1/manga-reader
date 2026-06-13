import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AdPlacement = "banner" | "feed" | "rectangle" | "reader" | "social";

type NativeAdConfig = {
  type: "native";
  src: string;
  containerId: string;
  minHeight: number;
};

type IframeAdConfig = {
  type: "iframe";
  key: string;
  src: string;
  width: number;
  height: number;
};

const noStore = {
  headers: { "Cache-Control": "private, no-store" },
};

const placements = new Set<AdPlacement>([
  "banner",
  "feed",
  "rectangle",
  "reader",
  "social",
]);

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

function normalizeKey(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/^\/([^/]+)\/invoke\.js$/);
    return match?.[1] ?? null;
  } catch {
    return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null;
  }
}

function iframeConfig(
  key: string | null,
  size: { width: number; height: number },
): IframeAdConfig | null {
  if (!key) return null;

  return {
    type: "iframe",
    key,
    src: `https://www.highperformanceformat.com/${key}/invoke.js`,
    ...size,
  };
}

function placementConfig(placement: AdPlacement): NativeAdConfig | IframeAdConfig | null {
  if (process.env.NEXT_PUBLIC_ADS_ENABLED !== "true") return null;

  switch (placement) {
    case "banner":
      return iframeConfig(normalizeKey(process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY), {
        width: 728,
        height: 90,
      });
    case "feed": {
      const src = normalizeScriptUrl(
        process.env.NEXT_PUBLIC_ADSTERRA_BROWSE_FEED_SRC ??
          process.env.NEXT_PUBLIC_ADSTERRA_CHAPTER_START_SRC,
      );
      const containerId =
        process.env.NEXT_PUBLIC_ADSTERRA_BROWSE_FEED_CONTAINER?.trim() ||
        process.env.NEXT_PUBLIC_ADSTERRA_CHAPTER_START_CONTAINER?.trim();

      if (!src || !containerId) return null;

      return {
        type: "native",
        src,
        containerId,
        minHeight: 180,
      };
    }
    case "rectangle":
    case "reader":
      return iframeConfig(normalizeKey(process.env.NEXT_PUBLIC_ADSTERRA_CHAPTER_END_KEY), {
        width: 300,
        height: 250,
      });
    case "social":
      return null;
  }
}

function allowedEmails() {
  return new Set(
    (process.env.ADSTERRA_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function GET(request: Request) {
  try {
    const placementParam = new URL(request.url).searchParams.get("placement");
    const placement = placements.has(placementParam as AdPlacement)
      ? (placementParam as AdPlacement)
      : "banner";
    const socialScriptUrl = normalizeScriptUrl(process.env.ADSTERRA_SCRIPT_URL);
    const adConfig = placementConfig(placement);

    const session = await auth();
    const userId = session?.user?.id;
    const userEmail = session?.user?.email?.toLowerCase();

    if (!userId) {
      return NextResponse.json(
        { show: false, socialScriptUrl: null, adConfig: null },
        noStore,
      );
    }

    const emailAllowlist = allowedEmails();
    const emailAllowed =
      emailAllowlist.size > 0 && userEmail ? emailAllowlist.has(userEmail) : false;

    const firstUsers = await prisma.user.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
      take: 2,
    });

    const show = emailAllowed || firstUsers.some((user) => user.id === userId);

    return NextResponse.json(
      {
        show: show && Boolean(socialScriptUrl || adConfig),
        socialScriptUrl: show ? socialScriptUrl : null,
        adConfig: show ? adConfig : null,
      },
      noStore,
    );
  } catch {
    return NextResponse.json(
      { show: false, socialScriptUrl: null, adConfig: null },
      noStore,
    );
  }
}
