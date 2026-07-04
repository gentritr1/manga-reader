export interface SharedCachePolicy {
  browser: string;
  cdn: string;
  vercel?: string;
}

export const MANGADEX_API_CACHE: SharedCachePolicy = {
  browser: "public, max-age=60, stale-while-revalidate=300",
  cdn: "public, s-maxage=300, stale-while-revalidate=3600, stale-if-error=86400",
};

export const CHAPTER_IMAGE_CACHE: SharedCachePolicy = {
  browser: "public, max-age=86400, stale-while-revalidate=604800",
  cdn: "public, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800",
};

export const NO_STORE = "private, no-store";

export function setSharedCacheHeaders(
  headers: Headers,
  policy: SharedCachePolicy,
) {
  headers.set("Cache-Control", policy.browser);
  headers.set("CDN-Cache-Control", policy.cdn);
  headers.set("Vercel-CDN-Cache-Control", policy.vercel ?? policy.cdn);
}
