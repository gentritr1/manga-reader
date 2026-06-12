# Yomi UI Polish Report

## Current State

Yomi is now close to PR-ready from a product and visual design standpoint. The homepage has a clearer premium anime-reader identity, stronger first-viewport composition, mobile-safe navigation, better discovery hierarchy, and fewer generic UI patterns.

Current design confidence: 8.5/10.

The app no longer reads like a plain manga database. The remaining gap is deeper product distinctiveness: richer recommendation logic, more editorial discovery moments, and stronger original brand assets.

## What Changed

- Added `PRODUCT.md` as the product register for brand direction, users, accessibility baseline, anti-references, and product feeling.
- Added Impeccable support for Codex and Claude through `.codex/skills/impeccable` and `.claude/skills/impeccable`.
- Added `.impeccable/live/config.json` for live UI workflows against the Next App Router layout.
- Rebuilt the homepage around a stronger spotlight hero with cover art, secondary cover collage, richer metadata, and clearer CTAs.
- Reworked the homepage content flow into discovery-first sections: continue reading, reader heat, and fresh chapter drops.
- Replaced generic color values with OKLCH design tokens for light and dark mode, including warm, cool, spotlight, and status roles.
- Improved mobile navigation with larger targets, better wrapping, icon support, and a mobile-safe search layout.
- Made continue-reading useful even when empty by showing a return-shelf onboarding module instead of disappearing.
- Improved manga cards with visible favorite controls, larger touch targets, clearer overlays, eager loading for above-fold images, and stronger focus states.
- Improved carousels with keyboard/ARIA affordances, reduced-motion aware scrolling, and mobile edge hints.
- Improved browse filters with labels, `aria-pressed` genre chips, query cancellation, route heading, and larger form controls.
- Improved reader accessibility with a route-level heading, labeled controls, mode pressed states, safer click zones, and no global footer inside reader routes.
- Kept the reader flow clear of monetization prompts so chapters start cleanly.
- Updated Next config for Turbopack root handling and LAN dev origins.
- Removed deprecated Next Image `priority` usage and aligned loading behavior with Next 16 guidance.

## Validation

- `npm exec eslint app components`
- `npm exec tsc -- --noEmit`
- `node .codex/skills/impeccable/scripts/detect.mjs --json app components`
- `npm run build`
- Mobile CDP layout check at 390px CSS viewport: document width matched viewport width; only intended horizontal rails extended offscreen.

## Design Next Steps

1. Build a stronger visual identity system.
   Add a small set of branded motifs, manga-inspired section treatments, and a more intentional cover presentation language. Keep it restrained, not decorative for its own sake.

2. Create more editorial discovery modules.
   Add modules like "Tonight's binge", "Fast first chapters", "Hidden ongoing picks", "Finished series worth starting", and "New this week". These should feel curated, not like generic sorted grids.

3. Improve empty and signed-out states.
   The current empty continue-reading module is much better, but login, signup, favorites, and history can still become more emotionally specific and less transactional.

4. Add a design system reference.
   Document color roles, type scale, button behavior, card rules, carousel rules, focus states, and mobile layout principles so future UI work stays consistent.

5. Add motion carefully.
   Use subtle, reduced-motion-aware transitions for rail scrolling, favorite saves, library updates, and reader mode switching. Avoid heavy animated backgrounds.

## Performance Next Steps

1. Track real LCP and image behavior.
   The hero cover is likely the key LCP asset. Add field or lab checks for LCP, CLS, and INP after deployment.

2. Review image sizing across cards and detail pages.
   Current image loading is improved, but the app should verify exact `sizes` values against real grid widths on mobile, tablet, and desktop.

3. Add caching strategy documentation.
   MangaDex requests, search results, popular rails, and latest updates should have explicit cache lifetimes and failure behavior.

4. Consider server-rendered browse defaults.
   The browse page currently has a client-heavy search flow. Keeping first-load popular/latest content server-rendered would improve perceived speed.

5. Reduce duplicated skill payload if repository size matters.
   The committed Impeccable skill copies are useful for both harnesses, but they add a lot of files. If repository weight becomes a concern, move skill installation to a setup script.

## Security Next Steps

1. Audit auth and session flows.
   Review login, signup, NextAuth callbacks, session persistence, and redirect handling for edge cases and open redirect risk.

2. Harden API route input validation.
   Validate and constrain inputs for favorites, history, MangaDex proxy paths, registration, and search parameters.

3. Add rate limiting.
   Favorites, history, auth-adjacent endpoints, and MangaDex proxy routes should have basic rate limits or abuse protection.

4. Review external URL handling.
   Licensed chapters link out to official sources. Keep `rel="noopener noreferrer"` and validate external URLs before rendering.

5. Keep support and monetization boundaries clear.
   Support prompts should remain opt-in and low-pressure. Do not add revenue ads or paid MangaDex-backed feature gates.

## Feature Next Steps

1. Daily return shelf.
   Build a signed-in home module that blends reading history, latest followed updates, and saved titles into one "what to read next" surface.

2. Follow notifications.
   Add notifications for new chapters on favorited titles, with quiet defaults and clear unsubscribe behavior.

3. Collections.
   Let power readers create shelves such as "Reading", "Waiting", "Finished", "Weekend binge", and "Try later".

4. Better recommendations.
   Use tags, status, completion, popularity, and reading history to recommend similar manga without overwhelming casual users.

5. Reader quality controls.
   Add high contrast reading mode, fit-width controls, page gap controls, keyboard shortcuts, and persistent per-device reader preferences.

6. Better legal/licensed handling.
   Turn licensed-only titles into useful destination pages with official links, series metadata, save/follow actions, and clear creator-support messaging.

## Focus Recommendation

The next highest-value product work is discovery depth, not more generic UI polish. Prioritize:

1. Editorial discovery modules on the homepage.
2. A real signed-in "next chapter" habit loop.
3. Performance measurement around images and first load.
4. API validation and rate limiting.

That path best supports the product goal: users should feel "one more chapter", not "where do I click next?"
