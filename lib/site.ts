const DEFAULT_SITE_URL = "https://www.mangaorbit.net";

// Public base URL of the deployed site. Set NEXT_PUBLIC_SITE_URL in production
// if the canonical domain differs from DEFAULT_SITE_URL.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  DEFAULT_SITE_URL;

export const SITE_NAME = "Manga Orbit";
export const SITE_ALTERNATE_NAMES = ["MangaOrbit", "mangaorbit"];
export const SITE_HOST = new URL(SITE_URL).host;
