import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { BrowseClient } from "@/components/browse/browse-client";
import { MangaGridSkeleton } from "@/components/manga/manga-grid";
import { searchManga } from "@/lib/mangadex-server";
import { PUBLIC_CONTENT_RATINGS } from "@/lib/mangadex";
import {
  READING_LANGUAGE_COOKIE,
  normalizeReadingLanguage,
} from "@/lib/reading-language";

export const metadata: Metadata = {
  title: "Browse",
  description: "Search and filter thousands of manga titles.",
};

// Matches BrowseClient's PAGE_SIZE so the seeded first page fills the same query.
const PAGE_SIZE = 24;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  // Reader's global language preference (yomi-language cookie, same source the
  // manga detail page reads). Absent → "en". Reading it makes /browse dynamic,
  // which is acceptable — the page already varies by language.
  const language = normalizeReadingLanguage(
    (await cookies()).get(READING_LANGUAGE_COOKIE)?.value,
  );

  // Only seed the DEFAULT result set (newest updates, Safe+Suggestive, no
  // title/status). If the visitor lands with any client-driven URL filter, skip
  // seeding rather than mismatch the query key — those views still client-fetch.
  const hasUrlFilters = Boolean(sp.q || sp.sort || sp.status || sp.rating);
  const initialData = hasUrlFilters
    ? undefined
    : await searchManga({
        sort: "latest",
        translatedLanguage: language,
        contentRating: [...PUBLIC_CONTENT_RATINGS],
        limit: PAGE_SIZE,
        offset: 0,
      });

  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl px-4 py-8">
          <MangaGridSkeleton count={18} />
        </div>
      }
    >
      <BrowseClient initialData={initialData} initialLanguage={language} />
    </Suspense>
  );
}
