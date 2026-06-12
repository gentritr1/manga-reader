"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { YomiMark } from "@/components/brand/yomi-mark";

export function Footer() {
  const pathname = usePathname();

  if (pathname.startsWith("/read/")) return null;

  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="flex items-center gap-2">
            <YomiMark className="h-7 w-7 shrink-0" />
            <span>
              <span className="font-semibold text-foreground">Yomi</span>. A
              modern manga reader.
            </span>
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/browse"
              className="inline-flex min-h-11 items-center hover:text-foreground"
            >
              Browse
            </Link>
            <Link
              href="/support"
              className="inline-flex min-h-11 items-center hover:text-foreground"
            >
              Support
            </Link>
            <a
              href="https://mangadex.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center hover:text-foreground"
            >
              Powered by MangaDex
            </a>
          </div>
        </div>
        <p className="mt-4 text-xs">
          Content provided by the MangaDex API. Please support the official
          release and the scanlation groups.
        </p>
      </div>
    </footer>
  );
}
