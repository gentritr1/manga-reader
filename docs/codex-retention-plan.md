# Yomi — Retention & Delight Plan (for Codex)

This is an implementation brief. Read it fully before writing code.

## Ground rules (do not skip)

1. **This repo's Next.js is NOT the one you know.** Before touching any route,
   image, caching, or transition API, read the relevant guide in
   `node_modules/next/dist/docs/`. Heed deprecation notices. (See `AGENTS.md`.)
2. **Design tokens only.** No one-off colors. Coral = reading actions,
   violet = brand/saved/selected, cyan = discovery/newness. See `BRAND.md` and
   `DESIGN_SYSTEM.md`.
3. **Every animation must respect `prefers-reduced-motion`.** Provide a
   non-animated equivalent, not a missing feature.
4. **WCAG AA is a product requirement** (`PRODUCT.md`): keyboard nav, visible
   focus, ≥16px body text, one-handed mobile use.
5. **Voice:** short, concrete manga-reader language. No battle/arena language,
   no "heat" without a real signal, no backend words in UI copy.
6. **Bandwidth budget: ~zero.** Every feature below is CSS/JS/state or reuses
   data and images the client already fetched. Do not add new image fetches,
   fonts, or heavy libraries. `framer-motion` and `html-to-image` are already
   dependencies — reuse them.
7. Ship each phase as its own branch/PR. Run `npm exec eslint app components`,
   `npm exec tsc -- --noEmit`, and `npm run build` before calling anything done.
8. **Database budget (Neon free tier: 100 CU-hrs, 0.5 GB, auto-suspend).**
   The DB must stay near-idle: prefer localStorage for anything that doesn't
   need cross-device sync; batch/debounce writes (≥60s cadence during a
   session, flush on `pagehide`); derive new stats from existing rows instead
   of adding write paths; never add polling or keep-alive pings that would
   defeat auto-suspend. For the react-query `["history"]` fetch used on the
   homepage, set a `staleTime` (~5 min) and `refetchOnWindowFocus: false` so
   tab switches don't re-query the DB.

## Why these features (context)

Yomi's differentiation vs aggregators (MangaKakalot-class) and MangaDex is:
a reader flow with zero interruption + a personal memory layer (continue
reading, shelves, Chapter Pulse). These features deepen exactly that moat.
The retention target: make ending a chapter feel like an earned moment that
points at the next one, and make coming back daily feel like a quiet ritual —
"the night shelf" — never like a toxic streak-guilt app.

---

## Phase 1 — Retention core

### 1.1 Exact-position resume ("your bookmark, to the page")

**Goal:** Reopening Yomi puts you back on the exact page you left, and the
homepage tells you so. This is the single highest-retention feature we can ship
and it costs zero bandwidth.

**Current state:** `ReadingProgress` (Prisma) stores manga/chapter; the reader
(`components/reader/reader.tsx`) already tracks `currentPage` (vertical, via
IntersectionObserver) and `slide` (paged). `POST /api/history` fires once on
mount. Continue-reading cards (`components/home/continue-reading.tsx`) link to
the chapter head.

**Spec:**
- Persist `page` (int) and, for vertical mode, a coarse scroll anchor (the page
  number is enough — do NOT store pixel offsets, they break across viewports).
- Write path: debounce hard — the DB (Neon free tier) should see as few writes
  as possible. Update `localStorage` (`yomi-progress:<chapterId>`) immediately
  on page change; PATCH the server at most once per 60s while reading and
  always on `pagehide` (reuse the `flushReadingSession` keepalive pattern
  already in `reader.tsx`). localStorage is the source of truth mid-session;
  the server write is a sync checkpoint, not a live mirror.
- Read path: on reader mount, if saved page > 1 and > 30s old, show a small
  dismissible chip (bottom, above the tab bar): "Resume at page 14" with a
  coral resume action. Do NOT auto-jump — surprise scrolling is hostile. Chip
  auto-dismisses after ~6s. Reduced-motion: chip appears/disappears with
  opacity only.
- Continue-reading cards: add "Page 14 of 38" line + a thin determinate
  progress bar (violet, token-based) under the chapter label. Card link goes to
  the chapter as today; the in-reader chip handles the jump.
