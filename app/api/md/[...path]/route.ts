import { NextRequest, NextResponse } from "next/server";
import { MD_API } from "@/lib/mangadex";
import { MANGADEX_API_CACHE, NO_STORE, setSharedCacheHeaders } from "@/lib/cache-headers";

const UA = "MangaReader/1.0 (https://github.com/manga-reader; contact@example.com)";
const MAX_PROXY_LIMIT = 100;

function mangaProxyTarget(path: string[], req: NextRequest): string | null {
  if (path.length !== 1 || path[0] !== "manga") return null;

  const searchParams = new URLSearchParams(req.nextUrl.searchParams);
  const rawLimit = Number(searchParams.get("limit") ?? "10");
  const parsedLimit = Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 10;
  const canonicalLimit = Math.min(Math.max(parsedLimit, 1), MAX_PROXY_LIMIT);
  searchParams.set("limit", String(canonicalLimit));
  searchParams.sort();

  return `${MD_API}/manga?${searchParams.toString()}`;
}

// Generic read-only proxy to the MangaDex API. Used by client components
// (search-as-you-type, infinite scroll) to avoid CORS and attach a User-Agent.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = mangaProxyTarget(path, req);
  if (!target) {
    return NextResponse.json(
      { error: "Unsupported MangaDex proxy endpoint" },
      { status: 404, headers: { "Cache-Control": NO_STORE } },
    );
  }

  const upstreamHeaders = new Headers({
    "User-Agent": UA,
    Accept: "application/json",
  });

  for (const name of ["if-none-match", "if-modified-since"]) {
    const value = req.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }

  try {
    const res = await fetch(target, {
      headers: upstreamHeaders,
      next: { revalidate: 300 },
    });
    const headers = new Headers({
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    });

    for (const name of ["etag", "last-modified"]) {
      const value = res.headers.get(name);
      if (value) headers.set(name, value);
    }

    if (res.ok || res.status === 304) {
      setSharedCacheHeaders(headers, MANGADEX_API_CACHE);
    } else {
      headers.set("Cache-Control", NO_STORE);
    }

    if (res.status === 304) {
      return new NextResponse(null, { status: 304, headers });
    }

    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: "Upstream MangaDex request failed" },
      { status: 502, headers: { "Cache-Control": NO_STORE } },
    );
  }
}
