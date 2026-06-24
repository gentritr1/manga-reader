# Vercel Cache Strategy

This app uses MangaDex for public metadata, cover images, and chapter page images. The goal of the current cache strategy is to reduce Vercel Fast Origin Transfer without making the reader feel stale.

## What Was Changed

- Added shared cache policy constants in `lib/cache-headers.ts`.
- Added Vercel-targeted CDN headers to public MangaDex JSON proxy responses.
- Added Vercel-targeted CDN headers to successful chapter image proxy fallback responses.
- Served reader page images directly from MangaDex at-home hosts on the happy path, with `/chapter-page/:chapterId/:page` retained only as an expired-token/error fallback.
- Kept chapter image bodies out of Next's Data Cache with `cache: "no-store"`.
- Marked proxy errors, invalid chapter-page requests, and range responses as `private, no-store`.
- Forwarded `If-None-Match` and `If-Modified-Since` to support upstream conditional requests.
- Restricted `/api/md/[...path]` to the current `/api/md/manga` use case and capped `limit` at `100`.
- Normalized `/api/md/manga` to the public browse/search shape: English availability, safe/suggestive ratings, and only the `cover_art`/`author` includes the UI renders.
- Trimmed successful `/api/md/manga` responses before returning them to the browser so list/search traffic does not forward unused MangaDex fields.
- Clamped shared MangaDex search query limits and offsets before they reach either the server fetcher or the client proxy.
- Disabled Next Link prefetch on high-cardinality manga detail and reader links in grids, autocomplete, favorites, history, and chapter lists.
- Reduced paged-mode speculative image preloading to the next page only, and skipped it on Save-Data or 2G-like connections.
- Increased React Query staleness for public search/browse data to avoid refetching stable queries during normal navigation.
- Cached the home page aggregate MangaDex lists with `unstable_cache`.
- Narrowed `next/image` remote patterns to MangaDex covers and Google profile images, and limited generated image widths/formats/qualities.
- Added `NEXT_PUBLIC_DIRECT_COVERS` for optionally serving MangaDex cover thumbnails without Vercel Image Optimization.
- Removed per-slot client calls to the DB-backed `/api/internal-ad-preview` route; the ad gate is now resolved once per authenticated page session and ad configs come from `NEXT_PUBLIC_*` env vars.
- Required a pooled `DATABASE_URL` and a separate unpooled `DIRECT_URL` for Prisma migrations.

## Cache Windows

| Surface | Fresh | Stale fallback | Why |
| --- | ---: | ---: | --- |
| `/api/md/manga` browser cache | 60s | 5m | Search results should not feel sticky in one browser session. |
| `/api/md/manga` Vercel CDN cache | 5m | 1h | Reduces repeated client search/browse proxy hits while keeping public metadata reasonably fresh. |
| Home latest updates aggregate | 5m | Next cache revalidates | Latest chapter drops should update quickly. |
| Home popular aggregate | 30m | Next cache revalidates | Popular/readability filtering is expensive and changes slower. |
| Direct MangaDex at-home chapter images | upstream-controlled | upstream-controlled | Normal reader image path; image bytes bypass Vercel compute entirely. |
| `/chapter-page/:chapterId/:page` browser cache | 24h | 7d | Fallback only for expired at-home URLs or direct image errors. |
| `/chapter-page/:chapterId/:page` Vercel CDN cache | 24h | 7d | Protects fallback traffic, but should no longer carry normal reader image bytes. |
| MangaDex cover thumbnails via `next/image` | Next/Vercel image cache | Next/Vercel image cache | Default path keeps WebP/responsive optimization. |
| MangaDex cover thumbnails with `NEXT_PUBLIC_DIRECT_COVERS=true` | upstream/browser cache | upstream/browser cache | Bypasses Vercel Image Optimization, trading away WebP/responsive downscaling. |
| High-fanout manga and reader links | no speculative prefetch | user navigation only | Grids, autocomplete, favorites, history, and chapter lists can contain many heavy targets, so navigation should be intentional. |
| Proxy errors/range responses | no-store | none | Avoid caching transient failures or partial byte variants. |

