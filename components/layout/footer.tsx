import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p>
            <span className="font-semibold text-foreground">Yomi</span> — a
            modern manga reader.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/browse" className="hover:text-foreground">
              Browse
            </Link>
            <a
              href="https://mangadex.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
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
