export const DEFAULT_SERIES_TINT = "var(--shelf-edge)";

const TINT_STORAGE_PREFIX = "yomi-tint:";
const SAMPLE_SIZE = 16;
const MIN_LIGHTNESS = 0.58;
const MAX_LIGHTNESS = 0.72;
const MIN_CHROMA = 0.035;
const MAX_CHROMA = 0.085;

export function seriesTintStorageKey(mangaId: string) {
  return `${TINT_STORAGE_PREFIX}${mangaId}`;
}

export function isSeriesTint(value: string | null): value is string {
  const match = value
    ?.trim()
    .match(
      /^oklch\((0(?:\.\d+)?|1(?:\.0+)?) (0(?:\.\d+)?) ([0-9]+(?:\.\d+)?)\)$/,
    );
  if (!match) return false;

  const lightness = Number(match[1]);
  const chroma = Number(match[2]);
  const hue = Number(match[3]);
  return (
    lightness >= MIN_LIGHTNESS &&
    lightness <= MAX_LIGHTNESS &&
    chroma >= MIN_CHROMA &&
    chroma <= MAX_CHROMA &&
    hue >= 0 &&
    hue < 360
  );
}

export function readCachedSeriesTint(mangaId: string): string | null {
  try {
    const value = localStorage.getItem(seriesTintStorageKey(mangaId));
    return isSeriesTint(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeCachedSeriesTint(mangaId: string, tint: string) {
  if (!isSeriesTint(tint)) return;

  try {
    localStorage.setItem(seriesTintStorageKey(mangaId), tint);
  } catch {}
}

export function extractTintFromImage(image: HTMLImageElement): string | null {
  if (!image.complete || image.naturalWidth === 0 || !isSameOriginImage(image)) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  let pixels: Uint8ClampedArray;
  try {
    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    pixels = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  } catch {
    return null;
  }

  let red = 0;
  let green = 0;
  let blue = 0;
  let totalWeight = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    if (alpha < 0.1) continue;

    const r = pixels[index] / 255;
    const g = pixels[index + 1] / 255;
    const b = pixels[index + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const denominator = 1 - Math.abs(2 * lightness - 1);
    const saturation = max === min || denominator === 0 ? 0 : (max - min) / denominator;
    const midtoneBias = 1 - Math.min(1, Math.abs(lightness - 0.55) * 2.2);
    const weight = alpha * (0.45 + saturation * 1.8 + midtoneBias * 0.35);

    red += r * weight;
    green += g * weight;
    blue += b * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;

  return rgbToSeriesTint(
    red / totalWeight,
    green / totalWeight,
    blue / totalWeight,
  );
}

function isSameOriginImage(image: HTMLImageElement) {
  const source = image.currentSrc || image.src;
  if (!source || typeof window === "undefined") return false;

  try {
    return new URL(source, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function rgbToSeriesTint(red: number, green: number, blue: number) {
  const lab = rgbToOklab(red, green, blue);
  const rawChroma = Math.hypot(lab.a, lab.b);
  const hue =
    rawChroma > 0.005
      ? normalizeHue((Math.atan2(lab.b, lab.a) * 180) / Math.PI)
      : 280;

  const lightness = clamp(lab.l, MIN_LIGHTNESS, MAX_LIGHTNESS);
  const chroma = clamp(rawChroma * 0.9, MIN_CHROMA, MAX_CHROMA);
  return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`;
}

function rgbToOklab(red: number, green: number, blue: number) {
  const r = srgbToLinear(red);
  const g = srgbToLinear(green);
  const b = srgbToLinear(blue);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function srgbToLinear(value: number) {
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

function normalizeHue(value: number) {
  const hue = (value + 360) % 360;
  return hue >= 359.95 ? 0 : hue;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