- Schema: add `page Int?` and `totalPages Int?` to `ReadingProgress` via a
  proper Prisma migration. Validate with zod in the API route (page ≥ 1,
  ≤ 2000).

**Edge cases:** chapter re-opened after finishing (saved page == total → no
chip); signed-out users (localStorage only — works, just doesn't sync; do not
promise sync in copy, per `BRAND.md`); data-saver/paged/vertical mode switches
(page number is mode-agnostic, that's why we store page not scroll offset).

**Acceptance:** kill the tab mid-chapter, reopen → chip offers the right page
in both modes; homepage card shows correct fraction; no layout shift from the
chip; keyboard focus can reach and dismiss it.

### 1.2 Chapter-end momentum card

**Goal:** The end of a chapter is our highest-leverage retention moment.
Replace the flat "Next chapter" ending with a small earned-moment card.

**Current state:** `ChapterNav` in `reader.tsx` renders "Next chapter" /
"You're all caught up." The reader already computes `pagesSeen`, duration
(`sessionRef`), and already **preloads pages 1–5 of the next chapter**
("Predictive Commute Caching") — so a next-chapter tease image is already in
the browser cache. Free.

**Spec:**
- End-of-chapter block becomes a card: 
  - Line 1 (quiet, muted): "42 pages · 7 min" from the existing session state.
  - Tease: next chapter's page-1 image, small (max-h ~160px), heavily rounded,
    slight bottom fade into the card — it must read as a peek, not a spoiler
    dump. Only render it if the image is already preloaded (attempt via the
    same `/chapter-page/<nextId>/1` URL the preloader used; `onError` → hide,
    never retry — this guarantees zero *new* origin fetches on slow paths).
  - Primary coral CTA unchanged: "Next chapter".
  - If no next chapter: "You're all caught up." + one violet "Add to library"
    action (if not already saved) + link back to the manga page.
- Motion: card rises 8px + fades on scroll-into-view (framer-motion,
  `useReducedMotion` → fade only). Duration ≤ 300ms. No confetti, no counters
  spinning up — cinematic, not loud.
- Keep `InternalAdPreview` placement below the card, unchanged.

**Acceptance:** works in vertical and paged end slide; with `saveData` on, no
tease image request is issued; stats match the analytics flush numbers.

### 1.3 Reading streak — "the lantern"

**Goal:** A gentle daily-return signal. Explicitly anti-toxic: no loss shaming,
no push pressure. The metaphor is a lantern on the night shelf that's lit
because you read today — not a fire you must not drop.

**Current state:** `ReadingSession` (Prisma) already records per-chapter
sessions with timestamps — the streak can be **derived**, no new write path.

**Spec:**
- Server: `GET /api/analytics/streak` (or fold into existing analytics
  aggregation) computes current streak from distinct local-days with ≥1
  session. Accept a `tz` offset param from the client; day boundaries in the
  reader's timezone. Include one automatic grace day per 7 (a missed single day
  between two read days doesn't break it) — mention it nowhere in UI copy, it
  should just feel forgiving.
- UI: a small lantern/flame-free indicator — use a subtle violet dot/glow on
  the user menu avatar plus "Read today" state, and the number inside the user
  menu and on the Chapter Pulse card (`app/analytics/analytics-client.tsx`):
  "12-day rhythm". Word it as *rhythm*, not streak, to stay out of Duolingo
  territory. Cyan is allowed here (newness/discovery accent), coral is not.
- The momentum card (1.2) gets one quiet line when the streak ticked today:
  "That's 12 days in a row." — only on the first chapter of the day.
- No notifications, no emails, no badge counts. This is ambient.

**Acceptance:** streak correct across timezone boundaries (test UTC±); no
streak UI for signed-out users; Chapter Pulse export image includes the rhythm
line.

---

## Phase 2 — Perceived quality (the "how is this free" layer)

### 2.1 View Transitions: cover morph

**Goal:** The cover image visually morphs card → manga detail page → reader
intro. This is the single cheapest "premium app" signal on the web right now:
pure browser API, zero bytes.

**Spec:**
- Read `node_modules/next/dist/docs/` for this Next version's view-transitions
  support and API shape **before writing anything** — do not assume the
  experimental flag/name from training data.
- Give cover images a stable `view-transition-name` derived from manga id
  (e.g. `cover-<id>`) on: manga cards (`components/manga/manga-card.tsx`),
  hero spotlight, continue-reading cards, and the detail page cover.
  Only ONE element per name may be on screen at once — for carousels/grids set
  the name via JS on click (or only on the navigated card) rather than
  statically on every card; verify no duplicate-name console errors.
- Fallback: browsers without the API get normal navigation. No polyfill.
- Reduced motion: disable via media query (`::view-transition-*` rules gated).
- Keep default page crossfade subtle and fast (≤ 250ms).

**Acceptance:** card → detail morph works on Chrome/Edge/Safari-TP-class
browsers; Firefox degrades cleanly; no console warnings about duplicate
transition names; Lighthouse CLS unchanged.

### 2.2 Per-series ambient tint

**Goal:** Each series subtly tints the reader chrome — the progress line,
control-selected states, and the detail-page glow pick up the cover's dominant
color. Feels bespoke per story; costs one canvas read of an image that's
already rendered.

**Spec:**
- Extract dominant color client-side from the already-loaded cover `<img>` via
  a tiny canvas sample (downscale to ~16×16, average with saturation bias —
  write it by hand, ~30 lines, no new dependency). The cover is served
  same-origin via the proxy, so the canvas is not tainted — verify, and if a
  path serves cross-origin covers, skip extraction silently.
- Clamp the result into brand-safe space: convert to OKLCH, clamp lightness
  and chroma so contrast against reader chrome stays AA for any text it
  touches; never output a color that competes with coral CTAs.
- Cache: `localStorage` (`yomi-tint:<mangaId>` → oklch string). Compute once.
- Apply as a CSS variable override (e.g. `--series-tint`) scoped to the reader
  root and detail-page hero glow only. Default: current `--shelf-edge`. The
  vertical progress line, paged-mode ambient glow overlay, and detail hero
  backdrop consume it.
- Do NOT tint buttons, text, focus rings, or anything semantic.

**Acceptance:** two different manga visibly produce different (but quiet)
reader lines/glows; light and dark mode both stay AA; zero extra network
requests (verify in devtools).

### 2.3 Micro-interactions pass

**Goal:** Three tiny moments of craft, all framer-motion, all
reduced-motion-aware, all ≤ 300ms:

1. **Paged page-turn:** crossfade + 12px horizontal slide in the direction of
   travel (direction-aware). Never animate the image while it's still loading —
   animate a wrapper, keyed by slide index.
2. **Save-to-shelf:** the favorite/add-to-shelf action plays a small
   "settle onto the shelf" dip (scale 0.92 → 1 with slight y-settle) and the
   icon fills violet. Reuse in `favorite-button.tsx` and
   `add-to-shelf-button.tsx`.
3. **Continue-reading progress bar** (from 1.1) animates width on mount once,
   origin-left, 400ms ease-out. Reduced motion: static.

**Acceptance:** `prefers-reduced-motion: reduce` shows no translation/scale
anywhere (fades allowed); interactions stay responsive (no animation blocking
input); no layout shift.

---

## Phase 3 — Discovery & distribution loops

### 3.1 "Tonight's binge" — deterministic editorial module

**Goal:** One curated-feeling pick per day on the homepage, from data we
already fetch. It must answer "why this now?" in one factual line (brand rule).

**Spec:**
- Server-side in `app/page.tsx` data flow: from the existing
  popular/latest payloads (see `lib/mangadex-server.ts`), filter candidates:
  status completed OR chapter count high, exclude the current hero. Pick one
  deterministically with a date-seeded index (UTC date string hashed), so it
  rotates daily, is stable for the whole day, and is fully cacheable within the
  existing `revalidate = 300`.
- Render as a wide card between "Popular right now" and "Fresh chapter drops":
  cover (already in payload), title, one editorial reason built from real
  metadata — e.g. "Completed · 142 chapters · no waiting between arcs" or
  "Updated this week · 3 new chapters". Template from facts; never invent.
- CTA: coral "Start chapter 1". Secondary: violet "Add to library".
- Copy header: "Tonight's binge". Cyan accent allowed on the "why" line.

**Acceptance:** same pick all day, changes next day; renders nothing (no empty
shell) when no candidate qualifies; zero additional MangaDex API calls.

### 3.2 Time-to-read estimates — "fits your break"

**Goal:** Commute readers (core persona) can pick a chapter that fits the time
they have. Zero bandwidth: estimate = page count × median seconds/page.

**Spec:**
- Global default 8s/page; if the signed-in user has ReadingSession data, use
  their personal average (the analytics page already computes it — reuse that
  aggregation, don't duplicate).
- Show "~6 min" muted, next to page count in the chapter list
  (`components/manga/chapter-list.tsx`) and on the reader intro slide.
  Round to minutes; under 1 min → "~1 min".
- No new API calls from the chapter list: page counts must come from data
  already in the chapter payload — if page count isn't in the list payload,
  show estimates only where it is available (reader intro, momentum card) and
  skip the list rather than adding N requests. Check `lib/mangadex-server.ts`
  first and state in the PR which path was possible.

**Acceptance:** estimates render with no added network traffic (verify);
personal average kicks in for users with history.

### 3.3 Shareable shelf card

**Goal:** Chapter Pulse already exports a PNG recap — extend the same
`html-to-image` pattern to the shelf, because shelves are visual (covers) and
covers are what travels on Discord/TikTok, where our audience discovers manga.

**Spec:**
- On `/shelves` (see `app/shelves/shelves-client.tsx`): "Share shelf" action →
  renders an off-screen, fixed-size (e.g. 1080×1350, 4:5 for feeds) night-shelf
  composition: dark ink surface, up to 6 covers arranged as a shelf with the
  thin shelf-edge line (violet/cyan/coral motif from `BRAND.md`), shelf name,
  "yomireader.com" footer — visually consistent with the Chapter Pulse card.
- Export with `toPng` at `pixelRatio: 2`, download named
  `yomi-shelf-<slug>.png`. Covers are already in the browser (same-origin
  proxy) — no new fetches beyond what the page shows; if a cover isn't loaded
  yet, wait for it or render its slot as a token-colored spine.
- Empty/1-cover shelves: still compose gracefully (spines + title), never a
  broken grid.

**Acceptance:** export works on mobile Safari and Chrome; output is crisp at
2x; no tainted-canvas errors; covers align with no distortion.

---

## Sequencing & sizing

| Order | Item | Size | Files touched (primary) |
|---|---|---|---|
| 1 | 1.1 exact resume | M | reader.tsx, continue-reading.tsx, api/history, prisma migration |
| 2 | 1.2 momentum card | S–M | reader.tsx |
| 3 | 1.3 streak/rhythm | M | api/analytics, user-menu.tsx, analytics-client.tsx, reader.tsx |
| 4 | 2.1 view transitions | S | manga-card, hero, manga/[id], globals css |
| 5 | 2.3 micro-interactions | S | reader.tsx, favorite-button, add-to-shelf-button |
| 6 | 2.2 ambient tint | M | new lib/extract-tint.ts, reader.tsx, manga/[id] |
| 7 | 3.1 tonight's binge | S | app/page.tsx, new home component |
| 8 | 3.2 read-time estimates | S | chapter-list.tsx, reader intro |
| 9 | 3.3 shelf share card | M | shelves-client.tsx, new share component |

One PR per row (1.2 + 1.3 may combine since both live at chapter end). After
each PR: eslint, tsc, build, and a 390px-viewport mobile check (no horizontal
overflow outside intended rails).

## Pipeline task (fold into the 1.2 + 1.3 PR)

Make future migrations apply automatically on deploy:

- Change the `build` script in `package.json` to
  `prisma generate && prisma migrate deploy && next build`.
- `migrate deploy` uses `DIRECT_URL` (unpooled) per the datasource comments in
  `prisma/schema.prisma` — do not point it at the pooled URL.
- **Known state:** the `20260704120000_add_reading_progress_page` migration was
  applied to production manually via SQL editor, so it is NOT recorded in
  `_prisma_migrations`. The repo owner will baseline it with
  `prisma migrate resolve --applied 20260704120000_add_reading_progress_page`
  (run once against production) BEFORE this PR is deployed. Note this
  prominently in the PR description; do not try to work around it in code.
- Local dev intentionally runs on SQLite (`file:./dev.db`) and is exempt —
  never run `migrate deploy` as part of local dev scripts.
