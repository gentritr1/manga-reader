import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AdsterraSocialAd } from "@/components/ads/internal-ad-preview";
import { Navbar } from "@/components/layout/navbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { Footer } from "@/components/layout/footer";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const DESCRIPTION =
  "Read manga online with a clean, fast, distraction-free reader. Browse thousands of titles, build your library, and pick up right where you left off.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Yomi: Modern Manga Reader",
    template: "%s · Yomi",
  },
  description: DESCRIPTION,
  keywords: ["manga", "manga reader", "read manga online", "webtoon"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Yomi: Modern Manga Reader",
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Yomi: Modern Manga Reader",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <a
            href="#main-content"
            className="sr-only z-50 rounded-lg bg-surface-panel px-4 py-2 text-content-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:[box-shadow:var(--elevation-panel)]"
          >
            Skip to content
          </a>
          <Navbar />
          <main id="main-content" className="flex flex-1 flex-col">
            {children}
          </main>
          <Footer />
          <MobileTabBar />
          <AdsterraSocialAd />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
