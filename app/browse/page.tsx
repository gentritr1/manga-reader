import { Suspense } from "react";
import type { Metadata } from "next";
import { BrowseClient } from "@/components/browse/browse-client";
import { MangaGridSkeleton } from "@/components/manga/manga-grid";

export const metadata: Metadata = {
  title: "Browse",
  description: "Search and filter thousands of manga titles.",
};

export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl px-4 py-8">
          <MangaGridSkeleton count={18} />
        </div>
      }
    >
      <BrowseClient />
    </Suspense>
  );
}
