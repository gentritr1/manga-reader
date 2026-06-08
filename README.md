# Yomi — Modern Manga Reader

A sleek, fast, distraction-free manga reader built with **Next.js 16**, powered by the
open-source **MangaDex API**. Includes accounts (email + Google), a synced favorites
library, reading history, and pluggable **Adsterra** ad slots (an AdSense alternative that
works in regions like Kosovo).

## Features

- 🔍 **Browse & search** thousands of titles with genre / status / sort filters and infinite scroll
- 📖 **Clean reader** — vertical (webtoon) and paged modes, keyboard navigation, image preloading
- ❤️ **Favorites library** + **Continue reading** shelf, synced to your account
- 🔐 **Auth** — email/password and optional Google sign-in (Auth.js + Prisma)
- 📣 **Ad slots** on chapter intro / end / browse pages (the image reader stays ad-free)
- 🌗 Dark-first theme with light toggle, responsive and mobile-friendly

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Auth.js (NextAuth v5) · Prisma ·
TanStack Query · MangaDex API

## Getting started

```bash
npm install
cp .env.example .env.local        # then edit values (see below)
npx prisma db push                # creates the SQLite dev database
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

Local development uses **SQLite** out of the box (no setup). For production, use Postgres:

1. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
2. Set `DATABASE_URL` to your Neon / Supabase connection string.
3. Run `npx prisma db push` (or `npx prisma migrate deploy`).

## Ads (Adsterra)

AdSense is unavailable in some regions, so this uses **Adsterra** behind a reusable
`<AdSlot>` component. To enable:

1. Create an Adsterra publisher account and add your site.
2. Create **Native Banner** ad units for the placements you want.
3. Paste each unit's `invoke.js` src and container id into `.env.local`
   (`NEXT_PUBLIC_ADSTERRA_*`), and set `NEXT_PUBLIC_ADS_ENABLED="true"`.

Ads render on the **chapter intro screen**, the **chapter end screen**, and **browse/home
banners** — never overlaid on the manga page images. This respects the MangaDex API Terms
of Use, which prohibit monetizing their content directly. Want a different ad network?
Swap the script logic inside `components/ads/ad-slot.tsx`; the rest of the app is agnostic.

> **Note on the source API:** MangaDex is free and legal but its ToS forbids ads *on* their
> content. If you ever need ads embedded directly in the page reader, you would have to
> switch to a different (aggregator) source such as Consumet — not included here.

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
```

## Scripts

- `npm run dev` — dev server
- `npm run build` / `npm start` — production
- `npx prisma studio` — inspect the database
