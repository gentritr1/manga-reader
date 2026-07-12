#!/usr/bin/env node
/**
 * WCAG 2.1 contrast checker for the Manga Orbit token palette.
 *
 * Parses the design tokens defined in app/globals.css (:root = light theme,
 * .dark = dark theme), resolves `var(--…)` chains within each scope, converts
 * oklch → sRGB, composites any translucent backgrounds over their parent
 * surface, and computes the WCAG 2.1 relative-luminance contrast ratio for the
 * foreground/background PAIRS that actually occur in the UI (enumerated below by
 * reading how the tokens are paired in components — not every combination).
 *
 * Thresholds: 4.5:1 for normal body text, 3:1 for large text / UI affordances.
 * Exits non-zero if any non-whitelisted pair fails, so it can gate CI.
 *
 * Run: npm run check:contrast
 *
 * The oklch→sRGB path is the standard Björn Ottosson OKLab matrix; it is
 * spot-checkable — white-on-black returns ≈21.0 (the WCAG maximum).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(__dirname, "..", "app", "globals.css");

/* ---------- color math ---------- */

// oklch(L C H[/alpha]) → linear-light sRGB → gamma sRGB in [0,1].
function oklchToSrgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [gamma(lr), gamma(lg), gamma(lb)];
}

// linear-light → gamma-encoded sRGB, clamped to the displayable gamut.
function gamma(x) {
  const c = Math.max(0, Math.min(1, x));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

// WCAG relative luminance from gamma-encoded sRGB.
function luminance([r, g, b]) {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(rgb1, rgb2) {
  const l1 = luminance(rgb1);
  const l2 = luminance(rgb2);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// Straight (non-premultiplied) alpha composite of `fg` (with `alpha`) over
// opaque `base`, in gamma sRGB space (matches how the browser paints these
// translucent pill/badge surfaces closely enough for a contrast check).
function composite(fg, alpha, base) {
  return fg.map((c, i) => alpha * c + (1 - alpha) * base[i]);
}

/* ---------- token parsing ---------- */

const css = readFileSync(CSS_PATH, "utf8");

function parseBlock(selector) {
  const re = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`Could not find ${selector} block in globals.css`);
  const map = new Map();
  const decl = /--([\w-]+):\s*([^;]+);/g;
  let d;
  while ((d = decl.exec(m[1]))) map.set(d[1], d[2].trim());
  return map;
}

const root = parseBlock(":root");
const dark = parseBlock("\\.dark");

// Resolve a token name to a raw value string within a scope, following var()
// chains. Dark scope falls back to :root for any token it does not override.
function rawValue(name, scope, seen = new Set()) {
  if (seen.has(name)) throw new Error(`var cycle at --${name}`);
  seen.add(name);
  const val = (scope === dark ? dark.get(name) ?? root.get(name) : root.get(name));
  if (val == null) throw new Error(`--${name} not defined`);
  const varMatch = val.match(/^var\(\s*--([\w-]+)\s*(?:,[^)]*)?\)$/);
  if (varMatch) return rawValue(varMatch[1], scope, seen);
  return val;
}

// Resolve a token to { rgb, alpha } (gamma sRGB, alpha in [0,1]).
function resolveColor(name, scope) {
  const val = rawValue(name, scope);
  const m = val.match(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)/,
  );
  if (!m) throw new Error(`--${name} is not a plain oklch color: "${val}"`);
  const [, L, C, H, A] = m;
  return {
    rgb: oklchToSrgb(parseFloat(L), parseFloat(C), parseFloat(H)),
    alpha: A === undefined ? 1 : parseFloat(A),
  };
}

// Resolve a background token to an opaque rgb, compositing over `base` if the
// token (or its resolved value) carries alpha.
function resolveBg(name, scope, baseName) {
  const c = resolveColor(name, scope);
  if (c.alpha >= 1) return c.rgb;
  const base = resolveColor(baseName, scope).rgb;
  return composite(c.rgb, c.alpha, base);
}