## Why This Is The Middle Ground

- Chapter pages are the highest bandwidth risk. Reader images now use direct MangaDex at-home URLs, which is the standard MangaDex client flow and avoids sending normal page-image bytes through Vercel compute. The existing proxy remains as a fallback when a short-lived at-home URL expires during a long reading session.
- The fallback proxy keeps a 24h fresh TTL. A longer fresh TTL would hide rare upstream image corrections because the public fallback URL is chapter/page based rather than hash-addressed.
- Metadata is lower bandwidth but freshness matters more. Five minutes is enough to collapse repeated search and browse traffic without making current updates feel old.
- Popular/readability checks are expensive because they fan out to many MangaDex feed requests. A 30-minute aggregate cache protects the home page cold path.
- Browser cache is shorter than CDN cache for JSON so individual users can refresh quickly while Vercel still absorbs repeat traffic.
- The MangaDex proxy still returns a MangaDex-compatible response shape, but removes unused nested fields. That keeps existing client simplification code stable while reducing JSON bytes crossing Vercel compute.
- Direct at-home image URLs are not mirroring or redistribution; the browser requests MangaDex's current at-home host directly from the server-provided manifest. This carries less policy and bandwidth risk than proxying the same image bytes through app compute.
- `NEXT_PUBLIC_DIRECT_COVERS=true` makes cover `<Image>` instances unoptimized so MangaDex thumbnail URLs load directly. Leave it off when image format conversion/responsive downscaling matters more than Vercel Image Optimization usage.

## Ad System Function Invocations

- Previously, `app/api/internal-ad-preview/route.ts` called `auth()` **plus a Prisma query** on every invocation and was fetched client-side once **per ad slot** (`cache: "no-store"`). `AdsterraSocialAd` renders in the root layout, so each eligible pageview triggered one DB-backed serverless invocation for the social slot plus one more for every visible in-page slot (home banner, two reader slots, chapter-list banner, browse feed). A page with N slots cost N+ DB-hitting invocations.
- Now the gate is resolved **once per authenticated page session**, not per slot. `AdGateProvider` (`components/ads/ad-gate-provider.tsx`) performs a single `fetch("/api/internal-ad-preview")` for the authenticated user and shares the result with every slot via React context. Anonymous users make no request and see no ads.
- The endpoint allows ads only for the first two created user accounts. `resolveAdGate()` (`lib/ad-gate.ts`) reads the JWT session and compares the user id against a cached first-two-id lookup (`unstable_cache`, 1h). That makes the old per-slot Prisma query disappear; DB reads for the ad gate should be at most one per cache window, not one per slot.
- Each slot builds its own Adsterra config directly from `NEXT_PUBLIC_ADSTERRA_*` env vars (`lib/ad-config.ts`) — **zero per-slot fetches**.
- The gate is **not** resolved in the root Server Component layout on purpose: calling `auth()` there reads cookies, which opts every route into dynamic rendering and would defeat the ISR `revalidate` windows on the home/manga/reader pages. Keeping the one gate read on the client preserves the static, cache-friendly page shells.
- Server-only `ADSTERRA_SCRIPT_URL` stays server-side until the gate passes for one of those first two users. Only the resolved boolean and the eligible social script URL cross the boundary.

## Postgres Connection Pooling

- `DATABASE_URL` must be a **pooled** connection string. On Vercel each concurrent serverless function opens its own DB connection, and an unpooled URL exhausts Postgres connection limits under load. Use the Neon pooler host, Supabase port `6543` (pgbouncer / transaction mode), or a Prisma Accelerate URL.
- `lib/prisma.ts` applies Prisma Accelerate's `withAccelerate()` extension automatically when `DATABASE_URL` starts with `prisma://`.
- `DIRECT_URL` is a separate **unpooled** connection wired into the Prisma datasource (`directUrl = env("DIRECT_URL")`). `prisma migrate` and introspection use it because transaction-mode poolers do not support the statements migrations require. Point it at the non-pooler host (Neon direct, Supabase `5432`).
- Both are documented in `.env.example`; no credentials are hardcoded.

