import { NextRequest, NextResponse } from "next/server";
import { CHAPTER_IMAGE_CACHE, NO_STORE, setSharedCacheHeaders } from "@/lib/cache-headers";
import { pageImageUrl } from "@/lib/mangadex";
import { getChapterPages } from "@/lib/mangadex-server";

const UA = "MangaReader/1.0 (https://github.com/manga-reader; contact@example.com)";

interface Params {
  chapterId: string;
  page: string;
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { chapterId, page } = await params;
  const pageNumber = Number(page);

  if (!isValidUuid(chapterId) || !Number.isInteger(pageNumber) || pageNumber < 1) {
    return NextResponse.json(
      { error: "Invalid chapter page" },
      { status: 400, headers: { "Cache-Control": NO_STORE } },
    );
  }

  const pages = await getChapterPages(chapterId);
  if (!pages || pageNumber > pages.data.length) {
    return NextResponse.json(
      { error: "Chapter page not found" },
      { status: 404, headers: { "Cache-Control": NO_STORE } },
    );
  }

  const useDataSaver =
    req.nextUrl.searchParams.get("quality") === "data-saver" &&
    Boolean(pages.dataSaver[pageNumber - 1]);
  const target = pageImageUrl(pages, pageNumber - 1, useDataSaver);
  const range = req.headers.get("range");
  const upstreamHeaders = new Headers({
    "User-Agent": UA,
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  });

  for (const name of ["if-none-match", "if-modified-since"]) {
    const value = req.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }

  if (range) upstreamHeaders.set("Range", range);

  try {
    const upstream = await fetch(target, {
      // Avoid storing large MangaDex image bodies and range variants in Next's data cache.
      cache: "no-store",
      headers: upstreamHeaders,
    });

    if (upstream.status === 304) {
      const headers = new Headers();
      setSharedCacheHeaders(headers, CHAPTER_IMAGE_CACHE);
      for (const name of ["etag", "last-modified"]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new NextResponse(null, { status: 304, headers });
    }

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Upstream image request failed" },
        {
          status: upstream.status === 404 ? 404 : 502,
          headers: { "Cache-Control": NO_STORE },
        },
      );
    }

    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
    });
    if (range || upstream.status === 206) {
      headers.set("Cache-Control", NO_STORE);
    } else {
      setSharedCacheHeaders(headers, CHAPTER_IMAGE_CACHE);
    }

    for (const name of [
      "accept-ranges",
      "content-length",
      "content-range",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: "Upstream image request failed" },
      { status: 502, headers: { "Cache-Control": NO_STORE } },
    );
  }
}
