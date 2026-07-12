"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Heart,
  Maximize2,
  Minimize2,
  Rows3,
  X,
} from "lucide-react";
import { InternalAdPreview } from "@/components/ads/internal-ad-preview";
import { buttonClassName } from "@/components/ui/button";
import {
  DEFAULT_SERIES_TINT,
  readCachedSeriesTint,
} from "@/lib/extract-tint";
import { chapterPageProxyUrl } from "@/lib/mangadex";
import { formatReadTimeEstimate } from "@/lib/read-time";
import { useFavorites } from "@/lib/use-favorites";
import {
  useMarkReadingRhythmReadToday,
  useReadingRhythm,
} from "@/lib/use-reading-rhythm";
import { cn } from "@/lib/utils";

type Mode = "vertical" | "paged";

// True when focus sits in a text field, contenteditable, or an open dialog
// (e.g. the search palette) — reader keyboard shortcuts must yield to those.
function isKeyboardCaptureTarget(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  if (el.closest('[role="dialog"]')) return true;
  return false;
}

// True when the key event originated on (or inside) an interactive element.
// Reader shortcuts must never intercept or race keys headed for a focused
// control — native Enter/Space activation always wins.
function isInteractiveEventTarget(e: KeyboardEvent): boolean {
  const origin = e.composedPath?.()[0] ?? e.target;
  if (!(origin instanceof Element)) return false;
  return Boolean(
    origin.closest(
      'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [contenteditable]:not([contenteditable="false"])',
    ),
  );
}

const MAX_IMAGE_RETRIES = 2;
const PROGRESS_STORAGE_PREFIX = "yomi-progress:";
const SERVER_PROGRESS_FLUSH_MS = 60_000;
const RESUME_PROMPT_MIN_AGE_MS = 30_000;
const RESUME_PROMPT_AUTO_DISMISS_MS = 6_000;

interface ReaderSessionState {
  startedAt: number;
  mode: Mode;
  pagesSeen: Set<number>;
  maxPagedPage: number;
  flushed: boolean;
  endSnapshot: ReaderSessionSnapshot | null;
}

interface ReaderSessionSnapshot {
  pagesRead: number;
  durationSeconds: number;
}

interface StoredChapterProgress {
  mangaId?: string;
  chapterId?: string;
  title?: string;
  coverUrl?: string | null;
  chapter?: string | null;
  page: number;
  totalPages: number | null;
  updatedAt: number;
}

interface StoredProgressMetadata {
  mangaId: string;
  chapterId: string;
  title: string;
  coverUrl?: string | null;
  chapter?: string | null;
  totalPages?: number;
}

interface Props {
  chapterId: string;
  imageUrls: string[];
  useDataSaver: boolean;
  chapterLabel: string;
  chapterTitle: string | null;
  mangaId: string | null;
  mangaTitle: string;
  coverUrl: string | null;
  prevId: string | null;
  nextId: string | null;
  recap?: string | null;
  initialProgressPage?: number | null;
  initialProgressTotalPages?: number | null;
  initialProgressUpdatedAt?: string | null;
}

function allowsSpeculativeImagePreload(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;
  return (
    !connection?.saveData &&
    !["slow-2g", "2g"].includes(connection?.effectiveType ?? "")
  );
}

function connectionSaveDataEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean };
    }
  ).connection;
  return Boolean(connection?.saveData);
}

function getReaderSessionSnapshot(
  readingSession: ReaderSessionState,
  totalPages: number,
): ReaderSessionSnapshot | null {
  const durationSeconds = Math.round((Date.now() - readingSession.startedAt) / 1000);
  const pagesRead = Math.max(
    Math.min(readingSession.maxPagedPage, totalPages),
    Math.min(readingSession.pagesSeen.size, totalPages),
  );

  if (pagesRead <= 0) return null;
  return { pagesRead, durationSeconds };
}