## Cover Images and Vercel Image Optimization

- Covers render through `next/image` and consume Vercel **Image Optimization** transformations. This is a **separate metered limit** from Fast Origin Transfer — optimizing image variants does not count against transfer, and vice versa.
- If Image Optimization usage nears its cap, set `NEXT_PUBLIC_DIRECT_COVERS=true` (already implemented in `components/manga/cover-image.tsx`). Covers then load MangaDex thumbnails directly as unoptimized `<img>` sources, bypassing Vercel Image Optimization at the cost of WebP conversion and responsive downscaling.

## Reader Revalidation and At-Home Token Freshness

- The reader uses `revalidate = 60`. Reader pages embed **direct MangaDex at-home image URLs** whose tokens expire roughly every 15 minutes. A 60-second ISR window keeps the rendered page's embedded URLs fresh enough that most viewers receive working direct URLs.
- For long-tail chapters that have been cached longer than the token lifetime, the first viewer may receive expired at-home URLs; those requests fall back to the `/chapter-page` proxy on first view, then the page revalidates with fresh URLs.
- **Do NOT raise `revalidate`.** A longer window increases how often stale (expired-token) at-home URLs are served before revalidation, pushing more traffic onto the fallback proxy and back through Vercel compute.
- Future option (not implemented): make the reader shell static and fetch the at-home manifest **client-side** directly from `api.mangadex.org`, so tokens are always fetched fresh per view. Verify MangaDex CORS support before attempting this.

## Verification

Recommended pre-push checks for cache/networking changes:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

HTTP smoke checks:

- `/api/md/manga?limit=5&title=chainsaw` returns `Cache-Control`, `CDN-Cache-Control`, and `Vercel-CDN-Cache-Control`.
- Unsupported `/api/md/chapter?...` returns `private, no-store`.
- Invalid `/chapter-page/not-a-uuid/1` returns `private, no-store`.
- A real reader page uses direct MangaDex at-home image URLs in its `<img src>`.
- Forcing a direct image error falls back to `/chapter-page/{chapterId}/{page}` and still renders through the proxy.
- A real fallback `/chapter-page/{chapterId}/1?quality=data-saver` response returns `200 OK`, image bytes, ETag/Last-Modified, and the chapter image cache policy.
- A conditional chapter image request returns `304 Not Modified`.
- Home, browse, manga detail, and reader routes render successfully in local smoke checks.

## What To Monitor After Deploy

- Vercel Usage: Fast Origin Transfer should drop most visibly on reader traffic because image bytes should no longer traverse compute on the happy path.
- Response headers: check `x-vercel-cache` on `/api/md/manga` and fallback `/chapter-page/...` for `HIT` after warm-up; normal reader page images should appear under MangaDex at-home hosts instead.
- Vercel Image Optimization usage: cover transformations should use fewer width variants.
- Product freshness: latest updates should appear within roughly five minutes, and corrected reader pages should age out within 24 hours.
- MangaDex proxy errors: unsupported proxy endpoints are intentionally blocked until a real client path needs them.

## References

- Vercel CDN usage: https://vercel.com/docs/manage-cdn-usage
- Vercel CDN cache: https://vercel.com/docs/caching/cdn-cache
- Vercel Cache-Control headers: https://vercel.com/docs/caching/cache-control-headers
- Vercel Data Cache: https://vercel.com/docs/caching/runtime-cache/data-cache
- Vercel Image Optimization costs: https://vercel.com/docs/image-optimization/managing-image-optimization-costs
