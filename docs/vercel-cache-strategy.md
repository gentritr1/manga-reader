# Vercel Cache Strategy

This app uses MangaDex for public metadata, cover images, and chapter page images. The goal of the current cache strategy is to reduce Vercel Fast Origin Transfer without making the reader feel stale.

## What Was Changed

- Added shared cache policy constants in `lib/cache-headers.ts`.
- Added Vercel-targeted CDN headers to public MangaDex JSON proxy responses.
- Added Vercel-targeted CDN headers to successful chapter image proxy responses.
- Kept chapter image bodies out of Next's Data Cache with `cache: "no-store"`.
- Marked proxy errors, invalid chapter-page requests, and range responses as `private, no-store`.
- Forwarded `If-None-Match` and `If-Modified-Since` to support upstream conditional requests.
- Restricted `/api/md/[...path]` to the current `/api/md/manga` use case and capped `limit` at `100`.
- Reduced paged-mode speculative image preloading to the next page only, and skipped it on Save-Data or 2G-like connections.
- Increased React Query staleness for public search/browse data to avoid refetching stable queries during normal navigation.
- Cached the home page aggregate MangaDex lists with `unstable_cache`.
- Narrowed `next/image` remote patterns to MangaDex covers and Google profile images, and limited generated image widths/formats/qualities.

## Cache Windows

| Surface | Fresh | Stale fallback | Why |
| --- | ---: | ---: | --- |
| `/api/md/manga` browser cache | 60s | 5m | Search results should not feel sticky in one browser session. |
| `/api/md/manga` Vercel CDN cache | 5m | 1h | Reduces repeated client search/browse proxy hits while keeping public metadata reasonably fresh. |
| Home latest updates aggregate | 5m | Next cache revalidates | Latest chapter drops should update quickly. |
| Home popular aggregate | 30m | Next cache revalidates | Popular/readability filtering is expensive and changes slower. |
| `/chapter-page/:chapterId/:page` browser cache | 24h | 7d | Chapter page URLs are stable enough for a day, but not hash-addressed in our public URL. |
| `/chapter-page/:chapterId/:page` Vercel CDN cache | 24h | 7d | Main Fast Origin Transfer savings path for reader images. |
| Proxy errors/range responses | no-store | none | Avoid caching transient failures or partial byte variants. |

## Why This Is The Middle Ground

- Chapter pages are the highest bandwidth risk. A long CDN cache helps cost, but a week-long fresh TTL would hide rare upstream image corrections because the public URL is chapter/page based. The chosen 24h fresh TTL lowers repeated origin transfer while allowing correction within a day.
- Metadata is lower bandwidth but freshness matters more. Five minutes is enough to collapse repeated search and browse traffic without making current updates feel old.
- Popular/readability checks are expensive because they fan out to many MangaDex feed requests. A 30-minute aggregate cache protects the home page cold path.
- Browser cache is shorter than CDN cache for JSON so individual users can refresh quickly while Vercel still absorbs repeat traffic.

## Verification

Pre-push checks used for this change:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

HTTP smoke checks:

- `/api/md/manga?limit=5&title=chainsaw` returns `Cache-Control`, `CDN-Cache-Control`, and `Vercel-CDN-Cache-Control`.
- Unsupported `/api/md/chapter?...` returns `private, no-store`.
- Invalid `/chapter-page/not-a-uuid/1` returns `private, no-store`.
- A real `/chapter-page/{chapterId}/1?quality=data-saver` response returns `200 OK`, image bytes, ETag/Last-Modified, and the chapter image cache policy.
- A conditional chapter image request returns `304 Not Modified`.
- Home, browse, manga detail, and reader routes render successfully in local smoke checks.

## What To Monitor After Deploy

- Vercel Usage: Fast Origin Transfer should drop most visibly on reader traffic.
- Response headers: check `x-vercel-cache` on `/api/md/manga` and `/chapter-page/...` for `HIT` after warm-up.
- Vercel Image Optimization usage: cover transformations should use fewer width variants.
- Product freshness: latest updates should appear within roughly five minutes, and corrected reader pages should age out within 24 hours.
- MangaDex proxy errors: unsupported proxy endpoints are intentionally blocked until a real client path needs them.

## References

- Vercel CDN usage: https://vercel.com/docs/manage-cdn-usage
- Vercel CDN cache: https://vercel.com/docs/caching/cdn-cache
- Vercel Cache-Control headers: https://vercel.com/docs/caching/cache-control-headers
- Vercel Data Cache: https://vercel.com/docs/caching/runtime-cache/data-cache
- Vercel Image Optimization costs: https://vercel.com/docs/image-optimization/managing-image-optimization-costs
