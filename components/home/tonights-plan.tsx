"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MangaCoverImage } from "@/components/manga/cover-image";
import {
  readAllLocalProgress,
  type LocalProgressEntry,
} from "@/lib/local-reading-stats";
import { DEFAULT_SECONDS_PER_PAGE } from "@/lib/read-time";

// "Tonight's plan": turns local in-progress history into a concrete, low-pressure
// evening plan sized to a chosen session length. Chapter page counts for the
// current chapter come from local progress (totalPages, written by the reader).
// The proxy exposes no per-manga chapter feed, so page counts for the *next*
// chapters are estimated from the current chapter's length, and one batched
// /api/md/manga?ids[] request supplies each title's lastChapter so the plan
// never proposes chapters past the end of a series. Renders nothing without
// in-progress history (no reserved space, no CLS).

const SESSION_OPTIONS = [15, 30, 45] as const;
const DEFAULT_SESSION_MINUTES = 30;
const SESSION_STORAGE_KEY = "yomi-binge-minutes";
const MAX_TITLES = 3;
const MAX_CHAPTERS_PER_TITLE = 3; // current + up to 2 next

interface Candidate {
  mangaId: string;
  chapterId: string;
  title: string;
  coverUrl: string | null;
  chapterNum: number;
  page: number;
  totalPages: number;
  updatedAt: number;
}

interface PlanEntry {
  mangaId: string;
  chapterId: string;
  title: string;
  coverUrl: string | null;
  startCh: number;
  endCh: number;
  minutes: number;
}

function parseSessionMinutes(raw: string | null): number {
  const value = Number(raw);
  return (SESSION_OPTIONS as readonly number[]).includes(value)
    ? value
    : DEFAULT_SESSION_MINUTES;
}

function formatChapter(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Most-recent in-progress chapter per manga, newest first, capped at MAX_TITLES. */
function buildCandidates(entries: LocalProgressEntry[]): Candidate[] {
  const byManga = new Map<string, Candidate>();
  for (const entry of entries) {
    if (entry.chapter == null || entry.totalPages == null) continue;
    const chapterNum = Number.parseFloat(entry.chapter);
    if (!Number.isFinite(chapterNum)) continue;

    const candidate: Candidate = {
      mangaId: entry.mangaId,
      chapterId: entry.chapterId,
      title: entry.title ?? "Your series",
      coverUrl: entry.coverUrl,
      chapterNum,
      page: entry.page,
      totalPages: entry.totalPages,
      updatedAt: entry.updatedAt,
    };
    const existing = byManga.get(entry.mangaId);
    if (!existing || candidate.updatedAt > existing.updatedAt) {
      byManga.set(entry.mangaId, candidate);
    }
  }

  return Array.from(byManga.values())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_TITLES);
}

// Pages/minutes/range for reading `k` chapters of a candidate (finishing the
// current chapter counts as the first), capped at the series' lastChapter.
function planFor(candidate: Candidate, k: number, lastCh: number | null) {
  const perChapter = Math.max(1, candidate.totalPages);
  const midChapter = candidate.page < candidate.totalPages;
  const remainingCurrent = midChapter
    ? candidate.totalPages - candidate.page + 1
    : 0;

  const startCh = midChapter ? candidate.chapterNum : candidate.chapterNum + 1;
  let endCh = startCh + (k - 1);

  if (lastCh != null && Number.isFinite(lastCh)) {
    if (startCh > lastCh) return null; // caught up — nothing left to plan
    endCh = Math.min(endCh, lastCh);
  }

  const nextChapters = midChapter ? endCh - startCh : endCh - startCh + 1;
  const pages = remainingCurrent + Math.max(0, nextChapters) * perChapter;
  if (pages <= 0) return null;

  const minutes = Math.max(
    1,
    Math.round((pages * DEFAULT_SECONDS_PER_PAGE) / 60),
  );
  return { startCh, endCh, minutes };
}

function maxChaptersFor(candidate: Candidate, lastCh: number | null): number {
  const midChapter = candidate.page < candidate.totalPages;
  const startCh = midChapter ? candidate.chapterNum : candidate.chapterNum + 1;
  if (lastCh != null && Number.isFinite(lastCh)) {
    if (startCh > lastCh) return 0;
    const available = Math.floor(lastCh - startCh) + 1;
    return Math.min(MAX_CHAPTERS_PER_TITLE, Math.max(1, available));
  }
  return MAX_CHAPTERS_PER_TITLE;
}

function buildPlan(
  candidates: Candidate[],
  lastChapterByManga: Map<string, number>,
  budgetMinutes: number,
): { entries: PlanEntry[]; totalMinutes: number } {
  const active = candidates
    .map((candidate) => ({
      candidate,
      lastCh: lastChapterByManga.get(candidate.mangaId) ?? null,
    }))
    .filter(({ candidate, lastCh }) => maxChaptersFor(candidate, lastCh) > 0);

  if (active.length === 0) return { entries: [], totalMinutes: 0 };

  // Start each title at one chapter, then grow round-robin toward the budget.
  const chapterCounts = new Map(active.map(({ candidate }) => [candidate.mangaId, 1]));

  const total = () =>
    active.reduce((sum, { candidate, lastCh }) => {
      const plan = planFor(candidate, chapterCounts.get(candidate.mangaId)!, lastCh);
      return sum + (plan?.minutes ?? 0);
    }, 0);

  // Grow one chapter at a time — always the title with the fewest planned
  // chapters (round-robin) — so the plan fills to the budget without one title
  // running away. Stops as soon as the budget is met or nothing can grow.
  let guard = 0;
  while (total() < budgetMinutes && guard < 32) {
    guard += 1;
    const growable = active
      .filter(
        ({ candidate, lastCh }) =>
          chapterCounts.get(candidate.mangaId)! <
          maxChaptersFor(candidate, lastCh),
      )
      .sort(
        (a, b) =>
          chapterCounts.get(a.candidate.mangaId)! -
          chapterCounts.get(b.candidate.mangaId)!,
      );
    if (growable.length === 0) break;
    const target = growable[0].candidate.mangaId;
    chapterCounts.set(target, chapterCounts.get(target)! + 1);
  }

  const entries: PlanEntry[] = [];
  for (const { candidate, lastCh } of active) {
    const plan = planFor(candidate, chapterCounts.get(candidate.mangaId)!, lastCh);
    if (!plan) continue;
    entries.push({
      mangaId: candidate.mangaId,
      chapterId: candidate.chapterId,
      title: candidate.title,
      coverUrl: candidate.coverUrl,
      startCh: plan.startCh,
      endCh: plan.endCh,
      minutes: plan.minutes,
    });
  }

  return {
    entries,
    totalMinutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
  };
}

