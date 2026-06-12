import { NextRequest, NextResponse } from "next/server";
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
    return NextResponse.json({ error: "Invalid chapter page" }, { status: 400 });
  }

  const pages = await getChapterPages(chapterId);
  if (!pages || pageNumber > pages.data.length) {
    return NextResponse.json({ error: "Chapter page not found" }, { status: 404 });
  }

  const useDataSaver =
    req.nextUrl.searchParams.get("quality") === "data-saver" &&
    Boolean(pages.dataSaver[pageNumber - 1]);
  const target = pageImageUrl(pages, pageNumber - 1, useDataSaver);
  const range = req.headers.get("range");

  try {
    const upstream = await fetch(target, {
      // Avoid storing large MangaDex image bodies and range variants in Next's data cache.
      cache: "no-store",
      headers: {
        "User-Agent": UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        ...(range ? { Range: range } : {}),
      },
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Upstream image request failed" },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const headers = new Headers({
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
    });

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
      { status: 502 },
    );
  }
}
