// Explicit color values for the rasterized share/export cards.
//
// html-to-image (toPng) serializes computed styles onto a cloned node. CSS
// custom properties declared on :root / .dark outside the captured subtree are
// not guaranteed to resolve in that clone, so the export cards must NOT rely on
// var() — they use these literal values instead. Values mirror the .dark token
// scope in app/globals.css (the cards render on the dark night-shelf canvas).
// color-mix(color X%, transparent) is expressed directly as oklch(... / X) so
// there is no color-mix() dependency either.

export const SHARE_CARD_COLORS = {
  canvas: "oklch(0.06 0.012 280)", // --reader-canvas
  spotlight: "oklch(0.16 0.052 286)", // --surface-spotlight
  panel: "oklch(0.18 0.036 280)", // --surface-panel
  violet: "oklch(0.72 0.18 276)", // --brand-violet
  violetDeep: "oklch(0.34 0.12 278)", // darker violet for gradient endpoints
  cyan: "oklch(0.76 0.11 192)", // --brand-cyan
  coral: "oklch(0.66 0.11 26)", // --brand-coral
  ink: "oklch(0.14 0.03 280)", // --action-primary-foreground (on-violet text)
  inverse: "oklch(0.96 0.018 284)", // --content-inverse
  inverseMuted: "oklch(0.96 0.018 284 / 0.75)", // --content-inverse-muted
  lineInverse: "oklch(0.96 0.018 284 / 0.2)", // --line-inverse
  violetTint40: "oklch(0.72 0.18 276 / 0.4)", // assertive brand-violet hairline (My week strip border)
  violetTint22: "oklch(0.72 0.18 276 / 0.22)", // brand-violet 22% over transparent
  violetTint16: "oklch(0.72 0.18 276 / 0.16)", // --library-surface
  cyanTint14: "oklch(0.76 0.11 192 / 0.14)",
  discoverySurface: "oklch(0.74 0.15 188 / 0.16)", // --discovery-surface
  discoveryLine: "oklch(0.74 0.15 188 / 0.36)", // --discovery-line
  discoveryForeground: "oklch(0.88 0.09 188)", // --discovery-foreground
} as const;

// The night-shelf background used across both export cards.
export const SHARE_CARD_BACKGROUND_IMAGE = `radial-gradient(circle at 50% 20%, ${SHARE_CARD_COLORS.violetTint22}, transparent 36%), radial-gradient(circle at 80% 56%, ${SHARE_CARD_COLORS.cyanTint14}, transparent 28%), linear-gradient(180deg, ${SHARE_CARD_COLORS.spotlight} 0%, ${SHARE_CARD_COLORS.canvas} 72%)`;

// The three-color shelf-edge line (brand signature), stated explicitly.
export const SHARE_CARD_SHELF_EDGE = `linear-gradient(90deg, ${SHARE_CARD_COLORS.violet}, ${SHARE_CARD_COLORS.cyan}, ${SHARE_CARD_COLORS.coral})`;

// The Chapter Pulse recap card background: a deep violet-black wash with a
// single, barely-there violet vignette at the top and nothing else. No cyan/teal
// blob and no multi-hue edge — the recap stays in the app's violet monoculture
// (PR-19). Explicit oklch literals only (html-to-image can't resolve var()).
export const SHARE_CARD_RECAP_BACKGROUND = `radial-gradient(circle at 50% 0%, ${SHARE_CARD_COLORS.violetTint16}, transparent 48%), linear-gradient(180deg, ${SHARE_CARD_COLORS.spotlight} 0%, ${SHARE_CARD_COLORS.canvas} 70%)`;

// Per-slot spine gradients for shelves with no loaded cover (explicit, no var()).
export const SHARE_SPINE_BACKGROUNDS = [
  `linear-gradient(180deg, ${SHARE_CARD_COLORS.violet}, ${SHARE_CARD_COLORS.violetDeep})`,
  `linear-gradient(180deg, ${SHARE_CARD_COLORS.cyan}, oklch(0.34 0.08 200))`,
  `linear-gradient(180deg, ${SHARE_CARD_COLORS.coral}, oklch(0.34 0.09 30))`,
  `linear-gradient(180deg, ${SHARE_CARD_COLORS.violet}, ${SHARE_CARD_COLORS.violetDeep})`,
  `linear-gradient(180deg, ${SHARE_CARD_COLORS.cyan}, oklch(0.34 0.08 200))`,
  `linear-gradient(180deg, ${SHARE_CARD_COLORS.violet}, ${SHARE_CARD_COLORS.violetDeep})`,
];
