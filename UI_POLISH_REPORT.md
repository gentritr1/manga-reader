# Manga Orbit — UI Polish Report

Rolling snapshot of UI/accessibility work. **Source of truth for design decisions
lives in [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) (tokens, type scale, component
rules) and [`BRAND.md`](./BRAND.md) (voice, identity); [`PRODUCT.md`](./PRODUCT.md)
holds the product/accessibility register.** This file only tracks status.

## Shipped

- **Reader** — RTL direction, double-page spread, fit modes with per-title memory,
  directional page-turn, idle chrome fade, same-origin page proxy, paged zoom,
  keyboard shortcuts overlay.
- **Accessibility** — accessible names on controls, `focus-visible:ring-2`
  everywhere, reader keyboard nav, corrected hover timing. This PR adds the
  touch-target floor and body-text floor (below).
- **Touch targets (PR-13)** — interactive elements meet the 44px WCAG 2.5.8 floor.
  Chips grow to `min-h-11`; compact cover controls keep their small visual and gain
  a `after:-inset-1` invisible hit-area pad (documented in `manga-card.tsx`).
- **Typography (PR-13)** — body/paragraph prose is ≥16px (`text-base`): synopsis,
  section intros, empty-state and history/login copy. Metadata stays 12–14px by
  convention (see below).
- **Contrast (PR-13)** — `npm run check:contrast` parses the oklch tokens for both
  themes and asserts WCAG 2.1 ratios per real fg/bg pair. All non-whitelisted pairs
  pass; no token nudges were required.
- **Discovery / home** — personal resume rail v2, "New for you" drops, Tonight's
  plan, reading stats strip, shelf-cards v2, shareable shelf-card export, unified
  violet palette.
- **Chapters** — volume-grouped list, sort toggle, continue CTA, read markers.
- **Performance** — browse cover windowing (virtualization), AVIF covers,
  conditional CDN preconnect, image quality pipeline, deeper prefetch, immutable
  page caching.

## Remaining

- **Reader pinch-zoom** — deferred (paged zoom shipped; gesture zoom pending).
- **Analytics cover row** — the analytics card's cover row is still a placeholder.
- **Migration baseline** — the Prisma baseline migration is still missing (flagged
  in the local-db setup commit); needs to be generated before a clean deploy.
- **Sub-16px metadata** — chapter dates, badges, stat labels, and filter chips
  remain 12–14px **by convention**, not oversight; only prose is held to the 16px
  floor.

## Verification

- `npx tsc --noEmit` + `npm run lint` clean.
- `npm run check:contrast` exits 0 (white-on-black self-test ≈21.0).
- Touch-area / prose sizes verified by grep + code review; a 375px/1280px visual
  pass is done by the reviewer against the running dev server.
