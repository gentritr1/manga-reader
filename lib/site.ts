// Public base URL of the deployed site. Set NEXT_PUBLIC_SITE_URL in production
// (e.g. https://yomimanga.com) so canonical URLs, sitemap, and OG images resolve.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

export const SITE_NAME = "Yomi";
