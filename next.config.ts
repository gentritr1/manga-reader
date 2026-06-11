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
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "uploads.mangadex.org" },
      { protocol: "https", hostname: "**.mangadex.network" },
      { protocol: "https", hostname: "mangadex.org" },
      // Google profile images for OAuth users
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
