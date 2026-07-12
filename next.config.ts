import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const envDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const lanDevOrigins = Object.values(networkInterfaces())
  .flatMap((items) => items ?? [])
  .filter((item) => item.family === "IPv4" && !item.internal)
  .map((item) => item.address);
const allowedDevOrigins = [...new Set([...envDevOrigins, ...lanDevOrigins])];

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  experimental: {
    viewTransition: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  images: {
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536],
    imageSizes: [40, 64, 96, 128, 160, 256, 384],
    // AVIF first (≈20% smaller than WebP), WebP fallback, then the source jpeg
    // for browsers that support neither. Next negotiates via the Accept header.
    // Tradeoff: AVIF encoding is ~50% slower on the FIRST request for a given
    // size, but results are cached (minimumCacheTTL) so repeat loads are fast.
    // Applies only to proxied /_next/image covers; direct covers are unoptimized.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    qualities: [75],
    maximumRedirects: 1,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "uploads.mangadex.org",
        pathname: "/covers/**",
        search: "",
      },
      // Google profile images for OAuth users
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
