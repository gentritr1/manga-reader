import { NextRequest, NextResponse } from "next/server";
import { MD_API } from "@/lib/mangadex";

const UA = "MangaReader/1.0 (https://github.com/manga-reader; contact@example.com)";

// Generic read-only proxy to the MangaDex API. Used by client components
// (search-as-you-type, infinite scroll) to avoid CORS and attach a User-Agent.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const search = req.nextUrl.search; // includes leading "?"
  const target = `${MD_API}/${path.join("/")}${search}`;

  try {
    const res = await fetch(target, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate: 300 },
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Upstream MangaDex request failed" },
      { status: 502 },
    );
  }
}
