# Yomi Brand System

## Current Brand Decision

Yomi is the working product name.

It is short, readable, and clearly related to reading. It is not yet treated as
a finished trademark or domain decision. Before launch, check name availability,
domain options, and trademark risk.

## Brand Platform

Promise: Find your next chapter fast, then fall into the story.

Positioning: Yomi is a premium, mobile-first manga discovery shelf. It should
feel like a daily story ritual, not an aggregator index or a generic content
database.

Core feeling: one more chapter.

Personality:

- Cinematic, but not loud.
- Quick, because readers often arrive during short breaks.
- Intimate, like a personal shelf that remembers what matters.
- Lightly fandom-aware, without becoming childish or meme-heavy.

## Identity Direction

Working concept: the night shelf.

The interface should feel like opening a quiet shelf of manga covers at night:
dark ink surfaces, warm chapter actions, bright cover art, and clear paths back
into reading.

Signature motifs:

- Shelf: saved, resumed, and recommended stories.
- Spotlight: one story gets a premium first impression.
- Chapter momentum: CTAs should move users toward reading, saving, or browsing.
- Shelf edge: a thin violet/cyan/coral line can mark Yomi-owned shelf surfaces.
  Use it sparingly as a product signature, not as decoration on every card.
- Editorial reason: the spotlight should always answer "why this now?" in one
  short, factual line.
- Mark: a rounded night-shelf tile with an open book, coral bookmark, and cyan
  shelf edge. Use this as the favicon, app icon, and primary product mark.

## Source Of Truth For This Branch

Treat Yomi as the branch name and product identity until we deliberately replace
it. Do not introduce alternate names or brand metaphors in UI copy.

Allowed motifs:

- Night shelf
- Spotlight pick
- Chapter momentum
- Library/save
- Fresh updates

Banned motifs:

- Heat, unless it is backed by a real ranking signal.
- Battle/arena language.
- Generic AI phrases such as "discover your next adventure".
- Backend/source language in user-facing copy.

Homepage sections should be literal and story-forward: spotlight, start or
continue shelf, popular right now, fresh chapter drops.

Mobile homepage rule:

The first viewport should show the cover-led spotlight and a recovery path. If
the spotlight is not the reader's mood, they should be able to search, browse
popular, or jump to latest updates without hunting through the page.

CTA ownership:

- Coral is for primary reading or starting actions.
- Violet is for brand, selected states, focus, and saved/library framing.
- Cyan is for future discovery/newness cues, not primary CTAs.
- Saved/in-library states belong to violet library tokens, never coral.

## Voice

Use short, concrete manga-reader language.

Good:

- View chapters
- Continue reading
- Popular right now
- Latest updates
- Start your shelf
- Add to library

Avoid:

- Heat, unless backed by a real heat signal.
- Vague metaphors like "return shelf" or "back to the surface".
- Backend language like "de-duplicated", "feed", or "source".
- Claims the product cannot fulfill, such as signed-out reading sync.

## Color Roles

Yomi uses violet as the brand frame, coral as the reading action, and cyan as a
discovery accent.

- Violet: brand, focus, selected state, immersive framing.
- Coral: primary reading actions only.
- Cyan: discovery, newness, recommendation cues.
- Green/blue/amber/red: domain status only.
- Cover art: the loudest visual material; UI colors should frame it.

Do not add one-off colors in components. Add or reuse a semantic token instead.

## Typography

Use the system-backed `--font-sans` token until Yomi has a clearly licensed
brand typeface. Do not commit downloaded webfont files unless the license
explicitly allows self-hosted font serving from the deployed app.

## Logo Mark

The current Yomi mark is a compact SVG system:

- `components/brand/yomi-mark.tsx` is the reusable UI mark.
- `app/icon.svg` is the source app icon for Next.js metadata.
- `app/favicon.ico` is the generated raster favicon for older/default favicon
  requests.

The mark should stay simple at small sizes. Preserve the violet tile, white open
book, coral bookmark, and cyan shelf edge unless the whole brand direction
changes.

## Prompt For A Stronger Identity Brief

Use this when you want to refine or replace the brand:

```text
Create a distinct brand identity for a mobile-first manga/manhwa discovery and
reading web app.

Product goal:
Users should feel "one more chapter." The app prioritizes homepage discovery,
fast return to reading, and premium anime-inspired presentation before library
management.

Audience:
Casual manga/manhwa readers aged 16-35 who discover series through TikTok,
YouTube, Reddit, Discord, and friends. Secondary audience is power readers with
large libraries.

Avoid:
Fandom wiki clutter, low-quality manga aggregator aesthetics, ad-first layouts,
generic purple SaaS dashboards, childish anime clichés, and vague AI-ish copy.

Deliver:
1. 10 name directions with rationale and risk notes.
2. A positioning statement.
3. A brand promise.
4. 3 visual identity territories with color roles, typography mood, and layout
   rules.
5. Voice rules with examples of good/bad homepage copy.
6. A token map for light and dark themes.
7. How this identity should affect hero, continue-reading, manga cards, reader,
   empty states, and navigation.
```
