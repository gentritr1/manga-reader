import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AdsterraSocialAd } from "@/components/ads/internal-ad-preview";
import { AdGateProvider } from "@/components/ads/ad-gate-provider";
import { Navbar } from "@/components/layout/navbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { Footer } from "@/components/layout/footer";
import { SITE_ALTERNATE_NAMES, SITE_NAME, SITE_URL } from "@/lib/site";
import { ViewTransitionHistoryBridge } from "@/components/view-transition-history";

const DESCRIPTION =
  "Manga Orbit is a clean, fast, distraction-free manga reader. Browse thousands of titles, build your library, and pick up right where you left off.";
const DEFAULT_TITLE = `${SITE_NAME}: Modern Manga Reader`;
const KEYWORDS = [
  "Manga Orbit",
  "MangaOrbit",
  "mangaorbit",
  "manga orbit",
  "manga",
  "manga reader",
  "read manga online",
  "webtoon",
];

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  alternateName: SITE_ALTERNATE_NAMES,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/browse?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: DEFAULT_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: KEYWORDS,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
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
          <AdGateProvider>
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
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
            />
            <Footer />
            <MobileTabBar />
            <AdsterraSocialAd />
            <ViewTransitionHistoryBridge />
          </AdGateProvider>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
