import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // No value in indexing auth or API routes.
      disallow: ["/api/", "/login", "/signup", "/favorites"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
