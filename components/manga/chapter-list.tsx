"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { isReadable, type SimpleChapter } from "@/lib/mangadex";
import { formatReadTimeEstimate } from "@/lib/read-time";
import {
  isChapterFinished,
  progressPercent,
  readMangaChapterProgress,
  type ChapterProgress,
} from "@/lib/reading-progress";
import { InternalAdPreview } from "@/components/ads/internal-ad-preview";
import { useAdGate } from "@/components/ads/ad-gate-provider";
import { isAdSlotConfigured } from "@/lib/ad-config";
import { cn } from "@/lib/utils";

type SortDirection = "newest" | "oldest";

const NO_VOLUME_KEY = "__none__";

interface VolumeGroup {
  key: string;
  label: string;
  chapters: SimpleChapter[];
}

function chapterLabel(c: SimpleChapter) {
  const parts: string[] = [];
  if (c.volume) parts.push(`Vol. ${c.volume}`);
  parts.push(c.chapter ? `Chapter ${c.chapter}` : "Oneshot");
  return parts.join(" · ");
}

function volumeLabel(volume: string | null) {
  return volume ? `Vol. ${volume}` : "No volume";
}

// Build volume groups from a numeric-ascending chapter list. Volume order
// follows first appearance in that ascending order (so "No volume" lands wherever
// its chapters sort). Chapters inside each group stay ascending.
function buildAscendingGroups(chapters: SimpleChapter[]): VolumeGroup[] {
  const groups: VolumeGroup[] = [];
  const indexByKey = new Map<string, number>();
  for (const c of chapters) {
    const key = c.volume ?? NO_VOLUME_KEY;
    let gi = indexByKey.get(key);
    if (gi === undefined) {
      gi = groups.length;
      indexByKey.set(key, gi);
      groups.push({ key, label: volumeLabel(c.volume), chapters: [] });
    }
    groups[gi].chapters.push(c);
  }
  return groups;
}

