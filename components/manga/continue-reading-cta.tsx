"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Play } from "lucide-react";
import { isReadable, type SimpleChapter } from "@/lib/mangadex";
import {
  isChapterFinished,
  readMostRecentMangaProgress,
  type ChapterProgress,
} from "@/lib/reading-progress";
import { buttonClassName } from "@/components/ui/button";

function chapterNumber(c: SimpleChapter): number {
  const n = c.chapter != null ? parseFloat(c.chapter) : NaN;
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

interface Resolved {
  href: string;
  label: string;
  kind: "continue" | "next";
}

/**
 * Resolve which CTA (if any) to show from the most-recent local progress:
 *  - finished chapter with a later readable chapter in the feed → "Next chapter"
 *  - otherwise → "Continue" at the stored page.
 * `chapters` must be numeric-ascending (as sorted by sortChaptersByNumber).
 */
function resolveCta(
  progress: ChapterProgress,
  chapters: SimpleChapter[],
): Resolved | null {
  const current = chapters.find((c) => c.id === progress.chapterId);
  const currentNumberLabel = current?.chapter ?? progress.chapter;

  if (isChapterFinished(progress) && current) {
    const currentNum = chapterNumber(current);
    const next = chapters.find(
      (c) => isReadable(c) && chapterNumber(c) > currentNum,
    );
    if (next) {
      return {
        href: `/read/${next.id}`,
        label: next.chapter
          ? `Next chapter · Ch. ${next.chapter}`
          : "Next chapter",
        kind: "next",
      };
    }
  }

  const pagePart =
    progress.totalPages != null
      ? `page ${progress.page} of ${progress.totalPages}`
      : `page ${progress.page}`;
  const label = currentNumberLabel
    ? `Continue · Ch. ${currentNumberLabel} — ${pagePart}`
    : `Continue reading — ${pagePart}`;

  return { href: `/read/${progress.chapterId}`, label, kind: "continue" };
}

/**
 * The detail page's single primary reading CTA. Server-renders as
 * "Start reading" (so the link ships in SSR HTML for no-JS/SEO), then morphs
 * into "Continue · Ch. N — page P" / "Next chapter" after mount when this manga
 * has local history — one context-aware action instead of two competing
 * buttons. With no readable chapter and no history it renders nothing.
 */
export function ContinueReadingCta({
  mangaId,
  chapters,
  startHref,
}: {
  mangaId: string;
  chapters: SimpleChapter[];
  startHref: string | null;
}) {
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    const progress = readMostRecentMangaProgress(mangaId);
    if (!progress) return;
    const cta = resolveCta(progress, chapters);
    if (!cta) return;
    // Client-only reconciliation from localStorage after mount (avoids a
    // hydration mismatch), so this setState is intended.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolved(cta);
  }, [mangaId, chapters]);

  if (!resolved && !startHref) return null;

  return (
    <Link
      href={resolved ? resolved.href : (startHref as string)}
      prefetch={false}
      className={buttonClassName({
        size: "lg",
        className: "flex-1 min-[480px]:flex-none",
      })}
    >
      {!resolved ? (
        <>
          <BookOpen className="h-5 w-5" aria-hidden="true" /> Start reading
        </>
      ) : resolved.kind === "next" ? (
        <>
          {resolved.label}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </>
      ) : (
        <>
          <Play className="h-5 w-5 fill-current" aria-hidden="true" />
          {resolved.label}
        </>
      )}
    </Link>
  );
}
