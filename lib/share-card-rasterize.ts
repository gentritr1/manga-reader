// Shared helpers for rasterizing share/export cards with html-to-image.
//
// html-to-image (toPng) can only serialize images the browser lets us read back
// through a <canvas> — i.e. SAME-ORIGIN, un-tainted pixels. Remote covers
// (uploads.mangadex.org) are rendered through next/image, whose optimized output
// is served from `/_next/image?...` on our own origin, so they qualify. Before
// export we pre-rasterize each loaded cover to a data: URL and swap the card's
// <Image> for a plain <img src={dataUrl}> so toPng always has inline pixels.
//
// This module is the single source of truth for that mechanism; both the shelves
// share card and the analytics recap card use it (see app/shelves/shelves-client
// and app/analytics/analytics-client).

const COVER_WAIT_MS = 1800;

/** Resolve after two rAFs so a state-driven DOM swap has actually painted. */
export function waitForPaint(): Promise<void> {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Wait for web fonts so exported text uses the display face, not a fallback. */
export async function waitForFonts(): Promise<void> {
  if ("fonts" in document) {
    await document.fonts.ready.catch(() => undefined);
  }
}

/**
 * Resolve true once `img` has decoded successfully, false on error/timeout.
 * Bounded by COVER_WAIT_MS so a stuck cover never blocks the whole export.
 */
export async function waitForImageReady(img: HTMLImageElement): Promise<boolean> {
  if (img.complete) {
    if (img.naturalWidth > 0) {
      await img.decode().catch(() => undefined);
      return true;
    }
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = async (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      img.removeEventListener("load", handleLoad);
      img.removeEventListener("error", handleError);
      if (ready) await img.decode().catch(() => undefined);
      resolve(ready);
    };
    const handleLoad = () => void finish(img.naturalWidth > 0);
    const handleError = () => void finish(false);
    const timeout = window.setTimeout(() => void finish(false), COVER_WAIT_MS);

    img.addEventListener("load", handleLoad);
    img.addEventListener("error", handleError);
  });
}

/** The image's current source IFF it is same-origin (or a data:/blob: URL). */
export function sameOriginImageSource(img: HTMLImageElement): string | null {
  const source = img.currentSrc || img.src;
  if (!source) return null;
  if (source.startsWith("data:") || source.startsWith("blob:")) return source;

  try {
    const url = new URL(source, window.location.href);
    return url.origin === window.location.origin ? url.href : null;
  } catch {
    return null;
  }
}

/** Draw a same-origin, loaded image to a canvas and return a PNG data URL. */
export function loadedImageDataUrl(img: HTMLImageElement): string | null {
  if (
    !sameOriginImageSource(img) ||
    img.naturalWidth <= 0 ||
    img.naturalHeight <= 0
  ) {
    return null;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * Rasterize every `img[data-share-cover-id]` (or a custom attribute) currently
 * rendered inside `root` to a data URL, keyed by that attribute's value. Covers
 * that failed to load or aren't same-origin are simply omitted.
 */
export async function collectLoadedCoverSources(
  root: HTMLElement,
  attr = "data-share-cover-id",
): Promise<Record<string, string>> {
  const images = Array.from(
    root.querySelectorAll<HTMLImageElement>(`img[${attr}]`),
  );
  const entries = await Promise.all(
    images.map(async (img) => {
      const key = img.getAttribute(attr);
      if (!key) return null;
      const ready = await waitForImageReady(img);
      if (!ready) return null;
      const source = loadedImageDataUrl(img);
      return source ? ([key, source] as const) : null;
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

/** Wait for every <img> under `root` to settle before capture. */
export async function waitForRenderedImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map((img) => waitForImageReady(img)));
}