function formatMomentumDuration(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function formatMomentumStats(stats: ReaderSessionSnapshot | null) {
  if (!stats) return "Chapter complete";
  const pagesLabel = stats.pagesRead === 1 ? "1 page" : `${stats.pagesRead} pages`;
  return `${pagesLabel} · ${formatMomentumDuration(stats.durationSeconds)}`;
}

function progressStorageKey(chapterId: string) {
  return `${PROGRESS_STORAGE_PREFIX}${chapterId}`;
}

function safeTotalPages(total: number) {
  if (!Number.isInteger(total) || total < 1 || total > 2000) return undefined;
  return total;
}

function normalizeReadablePage(page: number, total: number) {
  if (!Number.isFinite(page) || total < 1) return null;
  const max = Math.min(total, 2000);
  const normalized = Math.trunc(page);
  if (normalized < 1) return null;
  return Math.min(normalized, max);
}

function readStoredProgress(
  chapterId: string,
  total: number,
): StoredChapterProgress | null {
  try {
    const raw = localStorage.getItem(progressStorageKey(chapterId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredChapterProgress>;
    const page = normalizeReadablePage(Number(parsed.page), total);
    const updatedAt = Number(parsed.updatedAt);
    if (!page || !Number.isFinite(updatedAt)) return null;
    const totalPages =
      typeof parsed.totalPages === "number" && parsed.totalPages >= 1
        ? Math.min(parsed.totalPages, 2000)
        : null;
    return {
      mangaId: typeof parsed.mangaId === "string" ? parsed.mangaId : undefined,
      chapterId:
        typeof parsed.chapterId === "string" ? parsed.chapterId : chapterId,
      title: typeof parsed.title === "string" ? parsed.title : undefined,
      coverUrl:
        typeof parsed.coverUrl === "string" || parsed.coverUrl === null
          ? parsed.coverUrl
          : undefined,
      chapter: typeof parsed.chapter === "string" ? parsed.chapter : undefined,
      page,
      totalPages,
      updatedAt,
    };
  } catch {
    return null;
  }
}

function writeStoredProgress(
  chapterId: string,
  page: number,
  totalPages: number | undefined,
  metadata: StoredProgressMetadata,
) {
  try {
    localStorage.setItem(
      progressStorageKey(chapterId),
      JSON.stringify({
        ...metadata,
        page,
        totalPages: totalPages ?? null,
        updatedAt: Date.now(),
      }),
    );
  } catch {}
}

function writeStoredProgressMetadata(
  chapterId: string,
  metadata: StoredProgressMetadata,
  fallbackPage: number,
  fallbackUpdatedAt: number,
) {
  try {
    const existing = localStorage.getItem(progressStorageKey(chapterId));
    const parsed = existing
      ? (JSON.parse(existing) as Partial<StoredChapterProgress>)
      : null;
    const page =
      normalizeReadablePage(
        Number(parsed?.page ?? fallbackPage),
        metadata.totalPages ?? 2000,
      ) ?? 1;
    const updatedAt = Number(parsed?.updatedAt ?? fallbackUpdatedAt);

    localStorage.setItem(
      progressStorageKey(chapterId),
      JSON.stringify({
        ...parsed,
        ...metadata,
        page,
        totalPages: metadata.totalPages ?? parsed?.totalPages ?? null,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
      }),
    );
  } catch {}
}

export function Reader(props: Props) {
  return <ReaderContent key={props.chapterId} {...props} />;
}

function ReaderContent(props: Props) {
  const { imageUrls, prevId, nextId, mangaId, useDataSaver } = props;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("vertical");
  const [zenMode, setZenMode] = useState(false);
  const toggleZenMode = useCallback(() => setZenMode((z) => !z), []);
  // Paged slides: 0 = intro, 1..N = pages, N+1 = end.
  const [slide, setSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const total = imageUrls.length;
  const lastSlide = total + 1;

  // Vertical reading progress: which page is in view and how far scrolled.
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollProgress, setScrollProgress] = useState(0);
  // One-time hint so the tap-to-hide-controls gesture is discoverable.
  const [showHint, setShowHint] = useState(false);
  const [resumePromptPage, setResumePromptPage] = useState<number | null>(null);
  const [chapterEndStats, setChapterEndStats] =
    useState<ReaderSessionSnapshot | null>(null);
  const [chapterEndRhythmDays, setChapterEndRhythmDays] = useState<
    number | null
  >(null);
  const [nextTeaseReady, setNextTeaseReady] = useState(false);
  const rhythmQuery = useReadingRhythm();
  const markReadingRhythmReadToday = useMarkReadingRhythmReadToday();
  const estimatedReadTime = formatReadTimeEstimate(
    total,
    rhythmQuery.data?.averageSecondsPerPage,
  );
  const latestProgressPageRef = useRef(0);
  const lastProgressFlushRef = useRef(0);
  const readerRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    readerRootRef.current?.style.setProperty(
      "--series-tint",
      mangaId
        ? readCachedSeriesTint(mangaId) ?? DEFAULT_SERIES_TINT
        : DEFAULT_SERIES_TINT,
    );
  }, [mangaId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("reader-hint-seen")) return;
    // One-time hint driven by localStorage (client-only) — an effect avoids a
    // hydration mismatch, so the synchronous setState here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowHint(true);
    localStorage.setItem("reader-hint-seen", "1");
    const timer = setTimeout(() => setShowHint(false), 4200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (mode !== "vertical") return;
    let frame = 0;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [mode]);

  const sessionRef = useRef<ReaderSessionState>({
    startedAt: 0,
    mode: "vertical",
    pagesSeen: new Set<number>(),
    maxPagedPage: 0,
    flushed: true,
    endSnapshot: null,
  });

  const buildProgressMetadata = useCallback((): StoredProgressMetadata | null => {
      if (!mangaId) return null;
      return {
        mangaId,
        chapterId: props.chapterId,
        title: props.mangaTitle,
        coverUrl: props.coverUrl ?? undefined,
        chapter: props.chapterLabel.replace(/^Chapter\s*/i, "") || undefined,
        totalPages: safeTotalPages(total),
      };
    },
    [
      mangaId,
      props.chapterId,
      props.mangaTitle,
      props.coverUrl,
      props.chapterLabel,
      total,
    ],
  );

  const buildProgressPayload = useCallback(
    (page: number) => {
      const metadata = buildProgressMetadata();
      if (!metadata) return null;
      return { ...metadata, page };
    },
    [buildProgressMetadata],
  );

  const flushReadingProgress = useCallback(
    (force = false) => {
      const page = latestProgressPageRef.current;
      if (page <= 1) return;

      const now = Date.now();
      if (!force && now - lastProgressFlushRef.current < SERVER_PROGRESS_FLUSH_MS) {
        return;
      }

      const payload = buildProgressPayload(page);
      if (!payload) return;

      lastProgressFlushRef.current = now;
      fetch("/api/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify(payload),
      }).catch(() => {});
    },
    [buildProgressPayload],
  );

  const recordPageProgress = useCallback(
    (pageNumber: number) => {
      const page = normalizeReadablePage(pageNumber, total);
      if (!page || page <= 1) return;

      const metadata = buildProgressMetadata();
      if (!metadata) return;

      latestProgressPageRef.current = page;
      writeStoredProgress(props.chapterId, page, safeTotalPages(total), metadata);
      flushReadingProgress();
    },
    [buildProgressMetadata, flushReadingProgress, props.chapterId, total],
  );

  useEffect(() => {
    sessionRef.current = {
      startedAt: Date.now(),
      mode: sessionRef.current.mode,
      pagesSeen: new Set<number>(),
      maxPagedPage: 0,
      flushed: false,
      endSnapshot: null,
    };
  }, [props.chapterId]);

  useEffect(() => {
    latestProgressPageRef.current = 0;
    lastProgressFlushRef.current = Date.now();
  }, [props.chapterId]);

  useEffect(() => {
    const onPageHide = () => flushReadingProgress(true);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      flushReadingProgress(true);
    };
  }, [flushReadingProgress]);

  useEffect(() => {
    const localProgress = readStoredProgress(props.chapterId, total);
    const serverUpdatedAt = props.initialProgressUpdatedAt
      ? Date.parse(props.initialProgressUpdatedAt)
      : NaN;
    const serverPage =
      typeof props.initialProgressPage === "number"
        ? normalizeReadablePage(props.initialProgressPage, total)
        : null;
    const serverProgress =
      serverPage && Number.isFinite(serverUpdatedAt)
        ? {
            page: serverPage,
            totalPages: props.initialProgressTotalPages ?? null,
            updatedAt: serverUpdatedAt,
          }
        : null;
    const savedProgress = [localProgress, serverProgress]
      .filter((progress): progress is StoredChapterProgress => Boolean(progress))
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];

    if (!savedProgress) return;
    const isFinished = savedProgress.page >= total;
    const isOldEnough =
      Date.now() - savedProgress.updatedAt > RESUME_PROMPT_MIN_AGE_MS;

    if (savedProgress.page > 1 && !isFinished && isOldEnough) {
      let dismissTimer: ReturnType<typeof setTimeout> | undefined;
      const showTimer = setTimeout(() => {
        setResumePromptPage(savedProgress.page);
        dismissTimer = setTimeout(
          () => setResumePromptPage(null),
          RESUME_PROMPT_AUTO_DISMISS_MS,
        );
      }, 0);

      return () => {
        clearTimeout(showTimer);
        if (dismissTimer) clearTimeout(dismissTimer);
      };
    }
  }, [
    props.chapterId,
    props.initialProgressPage,
    props.initialProgressTotalPages,
    props.initialProgressUpdatedAt,
    total,
  ]);

  useEffect(() => {
    sessionRef.current.mode = mode;
  }, [mode]);

  useEffect(() => {
    if (mode !== "paged") return;
    const page = slide > total ? total : slide;
    if (page > 0 && page > sessionRef.current.maxPagedPage) {
      sessionRef.current.maxPagedPage = page;
    }
    if (page > 1 && page <= total) {
      recordPageProgress(page);
    }
  }, [mode, recordPageProgress, slide, total]);

  const markVerticalPageVisible = useCallback(
    (pageNumber: number) => {
      if (pageNumber < 1 || pageNumber > total) return;
      sessionRef.current.pagesSeen.add(pageNumber);
      setCurrentPage(pageNumber);
      recordPageProgress(pageNumber);
    },
    [recordPageProgress, total],
  );

  const flushReadingSession = useCallback((snapshotOverride?: ReaderSessionSnapshot) => {
    const readingSession = sessionRef.current;
    if (!mangaId || readingSession.flushed || readingSession.startedAt === 0) return;

    const snapshot =
      snapshotOverride ??
      readingSession.endSnapshot ??
      getReaderSessionSnapshot(readingSession, total);
    if (!snapshot || snapshot.durationSeconds < 3) return;

    readingSession.flushed = true;

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        mangaId,
        mangaTitle: props.mangaTitle,
        chapterId: props.chapterId,
        pagesRead: snapshot.pagesRead,
        durationSeconds: snapshot.durationSeconds,
      }),
    })
      .then((response) => {
        if (response.ok) markReadingRhythmReadToday();
      })
      .catch(() => {});
  }, [
    mangaId,
    markReadingRhythmReadToday,
    props.mangaTitle,
    props.chapterId,
    total,
  ]);

  const captureChapterEnd = useCallback(() => {
    const readingSession = sessionRef.current;
    const snapshot =
      readingSession.endSnapshot ??
      getReaderSessionSnapshot(readingSession, total);
    if (!snapshot) return;

    readingSession.endSnapshot = snapshot;
    setChapterEndStats(snapshot);

    const rhythm = rhythmQuery.data;
    if (!rhythm?.readToday && rhythm?.tickedTodayRhythmDays) {
      setChapterEndRhythmDays(rhythm.tickedTodayRhythmDays);
    }

    flushReadingSession(snapshot);
  }, [flushReadingSession, rhythmQuery.data, total]);

  useEffect(() => {
    if (mode === "vertical" && currentPage === total) {
      captureChapterEnd();
    }
  }, [captureChapterEnd, currentPage, mode, total]);

  useEffect(() => {
    const onPageHide = () => flushReadingSession();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      flushReadingSession();
    };
  }, [flushReadingSession]);

  // Predictive Commute Caching
  const [verticalPreloadReady, setVerticalPreloadReady] = useState(false);
  useEffect(() => {
    if (mode === "vertical") {
      const timer = setTimeout(() => setVerticalPreloadReady(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [mode]);
  const shouldPreloadNext =
    mode === "paged" ? slide >= Math.ceil(total / 2) : verticalPreloadReady;

  useEffect(() => {
    if (!shouldPreloadNext || !nextId || !allowsSpeculativeImagePreload()) {
      return;
    }
    [1, 2, 3, 4, 5].forEach((pageNumber) => {
      const img = new Image();
      if (pageNumber === 1) {
        img.onload = () => setNextTeaseReady(true);
      }
      // Proxy URL (matching the rendered pages' quality) so the preload warms
      // the same same-origin cache the next chapter will read from.
      img.src = chapterPageProxyUrl(nextId, pageNumber, useDataSaver);
    });
  }, [shouldPreloadNext, nextId, useDataSaver]);

  // Restore preferred mode.
  useEffect(() => {
    const saved = localStorage.getItem("reader-mode") as Mode | null;
    if (saved !== "vertical" && saved !== "paged") return;
    const frame = requestAnimationFrame(() => setMode(saved));
    return () => cancelAnimationFrame(frame);
  }, []);
  const changeMode = (m: Mode) => {
    setMode(m);
    localStorage.setItem("reader-mode", m);
  };

  // Record reading progress.
  useEffect(() => {
    const metadata = buildProgressMetadata();
    if (!metadata) return;

    const serverUpdatedAt = props.initialProgressUpdatedAt
      ? Date.parse(props.initialProgressUpdatedAt)
      : NaN;
    const fallbackPage =
      normalizeReadablePage(props.initialProgressPage ?? 1, total) ?? 1;
    writeStoredProgressMetadata(
      props.chapterId,
      metadata,
      fallbackPage,
      Number.isFinite(serverUpdatedAt) ? serverUpdatedAt : Date.now(),
    );

    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    }).catch(() => {});
  }, [
    buildProgressMetadata,
    props.chapterId,
    props.initialProgressPage,
    props.initialProgressUpdatedAt,
    total,
  ]);

  const goNextChapter = useCallback(() => {
    if (nextId) router.push(`/read/${nextId}`);
  }, [nextId, router]);
  const goPrevChapter = useCallback(() => {
    if (prevId) router.push(`/read/${prevId}`);
  }, [prevId, router]);

  const resumeAtPage = useCallback(
    (pageNumber: number) => {
      const page = normalizeReadablePage(pageNumber, total);
      if (!page) return;

      setResumePromptPage(null);
      setCurrentPage(page);
      sessionRef.current.pagesSeen.add(page);
      recordPageProgress(page);

      if (mode === "paged") {
        setSlideDirection(page >= slide ? 1 : -1);
        setSlide(page);
        return;
      }

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      document.getElementById(`reader-page-${page}`)?.scrollIntoView({
        block: "start",
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    },
    [mode, recordPageProgress, slide, total],
  );

  // Paged navigation + keyboard.
  const next = useCallback(() => {
    setSlideDirection(1);
    setSlide((s) => {
      if (s < lastSlide) {
        if (s === total) captureChapterEnd();
        return s + 1;
      }
      goNextChapter();
      return s;
    });
  }, [captureChapterEnd, lastSlide, goNextChapter, total]);
  const prev = useCallback(() => {
    setSlideDirection(-1);
    setSlide((s) => {
      if (s > 0) return s - 1;
      goPrevChapter();
      return s;
    });
  }, [goPrevChapter]);

  useEffect(() => {
    if (mode !== "paged") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isKeyboardCaptureTarget()) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, next, prev]);

  // Vertical-mode scrolling ('j/k', arrows, PageUp/Down, Home/End) plus the
  // shared 'z' zen toggle available in both modes. Space is intentionally left
  // to the browser's native scroll, and keys originating on a focusable
  // control (buttons, links) are left entirely to that control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        isInteractiveEventTarget(e) ||
        isKeyboardCaptureTarget()
      ) {
        return;
      }

      if ((e.key === "z" || e.key === "Z") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleZenMode();
        return;
      }

      if (mode !== "vertical") return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";
      const step = Math.round(window.innerHeight * 0.9);

      switch (e.key) {
        case "ArrowDown":
        case "PageDown":
        case "j":
          e.preventDefault();
          window.scrollBy({ top: step, behavior });
          break;
        case "ArrowUp":
        case "PageUp":
        case "k":
          e.preventDefault();
          window.scrollBy({ top: -step, behavior });
          break;
        case "Home":
          e.preventDefault();
          window.scrollTo({ top: 0, behavior });
          break;
        case "End":
          e.preventDefault();
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior,
          });
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, toggleZenMode]);

  // Preload neighbour image in paged mode.
  useEffect(() => {
    if (mode !== "paged" || !allowsSpeculativeImagePreload()) return;
    const nextPage = slide + 1;
    if (nextPage >= 1 && nextPage <= total) {
      const img = new Image();
      img.src = imageUrls[nextPage - 1];
    }
  }, [slide, mode, imageUrls, total]);

  const backHref = mangaId ? `/manga/${mangaId}` : "/";
  const readerStyle = { "--series-tint": DEFAULT_SERIES_TINT } as CSSProperties;

  return (
    <div
      ref={readerRootRef}
      className="relative min-h-screen overflow-hidden bg-reader-canvas text-reader-foreground"
      style={readerStyle}
    >
      <h1 className="sr-only">
        {props.mangaTitle} {props.chapterLabel}
        {props.chapterTitle ? `: ${props.chapterTitle}` : ""}
      </h1>
      {/* Vertical reading progress: a thin brand line that tracks scroll. */}
      {mode === "vertical" && (
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-x-0 top-0 z-40 h-[3px] bg-reader-line/40 transition-opacity duration-300",
            zenMode && "opacity-0",
          )}
        >
          <div
            data-yomi-series-tint-consumer="progress"
            className="h-full origin-left transition-[width] duration-150 ease-out"
            style={{
              width: `${scrollProgress * 100}%`,
              background: "var(--series-tint)",
            }}
          />
        </div>
      )}
      {/* Top bar */}
      <header className={cn("sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-reader-line bg-reader-chrome px-4 backdrop-blur transition-all duration-300", zenMode && "-translate-y-full opacity-0 pointer-events-none")}>
        <Link
          href={backHref}
          prefetch={false}
          aria-label={`Back to ${props.mangaTitle}`}
          className="flex min-h-11 items-center gap-2 rounded-lg text-sm hover:text-reader-muted focus-visible:ring-2 focus-visible:ring-reader-focus"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-medium">{props.mangaTitle}</p>
          <p className="truncate text-xs text-reader-muted">
            {props.chapterLabel}
            {props.chapterTitle ? `: ${props.chapterTitle}` : ""}
            {mode === "vertical" && total > 0 && (
              <span className="tabular-nums">
                {" · "}
                {Math.min(currentPage, total)} / {total}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => changeMode("vertical")}
            aria-label="Vertical mode"
            aria-pressed={mode === "vertical"}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-lg transition hover:bg-reader-control-hover focus-visible:ring-2 focus-visible:ring-reader-focus",
              mode === "vertical" && "bg-reader-control-selected",
            )}
          >
            <Rows3 className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => changeMode("paged")}
            aria-label="Paged mode"
            aria-pressed={mode === "paged"}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-lg transition hover:bg-reader-control-hover focus-visible:ring-2 focus-visible:ring-reader-focus",
              mode === "paged" && "bg-reader-control-selected",
            )}
          >
            <Columns2 className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggleZenMode}
            aria-label={zenMode ? "Exit immersive mode" : "Enter immersive mode"}
            aria-pressed={zenMode}
            className="grid h-11 w-11 place-items-center rounded-lg transition hover:bg-reader-control-hover focus-visible:ring-2 focus-visible:ring-reader-focus"
          >
            {zenMode ? (
              <Minimize2 className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {mode === "vertical" ? (
        <VerticalReader
          {...props}
          toggleZenMode={toggleZenMode}
          onPageVisible={markVerticalPageVisible}
          chapterEndStats={chapterEndStats}
          chapterEndRhythmDays={chapterEndRhythmDays}
          nextTeaseReady={nextTeaseReady}
          estimatedReadTime={estimatedReadTime}
          onChapterEndVisible={captureChapterEnd}
        />
      ) : (
        <PagedReader
          {...props}
          slide={slide}
          total={total}
          lastSlide={lastSlide}
          slideDirection={slideDirection}
          onNext={next}
          onPrev={prev}
          zenMode={zenMode}
          toggleZenMode={toggleZenMode}
          chapterEndStats={chapterEndStats}
          chapterEndRhythmDays={chapterEndRhythmDays}
          nextTeaseReady={nextTeaseReady}
          estimatedReadTime={estimatedReadTime}
          onChapterEndVisible={captureChapterEnd}
        />
      )}

      {/* First-run gesture hint, auto-dismissing. */}
      {showHint && !zenMode && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
          <p className="yomi-rise rounded-full border border-reader-line bg-reader-chrome px-4 py-2 text-xs font-medium text-reader-foreground shadow-2xl backdrop-blur">
            Tap the center to hide controls
          </p>
        </div>
      )}

      {resumePromptPage && (
        <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
          <div className="flex w-full max-w-sm items-center gap-2 rounded-full border border-reader-line bg-reader-chrome p-2 text-reader-foreground shadow-2xl backdrop-blur">
            <p className="min-w-0 flex-1 px-2 text-sm font-medium">
              Resume at page {resumePromptPage}
            </p>
            <button
              type="button"
              onClick={() => resumeAtPage(resumePromptPage)}
              className="h-9 rounded-full bg-action-primary px-3 text-sm font-semibold text-action-primary-foreground transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-reader-focus"
            >
              Resume
            </button>
            <button
              type="button"
              aria-label="Dismiss resume prompt"
              onClick={() => setResumePromptPage(null)}
              className="grid h-9 w-9 place-items-center rounded-full text-reader-muted transition hover:bg-reader-control-hover hover:text-reader-foreground focus-visible:ring-2 focus-visible:ring-reader-focus"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EndLibraryAction({
  mangaId,
  mangaTitle,
  coverUrl,
}: {
  mangaId: string | null;
  mangaTitle: string;
  coverUrl: string | null;
}) {
  const router = useRouter();
  const { isFavorite, isAuthenticated, isLoading, add } = useFavorites();

  if (!mangaId || isFavorite(mangaId) || (isAuthenticated && isLoading)) {
    return null;
  }

  return (
    <button
      type="button"
      disabled={add.isPending}
      onClick={() => {
        if (!isAuthenticated) {
          router.push("/login");
          return;
        }
        add.mutate({ mangaId, title: mangaTitle, coverUrl });
      }}
      className={buttonClassName({
        variant: "library",
        size: "lg",
        className: "w-full sm:w-auto",
      })}
    >
      <Heart className="h-5 w-5" aria-hidden="true" />
      Add to library
    </button>
  );
}

function ChapterEndMomentumCard({
  chapterLabel,
  prevId,
  nextId,
  mangaId,
  mangaTitle,
  coverUrl,
  stats,
  todayRhythmDays,
  nextTeaseReady,
  estimatedReadTime,
  onVisible,
}: {
  chapterLabel: string;
  prevId: string | null;
  nextId: string | null;
  mangaId: string | null;
  mangaTitle: string;
  coverUrl: string | null;
  stats: ReaderSessionSnapshot | null;
  todayRhythmDays: number | null;
  nextTeaseReady: boolean;
  estimatedReadTime: string | null;
  onVisible: () => void;
}) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [failedTeaseUrl, setFailedTeaseUrl] = useState<string | null>(null);
  const [saveDataEnabled] = useState(() => connectionSaveDataEnabled());
  const backHref = mangaId ? `/manga/${mangaId}` : "/";
  const teaseUrl = nextId ? `/chapter-page/${nextId}/1` : null;
  const allowTease =
    Boolean(teaseUrl) &&
    nextTeaseReady &&
    !saveDataEnabled &&
    failedTeaseUrl !== teaseUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      onViewportEnter={onVisible}
      className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-reader-line bg-reader-chrome p-5 text-center shadow-2xl backdrop-blur sm:p-6"
    >
      <p className="text-sm font-medium text-reader-muted">
        {formatMomentumStats(stats)}
      </p>
      {estimatedReadTime && (
        <p className="mt-1 text-xs font-medium text-reader-muted">
          {estimatedReadTime} estimated read
        </p>
      )}
      <h2 className="mt-2 text-lg font-semibold text-reader-foreground">
        End of {chapterLabel}
      </h2>

      {todayRhythmDays && (
        <p className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border border-library-line bg-library-surface px-3 py-1.5 text-sm font-medium text-reader-foreground">
          <span
            className="h-2 w-2 rounded-full bg-library shadow-[0_0_14px_var(--library)]"
            aria-hidden="true"
          />
          That&apos;s {todayRhythmDays}{" "}
          {todayRhythmDays === 1 ? "day" : "days"} in a row.
        </p>
      )}

      {allowTease && teaseUrl && (
        <div className="relative mx-auto mt-5 max-h-40 w-full max-w-56 overflow-hidden rounded-2xl border border-reader-line bg-reader-canvas">
          <img
            src={teaseUrl}
            alt=""
            loading="eager"
            decoding="async"
            onError={() => setFailedTeaseUrl(teaseUrl)}
            className="max-h-40 w-full object-cover object-top opacity-90"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-reader-chrome to-transparent"
          />
        </div>
      )}

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {nextId ? (
          <button
            type="button"
            onClick={() => router.push(`/read/${nextId}`)}
            className={buttonClassName({
              size: "lg",
              className:
                "w-full bg-action-primary text-action-primary-foreground hover:brightness-110 sm:w-auto",
            })}
          >
            Next chapter <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : (
          <>
            <p className="w-full text-sm font-medium text-reader-muted sm:w-auto">
              You&rsquo;re all caught up.
            </p>
            <EndLibraryAction
              mangaId={mangaId}
              mangaTitle={mangaTitle}
              coverUrl={coverUrl}
            />
            <Link
              href={backHref}
              className={buttonClassName({
                variant: "outline",
                size: "lg",
                className:
                  "w-full border-reader-line text-reader-foreground hover:bg-reader-control-hover sm:w-auto",
              })}
            >
              Back to manga
            </Link>
          </>
        )}
      </div>

      {prevId && (
        <button
          type="button"
          onClick={() => router.push(`/read/${prevId}`)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-reader-muted transition hover:text-reader-foreground focus-visible:ring-2 focus-visible:ring-reader-focus"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous chapter
        </button>
      )}
    </motion.div>
  );
}

function VerticalReader(
  props: Props & {
    toggleZenMode: () => void;
    onPageVisible: (pageNumber: number) => void;
    chapterEndStats: ReaderSessionSnapshot | null;
    chapterEndRhythmDays: number | null;
    nextTeaseReady: boolean;
    estimatedReadTime: string | null;
    onChapterEndVisible: () => void;
  },
) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col items-center" onClick={props.toggleZenMode}>
        {props.imageUrls.map((src, i) => (
          <ReaderPageImage
            key={src}
            src={src}
            alt={`Page ${i + 1}`}
            pageNumber={i + 1}
            eager={i < 2}
            onVisible={props.onPageVisible}
            imageClassName="h-auto w-full"
          />
        ))}
      </div>

      <div className="space-y-8 px-4 py-10">
        <ChapterEndMomentumCard
          chapterLabel={props.chapterLabel}
          prevId={props.prevId}
          nextId={props.nextId}
          mangaId={props.mangaId}
          mangaTitle={props.mangaTitle}
          coverUrl={props.coverUrl}
          stats={props.chapterEndStats}
          todayRhythmDays={props.chapterEndRhythmDays}
          nextTeaseReady={props.nextTeaseReady}
          estimatedReadTime={props.estimatedReadTime}
          onVisible={props.onChapterEndVisible}
        />
        <InternalAdPreview placement="reader" />
      </div>
    </div>
  );
}

function ReaderPageImage({
  src,
  alt,
  pageNumber,
  eager,
  onVisible,
  imageClassName,
}: {
  src: string;
  alt: string;
  pageNumber: number;
  eager: boolean;
  onVisible?: (pageNumber: number) => void;
  imageClassName: string;
}) {
  // `src` is the same-origin proxy URL. `attempt` cache-busts each reload of it
  // (automatic or manual); `manualRetries` bounds the user-driven retries.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [manualRetries, setManualRetries] = useState(0);
  const autoRetriedRef = useRef(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const canRetry = manualRetries < MAX_IMAGE_RETRIES;

  useEffect(() => {
    if (!onVisible) return;
    const element = pageRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      onVisible(pageNumber);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisible(pageNumber);
        }
      },
      { threshold: 0.55 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [onVisible, pageNumber]);

  const retryNow = () => {
    if (!canRetry) return;
    setFailed(false);
    setManualRetries((current) => current + 1);
    setAttempt((current) => current + 1);
  };
  const imageSrc =
    attempt > 0
      ? `${src}${src.includes("?") ? "&" : "?"}readerRetry=${attempt}`
      : src;

  return (
    <div
      id={`reader-page-${pageNumber}`}
      ref={pageRef}
      className="relative flex w-full justify-center overflow-hidden bg-reader-canvas"
    >
      <img
        key={attempt}
        src={imageSrc}
        alt={alt}
        width={1440}
        height={2048}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setFailed(false)}
        onError={() => {
          // First failure: silently retry the proxy once (cache-busted) before
          // surfacing any UI. Only if that automatic retry also fails do we
          // reveal the "Retry page" control.
          if (!autoRetriedRef.current) {
            autoRetriedRef.current = true;
            setAttempt((current) => current + 1);
            return;
          }
          setFailed(true);
        }}
        className={imageClassName}
      />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-reader-canvas text-xs text-reader-muted">
          {canRetry ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                retryNow();
              }}
              className="rounded-lg border border-reader-line px-3 py-2 transition hover:bg-reader-control-hover focus-visible:ring-2 focus-visible:ring-reader-focus"
            >
              Retry page
            </button>
          ) : (
            <span>Page failed to load</span>
          )}
        </div>
      )}
    </div>
  );
}

