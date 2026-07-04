import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { isReadable, type SimpleChapter } from "@/lib/mangadex";
import { formatReadTimeEstimate } from "@/lib/read-time";
import { InternalAdPreview } from "@/components/ads/internal-ad-preview";

const DETAIL_PREVIEW_AFTER_CHAPTERS = 8;

function chapterLabel(c: SimpleChapter) {
  const parts: string[] = [];
  if (c.volume) parts.push(`Vol. ${c.volume}`);
  parts.push(c.chapter ? `Chapter ${c.chapter}` : "Oneshot");
  return parts.join(" · ");
}

function Meta({
  c,
  secondsPerPage,
}: {
  c: SimpleChapter;
  secondsPerPage?: number | null;
}) {
  const estimate = formatReadTimeEstimate(c.pages, secondsPerPage);

  return (
    <p className="mt-0.5 truncate text-xs text-muted-foreground">
      {c.scanlationGroup ?? "Unknown group"}
      {c.publishedAt ? ` · ${new Date(c.publishedAt).toLocaleDateString()}` : ""}
      {estimate ? ` · ${estimate}` : ""}
    </p>
  );
}

export function ChapterList({
  chapters,
  secondsPerPage,
}: {
  chapters: SimpleChapter[];
  secondsPerPage?: number | null;
}) {
  if (chapters.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No English chapters available for this title yet.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-x-6 sm:rounded-xl sm:border sm:border-line-subtle lg:grid-cols-2">
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
            <Meta c={c} secondsPerPage={secondsPerPage} />
          </div>
        );

        const row = !readable && c.externalUrl ? (
          <li className="border-b border-line-subtle/70">
            <a
              href={c.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted focus-visible:bg-muted"
            >
              {title}
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="rounded-full border border-border px-2 py-0.5">
                  Official
                </span>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </span>
            </a>
          </li>
        ) : (
          <li className="border-b border-line-subtle/70">
            <Link
              href={`/read/${c.id}`}
              prefetch={false}
              className="group flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted focus-visible:bg-muted"
            >
              {title}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-content-primary" aria-hidden="true" />
            </Link>
          </li>
        );

        return (
          <Fragment key={c.id}>
            {row}
            {index === DETAIL_PREVIEW_AFTER_CHAPTERS - 1 &&
              chapters.length > DETAIL_PREVIEW_AFTER_CHAPTERS && (
                <li className="border-b border-line-subtle/70 bg-card px-4 py-5 lg:col-span-2">
                  <InternalAdPreview placement="banner" />
                </li>
              )}
          </Fragment>
        );
      })}
    </ul>
  );
}
