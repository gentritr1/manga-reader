import { NextRequest, NextResponse } from "next/server";
import { MD_API } from "@/lib/mangadex";
import {
  MANGADEX_API_CACHE,
  NO_STORE,
  setSharedCacheHeaders,
} from "@/lib/cache-headers";

const UA = "MangaReader/1.0 (https://github.com/manga-reader; contact@example.com)";
const MAX_PROXY_LIMIT = 100;
const ALLOWED_INCLUDES = ["cover_art", "author"];
const PUBLIC_CONTENT_RATINGS = ["safe", "suggestive"];
const ALLOWED_QUERY_KEYS = new Set([
  "title",
  "limit",
  "offset",
  "status[]",
  "includedTags[]",
  "order[latestUploadedChapter]",
  "order[followedCount]",
  "order[rating]",
  "order[title]",
]);

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compactObject(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

function replaceAll(params: URLSearchParams, key: string, values: string[]) {
  params.delete(key);
  for (const value of values) params.append(key, value);
}

function allowedMangaSearchParams(req: NextRequest): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [key, value] of req.nextUrl.searchParams) {
    if (ALLOWED_QUERY_KEYS.has(key)) searchParams.append(key, value);
  }
  return searchParams;
}

function mangaProxyTarget(path: string[], req: NextRequest): string | null {
  if (path.length !== 1 || path[0] !== "manga") return null;

  const searchParams = allowedMangaSearchParams(req);
  const rawLimit = Number(searchParams.get("limit") ?? "10");
  const parsedLimit = Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 10;
  const canonicalLimit = Math.min(Math.max(parsedLimit, 1), MAX_PROXY_LIMIT);
  const rawOffset = Number(searchParams.get("offset") ?? "0");
  const parsedOffset = Number.isFinite(rawOffset) ? Math.trunc(rawOffset) : 0;
  searchParams.set("limit", String(canonicalLimit));
  searchParams.set("offset", String(Math.max(parsedOffset, 0)));
  replaceAll(searchParams, "includes[]", ALLOWED_INCLUDES);
  replaceAll(searchParams, "contentRating[]", PUBLIC_CONTENT_RATINGS);
  replaceAll(searchParams, "availableTranslatedLanguage[]", ["en"]);
  searchParams.set("hasAvailableChapters", "true");
  searchParams.sort();

  return `${MD_API}/manga?${searchParams.toString()}`;
}

function trimLocalizedMap(value: unknown): unknown {
  if (!isObject(value)) return value;
  const fallback = Object.entries(value).find(
    ([key, item]) =>
      key !== "en" &&
      key !== "ja-ro" &&
      typeof item === "string" &&
      item.length > 0,
  );
  return compactObject({
    en: value.en,
    "ja-ro": value["ja-ro"],
    ...(fallback ? { [fallback[0]]: fallback[1] } : {}),
  });
}

function trimTag(value: unknown): unknown {
  if (!isObject(value)) return value;
  const attrs = isObject(value.attributes) ? value.attributes : {};
  return compactObject({
    id: value.id,
    type: value.type,
    attributes: compactObject({ name: trimLocalizedMap(attrs.name) }),
  });
}

function trimRelationship(value: unknown): unknown {
  if (!isObject(value)) return value;
  if (!ALLOWED_INCLUDES.includes(String(value.type))) return undefined;

  const attrs = isObject(value.attributes) ? value.attributes : {};
  return compactObject({
    id: value.id,
    type: value.type,
    attributes:
      value.type === "cover_art"
        ? compactObject({ fileName: attrs.fileName })
        : compactObject({ name: attrs.name }),
  });
}

function trimMangaEntity(value: unknown): unknown {
  if (!isObject(value)) return value;

  const attrs = isObject(value.attributes) ? value.attributes : {};
  const tags = Array.isArray(attrs.tags) ? attrs.tags.map(trimTag) : undefined;
  const relationships = Array.isArray(value.relationships)
    ? value.relationships.map(trimRelationship).filter(Boolean)
    : undefined;

  return compactObject({
    id: value.id,
    type: value.type,
    attributes: compactObject({
      title: trimLocalizedMap(attrs.title),
      status: attrs.status,
      year: attrs.year,
      tags,
      lastChapter: attrs.lastChapter,
    }),
    relationships,
  });
}

function trimMangaListResponse(value: unknown): unknown {
  if (!isObject(value) || !Array.isArray(value.data)) return value;

  return compactObject({
    result: value.result,
    response: value.response,
    data: value.data.map(trimMangaEntity),
    limit: value.limit,
    offset: value.offset,
    total: value.total,
  });
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

    if (res.ok) {
      const body = trimMangaListResponse(await res.json());
      return NextResponse.json(body, {
        status: res.status,
        headers,
      });
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