function PagedReader({
  imageUrls,
  slide,
  slideDirection,
  total,
  lastSlide,
  onNext,
  onPrev,
  prevId,
  nextId,
  mangaId,
  mangaTitle,
  coverUrl,
  chapterLabel,
  chapterTitle,
  zenMode,
  toggleZenMode,
  recap,
  chapterEndStats,
  chapterEndRhythmDays,
  nextTeaseReady,
  estimatedReadTime,
  onChapterEndVisible,
}: Props & {
  slide: number;
  slideDirection: 1 | -1;
  total: number;
  lastSlide: number;
  onNext: () => void;
  onPrev: () => void;
  zenMode: boolean;
  toggleZenMode: () => void;
  chapterEndStats: ReaderSessionSnapshot | null;
  chapterEndRhythmDays: number | null;
  nextTeaseReady: boolean;
  estimatedReadTime: string | null;
  onChapterEndVisible: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const isIntro = slide === 0;
  const isEnd = slide === lastSlide;
  const prevDisabled = isIntro && !prevId;
  const nextDisabled = isEnd && !nextId;

  const slideMotion = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, x: slideDirection > 0 ? 12 : -12 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: slideDirection > 0 ? -12 : 12 },
      };
  const slideContent = isIntro ? (
    <div className="w-full max-w-xl space-y-6 text-center">
      {recap && (
        <div className="rounded-2xl border border-reader-line bg-reader-chrome/50 p-6 backdrop-blur shadow-2xl mb-8 animate-in fade-in slide-in-from-bottom-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-reader-muted mb-2">The Story So Far</p>
          <p className="text-sm leading-relaxed">{recap}</p>
        </div>
      )}
      <h2 className="text-lg font-semibold">{chapterLabel}</h2>
      {estimatedReadTime && (
        <p className="text-sm text-reader-muted">
          {total} {total === 1 ? "page" : "pages"} · {estimatedReadTime}
        </p>
      )}
      {chapterTitle && (
        <p className="text-sm text-reader-muted">{chapterTitle}</p>
      )}
      <button
        type="button"
        onClick={onNext}
        aria-label="Start reading"
        className={buttonClassName({
          className: "bg-action-primary text-action-primary-foreground hover:brightness-110",
        })}
      >
        Start reading <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  ) : isEnd ? (
    <div className="w-full max-w-xl space-y-8 text-center">
      <ChapterEndMomentumCard
        chapterLabel={chapterLabel}
        prevId={prevId}
        nextId={nextId}
        mangaId={mangaId}
        mangaTitle={mangaTitle}
        coverUrl={coverUrl}
        stats={chapterEndStats}
        todayRhythmDays={chapterEndRhythmDays}
        nextTeaseReady={nextTeaseReady}
        estimatedReadTime={estimatedReadTime}
        onVisible={onChapterEndVisible}
      />
      <InternalAdPreview placement="reader" />
    </div>
  ) : (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden transition-opacity duration-700"
        style={{ opacity: zenMode ? 0.36 : 0.22 }}
      >
        <div
          data-yomi-series-tint-consumer="paged-glow"
          className="absolute left-1/2 top-1/2 h-[70vh] w-[min(56rem,80vw)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[96px] [background:var(--series-tint)]"
        />
      </div>
      <ReaderPageImage
        key={imageUrls[slide - 1]}
        src={imageUrls[slide - 1]}
        alt={`Page ${slide}`}
        pageNumber={slide}
        eager
        imageClassName={cn(
          "w-auto max-w-full object-contain drop-shadow-2xl transition-all duration-300",
          zenMode ? "max-h-screen" : "max-h-[calc(100vh-7rem)]",
        )}
      />
    </>
  );

  useEffect(() => {
    if (isEnd) onChapterEndVisible();
  }, [isEnd, onChapterEndVisible]);

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex flex-1 items-center justify-center p-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide}
            initial={slideMotion.initial}
            animate={slideMotion.animate}
            exit={slideMotion.exit}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex w-full justify-center"
          >
            {slideContent}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Click zones */}
      {!isIntro && !isEnd && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={onPrev}
            className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize"
          />
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={toggleZenMode}
            className="absolute inset-y-0 left-1/3 w-1/3 cursor-pointer"
          />
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={onNext}
            className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize"
          />
        </>
      )}

      {/* Footer controls */}
      <div className={cn("sticky bottom-0 flex min-h-14 items-center justify-between gap-4 border-t border-reader-line bg-reader-chrome px-4 py-2 text-sm backdrop-blur transition-all duration-300", zenMode && "translate-y-full opacity-0 pointer-events-none")}>
        <button
          type="button"
          disabled={prevDisabled}
          onClick={onPrev}
          aria-label={isIntro ? "Previous chapter" : "Previous page"}
          className="grid h-11 min-w-11 place-items-center rounded-lg px-3 hover:bg-reader-control-hover focus-visible:ring-2 focus-visible:ring-reader-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="text-reader-muted" aria-live="polite">
          {isIntro ? "Start" : isEnd ? "End" : `${slide} / ${total}`}
        </span>
        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          aria-label={isEnd ? "Next chapter" : "Next page"}
          className="grid h-11 min-w-11 place-items-center rounded-lg px-3 hover:bg-reader-control-hover focus-visible:ring-2 focus-visible:ring-reader-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
