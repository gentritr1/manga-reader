import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { searchManga } from "@/lib/mangadex-server";

// Regenerate daily.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/browse`, changeFrequency: "hourly", priority: 0.8 },
  ];

  // Include the most popular and most recently updated titles so crawlers can
  // discover individual manga pages (browse uses infinite scroll, so it can't).
  const [popular, latest] = await Promise.all([
    searchManga({ sort: "popular", limit: 100 }),
    searchManga({ sort: "latest", limit: 100 }),
  ]);

  const seen = new Set<string>();
  const mangaRoutes: MetadataRoute.Sitemap = [];
  for (const m of [...popular.manga, ...latest.manga]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    mangaRoutes.push({
      url: `${SITE_URL}/manga/${m.id}`,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  return [...staticRoutes, ...mangaRoutes];
}
