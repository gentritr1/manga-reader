const DEFAULT_SITE_URL = "https://www.mangaorbit.net";

// Public base URL of the deployed site. Set NEXT_PUBLIC_SITE_URL in production
// if the canonical domain differs from DEFAULT_SITE_URL. A malformed value falls
// back to DEFAULT_SITE_URL so module import (and consumers like layout/robots)
// never crash on bad config.
function resolveSiteUrl(): string {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || DEFAULT_SITE_URL;
  try {
    new URL(candidate);
    return candidate;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = "Manga Orbit";
export const SITE_ALTERNATE_NAMES = ["MangaOrbit", "mangaorbit"];
// Safe: SITE_URL is always a validated, parseable URL.
export const SITE_HOST = new URL(SITE_URL).host;
