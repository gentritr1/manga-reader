"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Play } from "lucide-react";
import { isReadable, type SimpleChapter } from "@/lib/mangadex";
import {
  isChapterFinished,
  readMostRecentMangaProgress,
  type ChapterProgress,
} from "@/lib/reading-progress";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
 * Client island rendered next to "Start reading". Reads local reading progress
 * after mount; renders nothing (no reserved space, no flash) when this manga has
 * no history, otherwise fades in a Continue / Next-chapter button. Server-side
 * "Start reading" stays the primary action.
 */
export function ContinueReadingCta({
  mangaId,
  chapters,
}: {
  mangaId: string;
  chapters: SimpleChapter[];
}) {
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const progress = readMostRecentMangaProgress(mangaId);
    if (!progress) return;
    const cta = resolveCta(progress, chapters);
    if (!cta) return;
    // Client-only reconciliation from localStorage after mount (avoids a
    // hydration mismatch and the no-history flash), so this setState is intended.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolved(cta);
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [mangaId, chapters]);

  if (!resolved) return null;

  return (
    <Link
      href={resolved.href}
      prefetch={false}
      className={cn(
        buttonClassName({ variant: "secondary", size: "lg" }),
        "flex-1 min-[480px]:flex-none transition-opacity duration-300 motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      {resolved.kind === "next" ? (
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
