import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { isReadable, type SimpleChapter } from "@/lib/mangadex";
import { InternalAdPreview } from "@/components/ads/internal-ad-preview";

const DETAIL_PREVIEW_AFTER_CHAPTERS = 8;

function chapterLabel(c: SimpleChapter) {
  const parts: string[] = [];
  if (c.volume) parts.push(`Vol. ${c.volume}`);
  parts.push(c.chapter ? `Chapter ${c.chapter}` : "Oneshot");
  return parts.join(" · ");
}

function Meta({ c }: { c: SimpleChapter }) {
  return (
    <p className="mt-0.5 truncate text-xs text-muted-foreground">
      {c.scanlationGroup ?? "Unknown group"}
      {c.publishedAt ? ` · ${new Date(c.publishedAt).toLocaleDateString()}` : ""}
    </p>
  );
}

export function ChapterList({ chapters }: { chapters: SimpleChapter[] }) {
  if (chapters.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No English chapters available for this title yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {chapters.map((c, index) => {
        const readable = isReadable(c);
        const title = (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {chapterLabel(c)}
              {c.title ? (
                <span className="text-muted-foreground"> · {c.title}</span>
              ) : null}
            </p>
            <Meta c={c} />
          </div>
        );

        const row = !readable && c.externalUrl ? (
          <li>
            <a
              href={c.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted"
            >
              {title}
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="rounded-full border border-border px-2 py-0.5">
                  Official
                </span>
                <ExternalLink className="h-4 w-4" />
              </span>
            </a>
          </li>
        ) : (
          <li>
            <Link
              href={`/read/${c.id}`}
              prefetch={false}
              className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted"
            >
              {title}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        );

        return (
          <Fragment key={c.id}>
            {row}
            {index === DETAIL_PREVIEW_AFTER_CHAPTERS - 1 &&
              chapters.length > DETAIL_PREVIEW_AFTER_CHAPTERS && (
                <li className="bg-card px-4 py-5">
                  <InternalAdPreview placement="banner" />
                </li>
              )}
          </Fragment>
        );
      })}
    </ul>
  );
}