async function fetchLastChapters(
  mangaIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (mangaIds.length === 0) return result;

  const params = new URLSearchParams();
  for (const id of mangaIds) params.append("ids[]", id);
  params.set("limit", String(mangaIds.length));

  const res = await fetch(`/api/md/manga?${params.toString()}`);
  if (!res.ok) return result;
  const json = (await res.json()) as {
    data?: { id?: string; attributes?: { lastChapter?: unknown } }[];
  };
  for (const entry of json.data ?? []) {
    const last = Number.parseFloat(String(entry?.attributes?.lastChapter ?? ""));
    if (entry?.id && Number.isFinite(last) && last > 0) {
      result.set(entry.id, last);
    }
  }
  return result;
}

export function TonightsPlan() {
  const [mounted, setMounted] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sessionMinutes, setSessionMinutes] = useState(DEFAULT_SESSION_MINUTES);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCandidates(buildCandidates(readAllLocalProgress()));
      setSessionMinutes(
        parseSessionMinutes(localStorage.getItem(SESSION_STORAGE_KEY)),
      );
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSelectMinutes = (minutes: number) => {
    setSessionMinutes(minutes);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, String(minutes));
    } catch {}
  };

  const candidateKey = useMemo(
    () => candidates.map((c) => c.mangaId).sort().join(","),
    [candidates],
  );

  const { data: lastChapterByManga, isPending: lastChaptersPending } = useQuery({
    queryKey: ["tonights-plan-last-chapters", candidateKey],
    enabled: candidates.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: () => fetchLastChapters(candidates.map((c) => c.mangaId)),
  });

  const { entries, totalMinutes } = useMemo(
    () => buildPlan(candidates, lastChapterByManga ?? new Map(), sessionMinutes),
    [candidates, lastChapterByManga, sessionMinutes],
  );

  // Render null until data resolves (no hydration flash) and when there is no
  // plan to show. Wait for the lastChapter query so ranges do not visibly
  // shrink after the fetch settles.
  if (!mounted || candidates.length === 0) return null;
  if (candidates.length > 0 && lastChaptersPending) return null;
  if (entries.length === 0) return null;

  const fitsBudget = totalMinutes <= sessionMinutes;
  const totalLabel = fitsBudget
    ? `~${totalMinutes} min · fits your ${sessionMinutes}`
    : `~${totalMinutes} min · a bit past your ${sessionMinutes}`;

  return (
    <section className="space-y-4" aria-label="Tonight's reading plan">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-1">
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            Tonight&apos;s plan
          </h2>
          <p className="text-sm leading-6 text-content-secondary sm:text-base">
            A calm run through what you&apos;re part-way into. No rush — pick it up
            whenever.
          </p>
        </div>

        <div
          role="group"
          aria-label="Session length"
          className="inline-flex shrink-0 self-start rounded-full border border-line-subtle bg-surface-panel p-1 sm:self-auto"
        >
          {SESSION_OPTIONS.map((minutes) => {
            const selected = minutes === sessionMinutes;
            return (
              <button
                key={minutes}
                type="button"
                onClick={() => handleSelectMinutes(minutes)}
                aria-pressed={selected}
                aria-label={`Plan for ${minutes} minutes`}
                className={
                  selected
                    ? "min-w-11 rounded-full bg-action-primary px-3 py-1.5 text-sm font-semibold text-action-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    : "min-w-11 rounded-full px-3 py-1.5 text-sm font-medium text-content-secondary transition hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                }
              >
                {minutes}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-card border border-line-subtle bg-surface-panel p-2">
        <ul className="divide-y divide-line-subtle">
          {entries.map((entry) => {
            const range =
              entry.startCh === entry.endCh
                ? `Ch. ${formatChapter(entry.startCh)}`
                : `Ch. ${formatChapter(entry.startCh)}–${formatChapter(entry.endCh)}`;
            return (
              <li key={entry.mangaId}>
                <Link
                  href={`/read/${entry.chapterId}`}
                  prefetch={false}
                  aria-label={`Read ${range} of ${entry.title}, about ${entry.minutes} minutes`}
                  className="group flex items-center gap-4 rounded-lg p-3 transition hover:bg-surface-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <div className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                    {entry.coverUrl && (
                      <MangaCoverImage
                        src={entry.coverUrl}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-content-primary">
                      {range}{" "}
                      <span className="font-normal text-content-secondary">
                        of {entry.title}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-brand-primary">
                      ~{entry.minutes} min
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="px-3 pb-2 pt-2 text-xs font-medium text-content-secondary">
          {totalLabel}
        </p>
      </div>
    </section>
  );
}
