# Yomi — Manga Discovery Reader

Yomi is a premium, mobile-first manga discovery and reading app built with
**Next.js 16** and powered by the open-source **MangaDex API**.

The product direction is a "night shelf": cover-led discovery, fast paths into
the next chapter, a calm library layer, and a UI that feels deliberate rather
than aggregator-like. Accounts, synced favorites, reading history, Vercel
Analytics, and optional Adsterra slots are included.

## Features

- Browse and search thousands of titles with genre, status, sort filters, and
  infinite scroll.
- Read in vertical webtoon or paged modes with keyboard navigation and image
  preloading.
- Save favorites and resume reading with account-backed library/history.
- Sign in with email/password or optional Google OAuth.
- Keep the image reader ad-free while supporting optional intro/end/browse ad
  placements.
- Use a token-based dark/light design system with mobile-first homepage
  discovery.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Auth.js (NextAuth v5) · Prisma ·
TanStack Query · MangaDex API · Vercel Analytics

## Product and design source of truth

- `PRODUCT.md` defines the product target, audience, principles, and
  accessibility baseline.
- `BRAND.md` defines the current Yomi identity, voice, allowed motifs, and
  forbidden patterns.
- `DESIGN_SYSTEM.md` defines semantic tokens, component rules, migration order,
  and open design decisions.

New UI should use the semantic tokens in `app/globals.css` instead of adding
one-off colors. Local webfont files are ignored until a brand font is selected
with a license that clearly allows self-hosted web serving.

## Getting started

```bash
npm install
cp .env.example .env.local        # then edit values (see below)
npx prisma db push                # creates/updates the database schema
npm run dev                       # http://localhost:3000
```

### Environment variables

`DATABASE_URL` lives in `.env` (so the Prisma CLI sees it); everything else goes in
`.env.local`. See `.env.example` for the full list.

- `AUTH_SECRET` — required. Generate with `npx auth secret` or `openssl rand -base64 32`.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional. When set, a "Continue with Google"
  button appears. Add `http://localhost:3000/api/auth/callback/google` as an authorized
  redirect URI in Google Cloud Console.
- Ads — see below.

## Database

The app uses **Postgres** through Prisma. Create a hosted database with Neon,
Supabase, Vercel Postgres, or another Postgres provider, then:

1. Set `DATABASE_URL` to the hosted Postgres connection string.
2. Run `npx prisma db push` against that database.
3. Add the same `DATABASE_URL` in Vercel project environment variables.

## Ads (Adsterra)

The current app uses the MangaDex API. MangaDex's API acceptable usage policy says
API-backed websites and apps **cannot run ads or paid services**. Keep
`NEXT_PUBLIC_ADS_ENABLED="false"` while MangaDex is the content source unless you
have explicit permission from MangaDex or switch to a source where revenue ads are
allowed.

For a cleared source, the app uses **Adsterra** behind a reusable `<AdSlot>`
component. To enable:

1. Create an Adsterra publisher account and add your site.
2. Create ad units for the placements you want. The bundled slots support a native
   browse in-feed unit, a 300x250 iframe at chapter end, a 728x90 desktop banner,
   and an optional 320x50 mobile banner.
3. For native ads, set both the `invoke.js` src URL and container id. For iframe ads,
   set only the iframe key. Enable rendering with `NEXT_PUBLIC_ADS_ENABLED="true"`.

Placement mapping:

```env
NEXT_PUBLIC_ADSTERRA_BROWSE_FEED_SRC=""        # native invoke.js URL
NEXT_PUBLIC_ADSTERRA_BROWSE_FEED_CONTAINER=""  # native container id
NEXT_PUBLIC_ADSTERRA_CHAPTER_END_KEY=""        # 300x250 iframe key
NEXT_PUBLIC_ADSTERRA_BANNER_KEY=""             # 728x90 desktop iframe key
NEXT_PUBLIC_ADSTERRA_MOBILE_BANNER_KEY=""      # 320x50 mobile iframe key
```

When ads are legally allowed, they render on **browse in-feed discovery**, the
**chapter end screen**, and **home/detail banners** — never overlaid on manga page
images and never before the first reader page. Want a different ad network? Swap
the script logic inside `components/ads/ad-slot.tsx`; the rest of the app is
agnostic.

For backwards compatibility, the old `NEXT_PUBLIC_ADSTERRA_CHAPTER_START_SRC` and
`NEXT_PUBLIC_ADSTERRA_CHAPTER_START_CONTAINER` values are still accepted as fallbacks
for the browse in-feed native unit.

> **Source policy note:** Do not enable revenue ads on the MangaDex-backed app.
> If you want ad revenue, first switch to a source/license model that permits it.

## How content works

All manga data comes from the MangaDex API.

- Server components fetch directly (`lib/mangadex-server.ts`) with the required `User-Agent`
  and Next.js caching.
- Client components (search, infinite scroll) go through the `/api/md/[...path]` proxy to
  avoid CORS (`lib/mangadex-client.ts`).
- **Official / licensed chapters** are hosted off-site (e.g. on the publisher). These have no
  in-app pages; the reader detects them and links to the official site instead, and they're
  marked "Official" in the chapter list.

## Project layout

```
app/            routes (home, browse, manga/[id], read/[chapterId], login, signup, favorites, api/*)
components/     ui primitives, layout chrome, manga cards, reader, ads, auth
lib/            mangadex client/server, auth, prisma, hooks
prisma/         schema + dev.db
BRAND.md        Yomi brand identity and voice
DESIGN_SYSTEM.md semantic token and component rules
```

## Scripts

- `npm run dev` — dev server
- `npm run lint` — ESLint
- `npm run build` — Prisma generate + production Next.js build, matching the
  main Vercel build gate
- `npm start` — run the production build locally
- `npx prisma studio` — inspect the database

Before pushing to `main` or relying on Vercel, run:

```bash
npm run lint
npm run build
```
