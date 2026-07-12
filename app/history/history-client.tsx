"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Play, Trash2, X } from "lucide-react";
import { MangaCoverImage } from "@/components/manga/cover-image";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  clearAllLocalProgress,
  readAllLocalProgress,
  removeLocalProgress,
  type LocalProgressEntry,
} from "@/lib/local-reading-stats";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

// Compact relative time, e.g. "just now", "3h ago", "2d ago", "5w ago".
function relativeTime(updatedAt: number): string {
  const diff = Date.now() - updatedAt;
  if (!Number.isFinite(diff) || diff < MINUTE) return "just now";
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m}m ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h}h ago`;
  }
  if (diff < WEEK) {
    const d = Math.floor(diff / DAY);
    return `${d}d ago`;
  }
  const w = Math.floor(diff / WEEK);
  return `${w}w ago`;
}

export function HistoryClient() {
  // Render null until mounted so the localStorage read never causes a hydration
  // flash or CLS (house rule for client islands).
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState<LocalProgressEntry[]>([]);
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEntries(
        readAllLocalProgress().sort((a, b) => b.updatedAt - a.updatedAt),
      );
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleRemove = useCallback((chapterId: string) => {
    removeLocalProgress(chapterId);
    setEntries((current) => current.filter((e) => e.chapterId !== chapterId));
  }, []);

  const handleClearAll = useCallback(() => {
    clearAllLocalProgress();
    setEntries([]);
    setConfirmingClear(false);
  }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Reading history
          </h1>
          <p className="text-base leading-7 text-content-secondary">
            The chapters you&rsquo;ve opened on this device. It stays with you
            here — nothing to keep up with.
          </p>
        </div>
        {entries.length > 0 &&
          (confirmingClear ? (
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm text-content-secondary">Clear all?</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex min-h-11 items-center rounded-lg bg-danger px-3.5 text-sm font-semibold text-danger-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Yes, clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="inline-flex min-h-11 items-center rounded-lg border border-line-subtle px-3.5 text-sm font-medium text-content-secondary transition hover:bg-surface-muted/60 hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-lg border border-line-subtle px-3.5 text-sm font-medium text-content-secondary transition hover:border-line-strong hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:self-auto"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Clear history
            </button>
          ))}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-card border border-line-subtle bg-surface-panel px-6 py-14 text-center">
          <p className="text-base font-semibold">No chapters here yet.</p>
          <p className="mx-auto mt-1.5 max-w-sm text-base leading-7 text-content-secondary">
            Open any chapter and it will show up here, ready to pick back up.
          </p>
          <Link
            href="/browse"
            className={buttonClassName({ className: "mt-5" })}
          >
            Find something to read
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const chapterLabel = entry.chapter
              ? `Chapter ${entry.chapter}`
              : "Oneshot";
            const pageLabel =
              entry.totalPages != null
                ? `Page ${entry.page} of ${entry.totalPages}`
                : `Page ${entry.page}`;
            return (
              <li
                key={entry.chapterId}
                className="group flex items-center gap-4 rounded-card border border-line-subtle bg-surface-panel p-3 transition hover:border-brand-primary/45 hover:[box-shadow:var(--elevation-hover)]"
              >
                <Link
                  href={`/manga/${entry.mangaId}`}
                  prefetch={false}
                  aria-label={`Open ${entry.title ?? "manga"}`}
                  className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-md bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {entry.coverUrl && (
                    <MangaCoverImage
                      src={entry.coverUrl}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold leading-snug">
                    {entry.title ?? "Untitled"}
                  </p>
                  <p className="mt-0.5 text-xs text-content-secondary">
                    {chapterLabel}
                    <span className="mx-1.5 opacity-50">&middot;</span>
                    {pageLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-content-secondary/80">
                    {relativeTime(entry.updatedAt)}
                  </p>
                </div>
                <Link
                  href={`/read/${entry.chapterId}`}
                  prefetch={false}
                  aria-label={`Resume ${entry.title ?? "manga"}, ${chapterLabel}`}
                  className={buttonClassName({
                    size: "sm",
                    className: "shrink-0 focus-visible:ring-2 focus-visible:ring-focus",
                  })}
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Resume
                </Link>
                <button
                  type="button"
                  onClick={() => handleRemove(entry.chapterId)}
                  aria-label={`Remove ${entry.title ?? "manga"} from history`}
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-lg text-content-secondary transition",
                    "hover:bg-surface-muted hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  )}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