function dateRangeLabel(chapters: SimpleChapter[]): string | null {
  const dates = chapters
    .map((c) => c.publishedAt)
    .filter((d): d is string => Boolean(d))
    .sort();
  if (dates.length === 0) return null;
  const first = new Date(dates[0]).toLocaleDateString();
  const last = new Date(dates[dates.length - 1]).toLocaleDateString();
  return first === last ? first : `${first} – ${last}`;
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

function ChapterRow({
  c,
  secondsPerPage,
  progress,
}: {
  c: SimpleChapter;
  secondsPerPage?: number | null;
  progress?: ChapterProgress;
}) {
  const readable = isReadable(c);
  // Explicit accessible name so the link never depends on name-from-contents of
  // the nested truncated text (which resolved empty in the a11y tree). Preserved
  // from PR-2; read markers only append a status suffix so the original name
  // stays intact.
  const accessibleName = c.title
    ? `${chapterLabel(c)} · ${c.title}`
    : chapterLabel(c);

  // Read markers apply only to in-app readable chapters (the reader never
  // records progress for external/licensed rows).
  const finished = Boolean(readable && progress && isChapterFinished(progress));
  const inProgress = Boolean(
    readable && progress && !finished && progress.page > 1,
  );
  const percent = inProgress && progress ? progressPercent(progress) : null;

  const statusSuffix = finished
    ? " — finished"
    : inProgress && progress
      ? ` — in progress, page ${progress.page}${
          progress.totalPages ? ` of ${progress.totalPages}` : ""
        }`
      : "";

  const title = (
    <div className="min-w-0">
      <p
        className={cn(
          "truncate text-sm font-medium",
          finished && "opacity-60",
        )}
      >
        {chapterLabel(c)}
        {c.title ? (
          <span className="text-muted-foreground"> · {c.title}</span>
        ) : null}
      </p>
      <Meta c={c} secondsPerPage={secondsPerPage} />
      {inProgress && progress ? (
        <p className="mt-0.5 truncate text-xs font-medium text-content-secondary">
          Continue · page {progress.page}
          {progress.totalPages ? ` of ${progress.totalPages}` : ""}
        </p>
      ) : null}
    </div>
  );

  if (!readable && c.externalUrl) {
    return (
      <li className="border-b border-line-subtle/70">
        <a
          href={c.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${accessibleName} (official external)`}
          className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
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
    );
  }

  return (
    <li className="relative border-b border-line-subtle/70">
      <Link
        href={`/read/${c.id}`}
        prefetch={false}
        aria-label={`${accessibleName}${statusSuffix}`}
        className="group flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
      >
        {title}
        {finished ? (
          <Check
            className="h-4 w-4 shrink-0 text-content-secondary"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-content-primary"
            aria-hidden="true"
          />
        )}
      </Link>
      {/* In-progress marker: absolutely positioned so it never reflows the row. */}
      {percent != null && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-brand-primary/70"
          style={{ width: `${percent}%` }}
        />
      )}
    </li>
  );
}

function VolumeSection({
  group,
  secondsPerPage,
  open,
  onToggle,
  progressByChapter,
}: {
  group: VolumeGroup;
  secondsPerPage?: number | null;
  open: boolean;
  onToggle: (key: string, isOpen: boolean) => void;
  progressByChapter: Map<string, ChapterProgress>;
}) {
  const range = dateRangeLabel(group.chapters);
  const count = group.chapters.length;

  return (
    <details
      open={open}
      onToggle={(e) =>
        onToggle(group.key, (e.currentTarget as HTMLDetailsElement).open)
      }
      className="border-t border-line-subtle/70 [&:first-of-type]:border-t-0"
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{group.label}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {count} {count === 1 ? "chapter" : "chapters"}
            {range ? ` · ${range}` : ""}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </summary>
      <ul className="grid grid-cols-1 gap-x-6 border-t border-line-subtle/70 lg:grid-cols-2">
        {group.chapters.map((c) => (
          <ChapterRow
            key={c.id}
            c={c}
            secondsPerPage={secondsPerPage}
            progress={progressByChapter.get(c.id)}
          />
        ))}
      </ul>
    </details>
  );
}

// In-list ad break. AdsterraAdSlot returns null whenever ads are gated off
// (every viewer except the two ad-enabled accounts, plus all of SSR), so gating
// the bordered wrapper on the same signal stops an empty bordered strip from
// painting under the chapter rows. Also gate on the slot being configured, so an
// ad-enabled account whose banner slot has no keys never sees an empty box.
function ChapterListAd() {
  const { showAds } = useAdGate();
  if (!showAds || !isAdSlotConfigured("banner")) return null;
  return (
    <div className="border-t border-line-subtle/70 bg-card px-4 py-5">
      <InternalAdPreview placement="banner" />
    </div>
  );
}

export function ChapterList({
  chapters,
  mangaId,
  secondsPerPage,
  total,
}: {
  // Numeric-ascending chapters (as produced by sortChaptersByNumber).
  chapters: SimpleChapter[];
  mangaId: string;
  secondsPerPage?: number | null;
  // Total chapter count for the section heading. When provided, the heading sits
  // inline with the sort toggle on one row.
  total?: number;
}) {
  const [direction, setDirection] = useState<SortDirection>("newest");
  const [progressByChapter, setProgressByChapter] = useState<
    Map<string, ChapterProgress>
  >(() => new Map());

  const ascendingGroups = useMemo(
    () => buildAscendingGroups(chapters),
    [chapters],
  );

  // Default-open volume = the one holding the most recent chapter (the last in
  // ascending order → the top of the default newest-first view). Everything else
  // starts collapsed to keep 200+ row lists scannable.
  const defaultOpenKey =
    ascendingGroups.length > 0
      ? ascendingGroups[ascendingGroups.length - 1].key
      : null;

  const [openKeys, setOpenKeys] = useState<Set<string>>(
    () => new Set(defaultOpenKey ? [defaultOpenKey] : []),
  );

  // Read markers: client-only enhancement, loaded after mount so SSR/first paint
  // ship the plain list (all chapter links present) with no hydration mismatch.
  useEffect(() => {
    // Client-only reconciliation from localStorage — a post-mount effect is the
    // intended way to avoid a hydration mismatch, so this setState is deliberate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgressByChapter(readMangaChapterProgress(mangaId));
  }, [mangaId]);

  const displayGroups = useMemo(() => {
    if (direction === "oldest") return ascendingGroups;
    return [...ascendingGroups]
      .reverse()
      .map((g) => ({ ...g, chapters: [...g.chapters].reverse() }));
  }, [ascendingGroups, direction]);

  // Small series don't need the volume <details> ceremony — a 3-chapter title
  // rendered two collapsible sections. Flatten to a plain sorted 2-col list when
  // there are few chapters or at most a couple of volume groups; rows keep their
  // "Vol. X · Chapter Y" label prefix, so no grouping information is lost.
  // Grouping stays for the 200-chapter case it was built for.
  const isFlat = chapters.length <= 12 || ascendingGroups.length <= 2;
  const flatChapters = useMemo(
    () => displayGroups.flatMap((g) => g.chapters),
    [displayGroups],
  );

  const handleToggle = (key: string, isOpen: boolean) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  if (chapters.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No English chapters available for this title yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {total != null ? (
          <h2 className="font-display text-xl font-bold">
            Chapters{" "}
            <span className="text-base font-normal text-muted-foreground">
              ({total})
            </span>
          </h2>
        ) : null}
        <div
          role="group"
          aria-label="Sort chapters"
          className="inline-flex items-center gap-1 rounded-full border border-line-subtle bg-surface-panel p-1"
        >
          {(
            [
              ["newest", "Newest first"],
              ["oldest", "Oldest first"],
            ] as const
          ).map(([value, text]) => {
            const selected = direction === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setDirection(value)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  selected
                    ? "bg-surface-muted text-content-primary shadow-sm"
                    : "text-content-secondary hover:text-content-primary",
                )}
              >
                {text}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sm:overflow-hidden sm:rounded-xl sm:border sm:border-line-subtle">
        {isFlat ? (
          <>
            <ul className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
              {flatChapters.map((c) => (
                <ChapterRow
                  key={c.id}
                  c={c}
                  secondsPerPage={secondsPerPage}
                  progress={progressByChapter.get(c.id)}
                />
              ))}
            </ul>
            <ChapterListAd />
          </>
        ) : (
          displayGroups.map((group, index) => (
            <Fragment key={group.key}>
              <VolumeSection
                group={group}
                secondsPerPage={secondsPerPage}
                open={openKeys.has(group.key)}
                onToggle={handleToggle}
                progressByChapter={progressByChapter}
              />
              {index === 0 && displayGroups.length > 1 && <ChapterListAd />}
            </Fragment>
          ))
        )}
      </div>
    </div>
  );
}