/* ---------- the pairs actually used in the UI ---------- */
// threshold 4.5 = normal text; 3 = large text / UI. `base` = surface a
// translucent bg is composited over. `whitelist` = intentional/undefinable
// (documented), reported but does not fail the run.
const PAIRS = [
  // Primary + secondary body text on every solid surface.
  { fg: "content-primary", bg: "surface-canvas", t: 4.5, note: "body on page" },
  { fg: "content-primary", bg: "surface-panel", t: 4.5, note: "body on card" },
  { fg: "content-primary", bg: "surface-muted", t: 4.5, note: "body on muted" },
  { fg: "content-secondary", bg: "surface-canvas", t: 4.5, note: "muted text on page" },
  { fg: "content-secondary", bg: "surface-panel", t: 4.5, note: "muted text on card" },
  { fg: "content-secondary", bg: "surface-muted", t: 4.5, note: "muted text on muted" },
  // Inverse text on the dark spotlight surface (hero / feature blocks).
  { fg: "content-inverse", bg: "surface-spotlight", t: 4.5, note: "spotlight text" },
  // Primary CTA + brand-filled chip label.
  { fg: "action-primary-foreground", bg: "action-primary", t: 4.5, note: "primary button label" },
  { fg: "brand-primary-foreground", bg: "brand-primary", t: 4.5, note: "selected chip label" },
  // Destructive button.
  { fg: "danger-foreground", bg: "danger", t: 4.5, note: "danger button label" },
  // Tinted status badges (translucent surface over the page canvas).
  { fg: "library-foreground", bg: "library-surface", base: "surface-canvas", t: 4.5, note: "library badge" },
  { fg: "discovery-foreground", bg: "discovery-surface", base: "surface-canvas", t: 4.5, note: "discovery badge" },
  { fg: "warning-content", bg: "warning-surface", base: "surface-canvas", t: 4.5, note: "warning badge" },
  // Reader chrome (identical tokens in both themes; reader is always dark).
  { fg: "reader-foreground", bg: "reader-canvas", t: 4.5, note: "reader page text" },
  { fg: "reader-foreground", bg: "reader-chrome", base: "reader-canvas", t: 4.5, note: "reader chrome text" },
  { fg: "reader-muted", bg: "reader-canvas", t: 4.5, note: "reader page counter / muted" },
  // Whitelisted: the status pill is a translucent dark scrim that floats over
  // arbitrary cover art, so it has no fixed background to test. Its own dark
  // fill guarantees the near-white label reads regardless of the cover; the
  // hue only appears as a small status dot. Reported, does not gate.
  {
    fg: "status-pill-foreground",
    bg: "status-pill",
    base: "surface-canvas",
    t: 4.5,
    note: "status pill over cover art",
    whitelist: true,
  },
];

/* ---------- run ---------- */

// Self-test: white-on-black must be ≈21 (WCAG max), a sanity check on the
// oklch→sRGB→luminance path.
const white = oklchToSrgb(1, 0, 0);
const black = oklchToSrgb(0, 0, 0);
const wob = contrast(white, black);
if (Math.abs(wob - 21) > 0.2) {
  console.error(`Self-test FAILED: white-on-black = ${wob.toFixed(2)}, expected ≈21`);
  process.exit(2);
}

let failed = 0;
const rows = [];
for (const scope of [
  { name: "light", map: root },
  { name: "dark", map: dark },
]) {
  for (const p of PAIRS) {
    const fg = resolveColor(p.fg, scope.map).rgb;
    const bg = p.base
      ? resolveBg(p.bg, scope.map, p.base)
      : resolveBg(p.bg, scope.map, p.bg);
    const ratio = contrast(fg, bg);
    const pass = ratio >= p.t;
    const status = p.whitelist ? (pass ? "PASS*" : "WHITELIST") : pass ? "PASS" : "FAIL";
    if (!pass && !p.whitelist) failed++;
    rows.push({
      scope: scope.name,
      pair: `${p.fg} / ${p.bg}`,
      ratio: ratio.toFixed(2),
      need: `${p.t}:1`,
      status,
      note: p.note,
    });
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nWCAG contrast — Manga Orbit tokens  (white-on-black self-test: ${wob.toFixed(2)})\n`);
console.log(
  pad("scope", 6) + pad("pair", 46) + pad("ratio", 8) + pad("need", 8) + pad("status", 11) + "note",
);
console.log("-".repeat(110));
for (const r of rows) {
  console.log(
    pad(r.scope, 6) + pad(r.pair, 46) + pad(r.ratio, 8) + pad(r.need, 8) + pad(r.status, 11) + r.note,
  );
}
console.log("");

if (failed > 0) {
  console.error(`${failed} pair(s) FAILED WCAG contrast.`);
  process.exit(1);
}
console.log("All non-whitelisted pairs pass WCAG contrast.");
