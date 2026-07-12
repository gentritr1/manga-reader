import type { Metadata } from "next";
import { HistoryClient } from "./history-client";

// Personal, device-local page — keep it out of search indexes.
export const metadata: Metadata = {
  title: "Reading history",
  robots: { index: false, follow: false },
};

export default function HistoryPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <HistoryClient />
    </div>
  );
}
