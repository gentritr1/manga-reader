# Yomi Design System

## Purpose

This file defines the first stable design-system layer for Yomi. The goal is to
make brand changes easier by giving UI code semantic roles instead of scattered
one-off colors.

## Token Model

Tokens live in `app/globals.css`.

Brand primitives:

- `--brand-ink`: night-shelf ink.
- `--brand-paper`: light reading paper.
- `--brand-violet`: Yomi brand frame.
- `--brand-coral`: primary chapter action.
- `--brand-cyan`: discovery and newness.

Semantic roles for new UI:

- `surface-*`: page, panel, muted, raised, and spotlight backgrounds.
- `surface-shelf` and `surface-shelf-raised`: homepage shelf surfaces for
  start, continue, and saved-reading states.
- `surface-inverse-tint`: subtle tint on dark/inverse artwork surfaces.
- `content-*`: primary, secondary, inverse text.
- `content-inverse-muted`: secondary text on spotlight/inverse surfaces.
- `line-*`: border strength.
- `line-inverse`: subtle borders on spotlight/inverse surfaces.
- `brand-primary`: selected and brand framing.
- `action-primary`: primary reading/action CTA.
- `discovery`, `discovery-surface`, `discovery-line`, and
  `discovery-foreground`: recommendation and newness accent.
- `library`, `library-surface`, `library-line`, and `library-foreground`: saved
  and account-library state. Do not use coral for saved states.
- `focus`: keyboard focus ring.
- `status-*`: manga status colors with matching foregrounds.
- `status-unknown`: fallback for unrecognized upstream manga statuses.
- `reader-*`: immersive reader chrome, controls, focus, and muted text.
- `danger` and `warning-*`: feedback states, never manga status.
- `overlay-spotlight`: hero artwork scrim.
- `shelf-edge`: the thin violet/cyan/coral shelf line used to make Yomi
  recognizable without adding decorative clutter.
- `elevation-*`: cover, panel, shelf, mark, and hover shadows.

Layout and shape roles:

- `--font-sans`: system-first app sans stack. Do not add local webfont files
  until the license explicitly allows self-hosted web serving on Vercel.
- `--cover-spotlight-mobile`, `--cover-spotlight-tablet`,
  `--cover-spotlight-desktop`: hero cover scale.
- `--section-gap`: homepage section rhythm.
- `--radius-control`, `--radius-card`, `--radius-cover`: component shape.
- `--duration-*` and `--ease-standard`: shared interaction timing.

Compatibility aliases such as `background`, `foreground`, `accent`, `muted`,
`border`, and `spotlight` remain in place for existing Tailwind usage. New code
should prefer the semantic roles.

## Component Rules

Buttons:

- Default button means primary action. Use it for reading, starting, continuing,
  and high-intent flows.
- Secondary and outline buttons are for supporting actions.
- Library buttons are for saved/in-library states and use violet library tokens,
  not coral action tokens.
- Do not override button colors with raw Tailwind color utilities. Use semantic
  tokens such as `bg-action-primary` or add a variant.

Badges:

- Use `Badge` variants instead of hand-rolled pill spans when the pill has a
  reusable role.
- `inverse` is for chips on spotlight/artwork surfaces.
- `discovery` is for reasons, newness, and recommendation cues.
- `library` is for saved/account-library state.
- `chapter` is for cover overlays and chapter-position labels.

Cards:

- Cards are for repeated items, manga tiles, modals, and framed tools.
- Do not nest decorative cards inside other cards.
- Homepage sections should be unframed unless the frame has a clear product job.

Brand mark:

- Use `YomiMark` from `components/brand/yomi-mark.tsx` for product chrome,
  auth entry points, footer identity, and future empty/loading states.
- The mark uses semantic brand tokens in UI and fixed brand colors in
  `app/icon.svg` for browser/app icons.
- Do not replace the mark with a generic book icon in product identity
  surfaces. Use generic reading icons only for actions such as opening chapters.

Manga covers:

- Cover art should carry the visual energy.
- Use `aspect-[2/3]` for standard covers.
- Use semantic overlay tokens such as `surface-spotlight` and `content-inverse`.
- Status badges must use foreground tokens, not generic white text.

Feedback:

- Error text uses `danger`.
- Licensed/official notices use `warning-surface`, `warning-line`, and
  `warning-content`.
- Do not use raw `red-*` or `amber-*` utilities in product components.

Reader:

- The reader is intentionally darker than the app shell.
- Use `reader-*` tokens for reader canvas, chrome, controls, muted text, and
  focus.
- Do not use raw `black`, `white`, or opacity variants for reader chrome unless
  adding a new reader token first.

Hero:

- The H1 is the manga title or a literal brand/product statement.
- Keep one dominant CTA and one quiet secondary action.
- Include one short editorial reason for the spotlight. It should explain why
  the story is useful right now, without pretending to have signals the product
  does not actually measure.
- Supporting covers must either be links or look clearly decorative.
- On phones, the hero is image-first: label, artwork stage, full-width title,
  synopsis, chips, actions. Do not squeeze long manga titles beside a cover.
- Mobile secondary save actions should be compact (`Save` / `Saved`) so the
  primary chapter action stays dominant.
- Mobile home must expose a fast recovery path such as search, popular, or
  latest updates before the user has to scroll past the spotlight.
- On the homepage mobile route, keep global chrome compact enough that the
  spotlight artwork appears immediately and the next section can peek into the
  first viewport.

Shelf:

- Signed-out and unknown-session states should default to an intentional starter
  shelf, not a loading shelf.
- `Continue reading` is reserved for known history.
- Use `surface-shelf`, `surface-shelf-raised`, `line-shelf`, `shelf-edge`, and
  `elevation-shelf` for shelf surfaces.
- Shelf copy must clearly separate local reading, account sync, and saved
  library behavior.

Copy:

- Prefer literal verbs: View chapters, Continue reading, Browse popular.
- Avoid invented phrases unless they become part of the brand system.
- Do not expose backend behavior in user-facing copy.

Accessibility:

- Every token pair used for text must target WCAG AA.
- Focus states use `focus`.
- Motion must respect `prefers-reduced-motion`.
- Signed-out states must not promise synced history.

## Migration Order

1. Shared primitives: button, badge, input, skeleton.
2. Homepage hero and continue-reading modules.
3. Manga cards, cover overlays, favorite controls, and status badges.
4. Browse filters, nav active states, and empty states.
5. Full replacement of compatibility aliases after the token roles settle.

## Open Decisions

- Whether Yomi is the final public name.
- Whether the identity should lean more cinematic, playful, or editorial.
- Whether Yomi should license or use a provider-hosted brand typeface.
- Whether anonymous local history should exist before login.
