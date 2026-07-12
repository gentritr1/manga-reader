# Yomi — Manga Discovery Reader

Yomi is a polished, mobile-first manga discovery and reading app built with
**Next.js 16** and powered by the open-source **MangaDex API**.

The product direction is a "night shelf": cover-led discovery, fast paths into
the next chapter, a calm library layer, and a UI that feels deliberate rather
than aggregator-like. Accounts, synced favorites, reading history, Vercel
Analytics, and optional donation support are included.

## Features

- Browse and search thousands of titles with genre, status, sort filters, and
  infinite scroll.
- Read in vertical webtoon or paged modes with keyboard navigation and image
  preloading.
- Save favorites and resume reading with account-backed library/history.
- Sign in with email/password or optional Google OAuth.
- Keep the MangaDex-backed experience ad-free, with optional donations that do
  not change reader access or features.
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
- `NEXT_PUBLIC_SUPPORT_URL` — optional. When set, the support page links to your
  donation provider.
- `ADSTERRA_SCRIPT_URL` — optional, server-only. When set, the social script is
  injected only for the first two created user accounts.
- `NEXT_PUBLIC_ADS_ENABLED` — set to `true` to enable the configured in-page
  Adsterra placements for those same first two accounts.
- `NEXT_PUBLIC_ADSTERRA_BANNER_KEY` — optional 728x90 home/detail banner key.
- `NEXT_PUBLIC_ADSTERRA_CHAPTER_END_KEY` — optional 300x250 reader-end key.
- `NEXT_PUBLIC_ADSTERRA_CHAPTER_START_SRC` /
  `NEXT_PUBLIC_ADSTERRA_CHAPTER_START_CONTAINER` — optional native in-feed slot
  used on browse.

## Database

The app uses **Postgres** through Prisma. Create a hosted database with Neon,
Supabase, Vercel Postgres, or another Postgres provider, then:

1. Set `DATABASE_URL` to the **pooled** Postgres connection string (Neon pooler,
   Supabase port `6543`, or Prisma Accelerate). On Vercel serverless an unpooled
   URL exhausts DB connection limits under load.
2. Set `DIRECT_URL` to the **unpooled** connection string for migrations
   (transaction-mode poolers break `prisma migrate`).
3. If `DATABASE_URL` starts with `prisma://`, `lib/prisma.ts` automatically
   enables Prisma Accelerate's client extension.
4. Put both `DATABASE_URL` and `DIRECT_URL` in `.env` — the Prisma CLI reads
   `.env`, not `.env.local`. If you keep them in `.env.local`, run Prisma with
   dotenv instead, e.g. `dotenv -e .env.local -- npx prisma migrate dev`.
5. Run `npx prisma db push` (or `prisma migrate`) against that database.
6. Add the same `DATABASE_URL` and `DIRECT_URL` in Vercel project environment
   variables.

### Local database (no Neon needed)

For local testing you don't need a hosted database — Prisma ships a local
Postgres-compatible server (`prisma dev`, PGlite-based, no Docker):

1. Start it (needs Node ≥ 23.4, or 22.5–23.3 with the flag shown):

   ```bash
   NODE_OPTIONS=--experimental-sqlite npx prisma dev
   ```

   It prints a `postgres://postgres:postgres@localhost:51214/template1?...`
   connection string and keeps running (leave the terminal open; data persists
   across restarts).
2. Put that string in **both** `.env` (Prisma CLI) and `.env.local` (Next.js)
   as `DATABASE_URL` and `DIRECT_URL`.
3. Create the tables: `npx prisma migrate deploy` (the migrations folder has
   a full baseline; `db push` also works but skips migration bookkeeping).
4. `npm run dev` as usual. Sign-up, favorites, shelves, and history sync now
   work fully offline.

> **Migration baseline:** `prisma/migrations/0_init` is a baseline that,
> together with the later incremental migrations, rebuilds the exact current
> schema from empty (verified via `prisma migrate diff --from-migrations`,
> "No difference detected"). Databases that predate the baseline (e.g. the
> production Neon DB, which was bootstrapped with `db push`) must record the
> migrations as already applied **once**, using the direct (unpooled) URL:
>
> ```bash
> npx prisma migrate resolve --applied 0_init
> npx prisma migrate resolve --applied 20260704120000_add_reading_progress_page
> ```
>
> After that, `prisma migrate deploy` works normally everywhere.

Alternatively, `docker-compose.yml` provides a real Postgres 15 on port 5432
(`docker compose up -d db`) if you prefer Docker:
`postgres://postgres:postgres@localhost:5432/manga_reader`.

## Support and source policy

The current app uses the MangaDex API. MangaDex's API acceptable usage policy says
API-backed websites and apps **cannot run ads or paid services**. Confirm your
content source and license terms before enabling any revenue ad script.

Optional donations are allowed as project support. Donations must not change
access to manga, chapters, faster loading, search advantages, sync, offline
reading, reader features, or any other access tied to MangaDex API-provided data.
Configure `NEXT_PUBLIC_SUPPORT_URL` to point `/support` at a donation provider
such as GitHub Sponsors, Ko-fi, Open Collective, or Patreon donation-only tiers.

If you want revenue ads or paid product plans, first switch to a content source
or license model that explicitly allows monetization.

`ADSTERRA_SCRIPT_URL` and the configured in-page Adsterra placements are
intentionally gated to the first two created user accounts. Logged-out users and
later accounts see no ad config.

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
components/     ui primitives, layout chrome, manga cards, reader, auth
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
