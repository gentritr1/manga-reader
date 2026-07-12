"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Heart,
  Keyboard,
  Maximize2,
  Minimize2,
  Rows3,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { InternalAdPreview } from "@/components/ads/internal-ad-preview";
import { buttonClassName } from "@/components/ui/button";
import {
  DEFAULT_SERIES_TINT,
  readCachedSeriesTint,
} from "@/lib/extract-tint";
import {
  DEFAULT_IMAGE_QUALITY,
  readImageQuality,
  resolveDataSaver,
  writeImageQuality,
  type ImageQuality,
} from "@/lib/image-quality";
import { chapterPageProxyUrl } from "@/lib/mangadex";
import { formatReadTimeEstimate } from "@/lib/read-time";
import { useFavorites } from "@/lib/use-favorites";
import {
  useMarkReadingRhythmReadToday,
  useReadingRhythm,
} from "@/lib/use-reading-rhythm";
import { cn } from "@/lib/utils";

type Mode = "vertical" | "paged";
type Direction = "ltr" | "rtl";
type Spread = "single" | "double";
type FitMode = "fit-width" | "fit-height" | "original";

const READER_PREFS_PREFIX = "yomi-reader-prefs:";
const GLOBAL_MODE_KEY = "reader-mode";
// Viewport threshold below which double-page spread silently falls back to
// single pages (state is preserved, only rendering/navigation change).
const SPREAD_MIN_WIDTH = 1024;

// Paged-mode zoom bounds. Zoom applies to the current page/spread via a CSS
// transform (1x–3x); vertical mode never zooms (fit modes cover it).
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.5;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
}

interface ReaderPrefs {
  mode: Mode;
  direction: Direction;
  spread: Spread;
  spreadOffset: boolean;
  // null means "not explicitly chosen" → the effective fit is derived from the
  // current mode (vertical → fit-width, paged → fit-height) so existing users
  // see zero change until they opt in.
  fit: FitMode | null;
}

// Effective fit falls back to the per-mode default when the user hasn't picked
// one explicitly. Keeps fresh-localStorage rendering identical to before PR-4.
function effectiveFitFor(fit: FitMode | null, mode: Mode): FitMode {
  if (fit) return fit;
  return mode === "vertical" ? "fit-width" : "fit-height";
}

function readerPrefsKey(mangaId: string) {
  return `${READER_PREFS_PREFIX}${mangaId}`;
}

function readReaderPrefs(mangaId: string): ReaderPrefs | null {
  try {
    const raw = localStorage.getItem(readerPrefsKey(mangaId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
    const mode: Mode = parsed.mode === "paged" ? "paged" : "vertical";
    const direction: Direction = parsed.direction === "rtl" ? "rtl" : "ltr";
    const spread: Spread = parsed.spread === "double" ? "double" : "single";
    const spreadOffset = parsed.spreadOffset === true;
    const fit: FitMode | null =
      parsed.fit === "fit-width" ||
      parsed.fit === "fit-height" ||
      parsed.fit === "original"
        ? parsed.fit
        : null;
    return { mode, direction, spread, spreadOffset, fit };
  } catch {
    return null;
  }
}

function writeReaderPrefs(mangaId: string, prefs: ReaderPrefs) {
  try {
    localStorage.setItem(readerPrefsKey(mangaId), JSON.stringify(prefs));
  } catch {}
}

// --- Paged-mode pairing model -------------------------------------------------
// Logical page order NEVER changes (1..total). These helpers only decide how
// logical pages are grouped into on-screen "views" and how the leading page of
// each view advances. `slide` always holds the LOWEST logical page of the
// current view (0 = intro, total+1 = end sentinel), so progress persistence and
// session tracking keep recording the first page of the visible pair unchanged.
//
// Default (offset off): page 1 is shown ALONE (cover convention), then pairs
//   1 | 2-3 | 4-5 | 6-7 ...  (even leading pages after the cover)
// Offset on ("shift pairing by one"): no lone cover, pairs from the start
//   1-2 | 3-4 | 5-6 ...  (odd leading pages)

function pageViewMembers(
  leading: number,
  total: number,
  doubleSpread: boolean,
  offset: boolean,
): number[] {
  if (!doubleSpread) return [leading];
  if (!offset && leading === 1) return [1];
  return leading + 1 <= total ? [leading, leading + 1] : [leading];
}

// Snap an arbitrary logical page to the leading page of the view that contains
// it, given the active pairing. Used when spread/offset toggles mid-read or when
// resuming at a stored page.
function leadingPageFor(
  page: number,
  doubleSpread: boolean,
  offset: boolean,
): number {
  if (!doubleSpread) return page;
  if (!offset) {
    if (page <= 1) return 1;
    return page % 2 === 0 ? page : page - 1;
  }
  return page % 2 === 1 ? page : page - 1;
}

function nextLeadingPage(
  leading: number,
  doubleSpread: boolean,
  offset: boolean,
): number {
  if (!doubleSpread) return leading + 1;
  if (!offset) return leading === 1 ? 2 : leading + 2;
  return leading + 2;
}

function prevLeadingPage(
  leading: number,
  doubleSpread: boolean,
  offset: boolean,
): number {
  if (!doubleSpread) return leading - 1;
  if (!offset) return leading === 2 ? 1 : leading - 2;
  return leading - 2;
}

// Tailwind class for a single page <img> under the active fit mode.
// fit-height reproduces the pre-PR-4 sizing exactly for both readers.
function pageImageClassName(
  fit: FitMode,
  mode: Mode,
  zenMode: boolean,
): string {
  if (mode === "paged") {
    switch (fit) {
      case "fit-width":
        return "h-auto w-full max-w-full drop-shadow-2xl";
      case "original":
        return "h-auto w-auto max-w-[min(100%,1600px)] drop-shadow-2xl";
      case "fit-height":
      default:
        return cn(
          "w-auto max-w-full object-contain drop-shadow-2xl transition-all duration-300",
          zenMode ? "max-h-screen" : "max-h-[calc(100vh-7rem)]",
        );
    }
  }
  // vertical
  switch (fit) {
    case "fit-height":
      return "mx-auto max-h-[100vh] w-auto object-contain";
    case "original":
      return "mx-auto h-auto w-auto max-w-full";
    case "fit-width":
    default:
      return "h-auto w-full";
  }
}

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

// Single end-card meta line: page count from the session (fallback to none) plus
// the read-time estimate. Collapses the old two-line "N pages · M min" +
// "~M min estimated read" into one "11 pages · ~1 min" so the estimate is stated
// exactly once.
function formatEndMeta(
  stats: ReaderSessionSnapshot | null,
  estimatedReadTime: string | null,
) {
  const pagesLabel = stats
    ? stats.pagesRead === 1
      ? "1 page"
      : `${stats.pagesRead} pages`
    : null;
  const parts = [pagesLabel, estimatedReadTime].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" · ") : "Chapter complete";
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
  const { imageUrls, prevId, nextId, mangaId } = props;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("vertical");
  // PR-4 reader preferences (paged direction/spread + fit), persisted per title.
  const [direction, setDirection] = useState<Direction>("ltr");
  const [spread, setSpread] = useState<Spread>("single");
  const [spreadOffset, setSpreadOffset] = useState(false);
  const [fit, setFit] = useState<FitMode | null>(null);
  // Wide enough for a two-page spread? Defaults false for SSR/hydration safety,
  // then reflects the live viewport. Double spread only renders when true.
  const [isWideViewport, setIsWideViewport] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  // Keyboard-shortcuts overlay (opened with '?' or the settings-panel hint).
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const shortcutsRestoreRef = useRef<HTMLElement | null>(null);
  const openShortcuts = useCallback(() => {
    shortcutsRestoreRef.current = document.activeElement as HTMLElement | null;
    setShortcutsOpen(true);
  }, []);
  const closeShortcuts = useCallback(() => {
    setShortcutsOpen(false);
    const restore = shortcutsRestoreRef.current;
    requestAnimationFrame(() => restore?.focus?.());
  }, []);
  // Paged-mode zoom (transform scale + pan offset). Vertical mode ignores these.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);
  const doubleSpread = spread === "double" && isWideViewport;
  const effectiveFit = effectiveFitFor(fit, mode);
  const [zenMode, setZenMode] = useState(false);
  const toggleZenMode = useCallback(() => setZenMode((z) => !z), []);
  // Idle-fade for the top bar: hides after inactivity, restores on any activity
  // or when a control inside it holds focus. Independent of zen mode.
  const [chromeIdle, setChromeIdle] = useState(false);
  const chromeIdleRef = useRef(false);
  const readerHeaderRef = useRef<HTMLElement>(null);
  // Paged slides: 0 = intro, 1..N = pages, N+1 = end.
  const [slide, setSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const total = imageUrls.length;
  const lastSlide = total + 1;

  // Global image-quality setting (see lib/image-quality). `imageQuality` drives
  // the settings UI; `resolvedSaver` is the concrete data-saver boolean the page
  // URLs are built from. Both start at their SSR-safe defaults (original quality
  // → `resolvedSaver` false → the exact server-rendered `imageUrls`) and are
  // reconciled from localStorage + navigator.connection after mount, so a fast
  // connection never double-fetches page 1 at a different quality.
  const [imageQuality, setImageQuality] =
    useState<ImageQuality>(DEFAULT_IMAGE_QUALITY);
  const [resolvedSaver, setResolvedSaver] = useState(false);
  useEffect(() => {
    const quality = readImageQuality();
    // Client-only reconciliation from localStorage + navigator.connection; a
    // post-mount effect is the intended way to avoid a hydration mismatch, so
    // these synchronous setStates are deliberate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageQuality(quality);
    setResolvedSaver(resolveDataSaver(quality));
  }, []);
  const changeImageQuality = useCallback((quality: ImageQuality) => {
    setImageQuality(quality);
    setResolvedSaver(resolveDataSaver(quality));
    // Persist only on an explicit user change so a reader who never opens the
    // panel leaves no localStorage key behind.
    writeImageQuality(quality);
  }, []);
  // Page URLs the reader actually renders/preloads. When original quality is in
  // effect this is the untouched server array (same references → no remount, no
  // extra fetch); when data-saver resolves true it rebuilds the distinct
  // ?quality=data-saver proxy URLs, re-pointing srcs without touching scroll or
  // slide state so the reading position is preserved.
  const pageUrls = useMemo(
    () =>
      resolvedSaver
        ? Array.from({ length: total }, (_, i) =>
            chapterPageProxyUrl(props.chapterId, i + 1, true),
          )
        : imageUrls,
    [resolvedSaver, total, props.chapterId, imageUrls],
  );

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

  // Auto-fade the top bar after ~2.5s of no pointer / scroll / key / touch
  // activity; any activity or focus landing inside the bar restores it
  // instantly. State only flips when crossing the idle boundary, so mousemove
  // spam does not re-render. Focus is honoured two ways: focusin wakes it, and
  // the fade timer refuses to hide while a control inside the bar has focus.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const IDLE_MS = 2500;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const header = readerHeaderRef.current;
        if (header && header.contains(document.activeElement)) {
          schedule();
          return;
        }
        chromeIdleRef.current = true;
        setChromeIdle(true);
      }, IDLE_MS);
    };
    const wake = () => {
      if (chromeIdleRef.current) {
        chromeIdleRef.current = false;
        setChromeIdle(false);
      }
      schedule();
    };

    window.addEventListener("pointermove", wake, { passive: true });
    window.addEventListener("pointerdown", wake, { passive: true });
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("touchstart", wake, { passive: true });
    window.addEventListener("keydown", wake);
    document.addEventListener("focusin", wake);
    schedule();

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("touchstart", wake);
      window.removeEventListener("keydown", wake);
      document.removeEventListener("focusin", wake);
    };
  }, []);

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
      // Proxy URL (matching the rendered pages' resolved quality) so the preload
      // warms the same same-origin cache the next chapter will read from.
      img.src = chapterPageProxyUrl(nextId, pageNumber, resolvedSaver);
    });
  }, [shouldPreloadNext, nextId, resolvedSaver]);

  // Restore reader preferences. Fallback chain: per-title prefs → global
  // reader-mode key (legacy default) → hardcoded defaults. A NEW manga (no
  // per-title prefs yet) starts from the global default mode; no key is written
  // until the user actually changes a setting.
  // Client-only reconciliation from localStorage, applied SYNCHRONOUSLY in the
  // effect (the same intentional pattern as the image-quality effect above).
  // This used to hop through requestAnimationFrame, but that made the restore
  // cancelable: the frame callback could be dropped around view-transition
  // navigations, leaving stored prefs (mode/direction/spread/fit) silently
  // unapplied. A direct setState in a mount effect cannot be lost, and it also
  // applies one frame earlier than the old rAF path.
  useEffect(() => {
    const prefs = mangaId ? readReaderPrefs(mangaId) : null;
    if (prefs) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode(prefs.mode);
      setDirection(prefs.direction);
      setSpread(prefs.spread);
      setSpreadOffset(prefs.spreadOffset);
      setFit(prefs.fit);
      return;
    }
    const savedMode = localStorage.getItem(GLOBAL_MODE_KEY);
    if (savedMode === "vertical" || savedMode === "paged") setMode(savedMode);
  }, [mangaId]);

  // Track viewport width for the spread threshold.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia(`(min-width: ${SPREAD_MIN_WIDTH}px)`);
    const apply = () => setIsWideViewport(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // Persist the full prefs object for this title. Called from each change
  // handler with the changed field(s); merges over current state so a single
  // write always captures the whole object. No-op without a mangaId.
  const persistPrefs = useCallback(
    (next: Partial<ReaderPrefs>) => {
      if (!mangaId) return;
      writeReaderPrefs(mangaId, {
        mode,
        direction,
        spread,
        spreadOffset,
        fit,
        ...next,
      });
    },
    [mangaId, mode, direction, spread, spreadOffset, fit],
  );

  const changeMode = useCallback(
    (m: Mode) => {
      setMode(m);
      // Keep writing the global default so a brand-new manga inherits it.
      localStorage.setItem(GLOBAL_MODE_KEY, m);
      persistPrefs({ mode: m });
    },
    [persistPrefs],
  );
  const changeDirection = useCallback(
    (d: Direction) => {
      setDirection(d);
      persistPrefs({ direction: d });
    },
    [persistPrefs],
  );
  const changeSpread = useCallback(
    (s: Spread) => {
      setSpread(s);
      persistPrefs({ spread: s });
    },
    [persistPrefs],
  );
  const toggleSpreadOffset = useCallback(() => {
    const nextValue = !spreadOffset;
    setSpreadOffset(nextValue);
    persistPrefs({ spreadOffset: nextValue });
  }, [spreadOffset, persistPrefs]);
  const changeFit = useCallback(
    (f: FitMode) => {
      setFit(f);
      persistPrefs({ fit: f });
    },
    [persistPrefs],
  );

  const closeSettings = useCallback((returnFocus: boolean) => {
    setSettingsOpen(false);
    if (returnFocus) settingsTriggerRef.current?.focus();
  }, []);

  // Settings panel: focus the first control on open, Escape closes and returns
  // focus to the trigger, outside pointerdown light-dismisses. Focus lands
  // inside the panel (role="dialog"), so isKeyboardCaptureTarget() is true while
  // it is open — arrows inside never turn pages.
  useEffect(() => {
    if (!settingsOpen) return;
    const panel = settingsPanelRef.current;
    panel
      ?.querySelector<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      )
      ?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeSettings(true);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        settingsPanelRef.current?.contains(target) ||
        settingsTriggerRef.current?.contains(target)
      ) {
        return;
      }
      closeSettings(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [settingsOpen, closeSettings]);

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
        setSlide(leadingPageFor(page, doubleSpread, spreadOffset));
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
    [mode, recordPageProgress, slide, total, doubleSpread, spreadOffset],
  );

  // Paged navigation + keyboard. Advances by the pair size in double spread;
  // `slide` stays the leading (lowest) logical page of the view. Direction only
  // changes which key/zone triggers next vs prev — never the logical order here.
  const next = useCallback(() => {
    setSlideDirection(1);
    setSlide((s) => {
      if (s >= lastSlide) {
        goNextChapter();
        return s;
      }
      if (s === 0) return 1; // intro → first view (always leads at page 1)
      const target = nextLeadingPage(s, doubleSpread, spreadOffset);
      if (target > total) {
        captureChapterEnd();
        return lastSlide;
      }
      return target;
    });
  }, [captureChapterEnd, lastSlide, goNextChapter, total, doubleSpread, spreadOffset]);
  const prev = useCallback(() => {
    setSlideDirection(-1);
    setSlide((s) => {
      if (s <= 0) {
        goPrevChapter();
        return s;
      }
      if (s === lastSlide) {
        // End sentinel → back to the last content view's leading page.
        return leadingPageFor(total, doubleSpread, spreadOffset);
      }
      const target = prevLeadingPage(s, doubleSpread, spreadOffset);
      return target < 1 ? 0 : target;
    });
  }, [goPrevChapter, lastSlide, total, doubleSpread, spreadOffset]);

  // When the pairing changes (spread toggled, offset toggled, or the viewport
  // crosses the spread threshold — an external signal) re-snap the current
  // content page to a valid leading page so the view stays aligned. Reacting to
  // that external change is exactly what this effect is for; the functional
  // update is a no-op unless the leading page actually shifts.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlide((s) => {
      if (s <= 0 || s > total) return s;
      return leadingPageFor(s, doubleSpread, spreadOffset);
    });
  }, [doubleSpread, spreadOffset, total]);

  useEffect(() => {
    if (mode !== "paged") return;
    // In RTL the next page in reading order is reached with ArrowLeft. The
    // settings panel is role="dialog", so isKeyboardCaptureTarget() keeps arrows
    // pressed inside it from turning pages.
    const forwardKey = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backKey = direction === "rtl" ? "ArrowRight" : "ArrowLeft";
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isKeyboardCaptureTarget()) return;
      if (e.key === forwardKey) next();
      else if (e.key === backKey) prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, next, prev, direction]);

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

  // Any page change (arrows, side-zone clicks, resume) resets zoom to 1x so the
  // next page always starts un-zoomed and un-panned. Reacting to the external
  // `slide` change is exactly what this effect is for.
  useEffect(() => {
    // Resetting zoom in response to the external `slide` change is the intent of
    // this effect (not a render-derived cascade), so the setState is deliberate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetZoom();
  }, [slide, resetZoom]);

  // '?' (Shift+/) opens the shortcuts overlay in both modes. Guarded by the same
  // capture-target checks as every other reader shortcut, so it never fires while
  // typing or while a dialog (settings/overlay) holds focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "?") return;
      if (isInteractiveEventTarget(e) || isKeyboardCaptureTarget()) return;
      e.preventDefault();
      openShortcuts();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openShortcuts]);

  // Paged-mode zoom keys: +/= zoom in, -/_ zoom out, 0 reset. Only on a content
  // page (not intro/end), and never while a control/dialog has focus. Vertical
  // mode deliberately ignores these — fit modes cover its sizing.
  useEffect(() => {
    if (mode !== "paged") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isInteractiveEventTarget(e) || isKeyboardCaptureTarget()) return;
      if (slide <= 0 || slide > total) return; // only on content pages
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => clampZoom(z + ZOOM_STEP));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => {
          const next = clampZoom(z - ZOOM_STEP);
          if (next <= 1) setPan({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, slide, total, resetZoom]);

  // Preload neighbour images in paged mode. Warm the next ~3 logical pages so a
  // page turn rarely waits on the network; double spread advances two pages per
  // view, so reach one page further to cover the next two views. Bounded on
  // purpose — no full-chapter eager fetch (the proxy is a bandwidth choke
  // point). Uses `pageUrls` so preloads match the rendered pages' quality.
  useEffect(() => {
    if (mode !== "paged" || !allowsSpeculativeImagePreload()) return;
    const ahead = doubleSpread ? [1, 2, 3, 4] : [1, 2, 3];
    ahead.forEach((delta) => {
      const nextPage = slide + delta;
      if (nextPage >= 1 && nextPage <= total) {
        const img = new Image();
        img.src = pageUrls[nextPage - 1];
      }
    });
  }, [slide, mode, pageUrls, total, doubleSpread]);

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
      <header ref={readerHeaderRef} className={cn("sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-reader-line bg-reader-chrome px-4 backdrop-blur transition-all duration-300", zenMode && !settingsOpen && "-translate-y-full opacity-0 pointer-events-none", !zenMode && chromeIdle && !settingsOpen && "opacity-0 pointer-events-none")}>
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
          <div className="relative">
            <button
              ref={settingsTriggerRef}
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label="Reader settings"
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-lg transition hover:bg-reader-control-hover focus-visible:ring-2 focus-visible:ring-reader-focus",
                settingsOpen && "bg-reader-control-selected",
              )}
            >
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
            {settingsOpen && (
              <ReaderSettingsPanel
                panelRef={settingsPanelRef}
                mode={mode}
                direction={direction}
                spread={spread}
                spreadOffset={spreadOffset}
                effectiveFit={effectiveFit}
                imageQuality={imageQuality}
                isWideViewport={isWideViewport}
                onChangeDirection={changeDirection}
                onChangeSpread={changeSpread}
                onToggleSpreadOffset={toggleSpreadOffset}
                onChangeFit={changeFit}
                onChangeImageQuality={changeImageQuality}
                onOpenShortcuts={() => {
                  // Restore focus to the settings trigger when the overlay later
                  // closes, then swap the settings panel for the overlay.
                  settingsTriggerRef.current?.focus();
                  setSettingsOpen(false);
                  openShortcuts();
                }}
                onClose={() => closeSettings(true)}
              />
            )}
          </div>
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
          imageUrls={pageUrls}
          fit={effectiveFit}
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
          imageUrls={pageUrls}
          slide={slide}
          total={total}
          lastSlide={lastSlide}
          slideDirection={slideDirection}
          direction={direction}
          doubleSpread={doubleSpread}
          spreadOffset={spreadOffset}
          fit={effectiveFit}
          onNext={next}
          onPrev={prev}
          zoom={zoom}
          pan={pan}
          onSetZoom={setZoom}
          onSetPan={setPan}
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

      {shortcutsOpen && (
        <ReaderShortcutsOverlay
          mode={mode}
          direction={direction}
          onClose={closeShortcuts}
        />
      )}
    </div>
  );
}

// Library CTA for the end card. `emphasis` picks the resting look when NOT yet
// saved: "primary" is the violet filled action (used when the reader is caught
// up and following is the natural next step); "secondary" is an outlined reader-
// chrome button (used when a next-chapter CTA already owns the primary slot).
// Once saved it swaps to a clearly pressed "In your library" state (aria-pressed
// + filled heart) and toggling removes. All colours come from reader-* / action-
// primary tokens so the label stays high-contrast on the dark reader canvas.
function EndLibraryAction({
  mangaId,
  mangaTitle,
  coverUrl,
  emphasis,
}: {
  mangaId: string | null;
  mangaTitle: string;
  coverUrl: string | null;
  emphasis: "primary" | "secondary";
}) {
  const router = useRouter();
  const { isFavorite, isAuthenticated, isLoading, add, remove } = useFavorites();

  // Wait for the favorites list before committing to a label, but only when the
  // viewer is signed in — anonymous readers can render the add CTA immediately.
  if (!mangaId || (isAuthenticated && isLoading)) {
    return null;
  }

  const active = isFavorite(mangaId);
  const busy = add.isPending || remove.isPending;
  // Unsaved + primary uses the default violet button pair (contrast-correct in
  // both themes). Every other state is an outlined reader-chrome button; the
  // outline base ships bg-transparent, so twMerge lets the reader-token override
  // win without the default variant's violet fill leaking through.
  const variant = !active && emphasis === "primary" ? "default" : "outline";
  const stateClass = active
    ? "border-reader-line bg-reader-control-selected text-reader-foreground hover:bg-reader-control-hover"
    : emphasis === "primary"
      ? ""
      : "border-reader-line text-reader-foreground hover:bg-reader-control-hover";

  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={active}
      aria-label={
        active
          ? `Remove ${mangaTitle} from library`
          : `Add ${mangaTitle} to library`
      }
      onClick={() => {
        if (!isAuthenticated) {
          router.push("/login");
          return;
        }
        if (active) remove.mutate(mangaId);
        else add.mutate({ mangaId, title: mangaTitle, coverUrl });
      }}
      className={buttonClassName({
        variant,
        size: "lg",
        className: cn("w-full sm:w-auto", stateClass),
      })}
    >
      <Heart
        className={cn("h-5 w-5", active && "fill-current")}
        aria-hidden="true"
      />
      {active ? "In your library" : "Add to library"}
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
      <p className="text-xs font-medium text-reader-muted">
        {formatEndMeta(stats, estimatedReadTime)}
      </p>
      <h2 className="mt-2 font-display text-2xl font-bold text-reader-foreground">
        End of {chapterLabel}
      </h2>
      {!nextId && (
        <p className="mt-1.5 text-sm font-medium text-reader-muted">
          You&rsquo;re all caught up.
        </p>
      )}

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
          <>
            {/* Next chapter keeps the primary slot; library follows as secondary. */}
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
            <EndLibraryAction
              mangaId={mangaId}
              mangaTitle={mangaTitle}
              coverUrl={coverUrl}
              emphasis="secondary"
            />
          </>
        ) : (
          <>
            {/* Caught up: following for new drops is the natural next action, so
                the library CTA takes the primary violet slot. */}
            <EndLibraryAction
              mangaId={mangaId}
              mangaTitle={mangaTitle}
              coverUrl={coverUrl}
              emphasis="primary"
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
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => router.push(`/read/${prevId}`)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-reader-muted transition hover:text-reader-foreground focus-visible:ring-2 focus-visible:ring-reader-focus"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous chapter
          </button>
        </div>
      )}
    </motion.div>
  );
}

function VerticalReader(
  props: Props & {
    fit: FitMode;
    toggleZenMode: () => void;
    onPageVisible: (pageNumber: number) => void;
    chapterEndStats: ReaderSessionSnapshot | null;
    chapterEndRhythmDays: number | null;
    nextTeaseReady: boolean;
    estimatedReadTime: string | null;
    onChapterEndVisible: () => void;
  },
) {
  const pageImageClass = pageImageClassName(props.fit, "vertical", false);
  return (
    <div
      className={cn(
        "mx-auto",
        props.fit === "fit-width" ? "max-w-3xl" : "max-w-[1600px]",
      )}
    >
      <div className="flex flex-col items-center" onClick={props.toggleZenMode}>
        {props.imageUrls.map((src, i) => (
          <ReaderPageImage
            key={src}
            src={src}
            alt={`Page ${i + 1}`}
            pageNumber={i + 1}
            eager={i < 2}
            onVisible={props.onPageVisible}
            imageClassName={pageImageClass}
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

  // Vertical prefetch: warm this page's bytes ~1.5 viewports before it scrolls
  // in so reading rarely stalls on a fetch. Deliberately a SEPARATE observer
  // from the progress one above — its generous rootMargin must never mark a page
  // "seen" early. Skipped for eager pages (already loading) and on save-data /
  // slow connections. The warm request shares the browser cache with the real
  // <img loading="lazy">, so no duplicate network fetch when it enters view.
  useEffect(() => {
    if (eager) return;
    const element = pageRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    if (!allowsSpeculativeImagePreload()) return;
    let warmed = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (warmed || !entries.some((entry) => entry.isIntersecting)) return;
        warmed = true;
        const img = new Image();
        img.src = src;
        observer.disconnect();
      },
      { rootMargin: "150% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [eager, src]);

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
  direction,
  doubleSpread,
  spreadOffset,
  fit,
  onNext,
  onPrev,
  zoom,
  pan,
  onSetZoom,
  onSetPan,
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
  direction: Direction;
  doubleSpread: boolean;
  spreadOffset: boolean;
  fit: FitMode;
  onNext: () => void;
  onPrev: () => void;
  zoom: number;
  pan: { x: number; y: number };
  onSetZoom: (updater: number | ((z: number) => number)) => void;
  onSetPan: (pan: { x: number; y: number }) => void;
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
  const isContent = !isIntro && !isEnd;

  // Logical pages visible in the current view, and their on-screen order. RTL
  // puts the LOWER page number on the RIGHT (Japanese book order), so we reverse
  // the DOM order; the counter always reads low-high regardless.
  const viewMembers = isContent
    ? pageViewMembers(slide, total, doubleSpread, spreadOffset)
    : [];
  const renderPages =
    direction === "rtl" ? [...viewMembers].reverse() : viewMembers;
  const isSpreadView = viewMembers.length > 1;
  const pageImageClass = pageImageClassName(fit, "paged", zenMode);
  // fit-height keeps the whole view centered; fit-width/original may exceed the
  // viewport and need a scrollable, top-aligned container.
  const scrollable = isContent && fit !== "fit-height";
  // Direction-aware page counter, e.g. "4-5 / 26".
  const pageCounter = isIntro
    ? "Start"
    : isEnd
      ? "End"
      : isSpreadView
        ? `${viewMembers[0]}-${viewMembers[1]} / ${total}`
        : `${viewMembers[0]} / ${total}`;
  // Left/right click zones map to reading order per direction: in RTL the LEFT
  // half advances (next), the RIGHT half goes back.
  const leftZoneAction = direction === "rtl" ? onNext : onPrev;
  const rightZoneAction = direction === "rtl" ? onPrev : onNext;

  // --- Paged-mode zoom (transform scale + pan) ------------------------------
  // While zoomed >1x the page/spread is scaled and can be dragged; the side
  // page-turn zones are removed so drags reach the image (arrows still turn the
  // page, which resets zoom). Vertical mode never reaches this component's zoom.
  const zoomRef = useRef<HTMLDivElement>(null);
  const zoomed = zoom > 1;
  const [dragging, setDragging] = useState(false);
  const panStart = useRef<{
    px: number;
    py: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  // ctrl/cmd + wheel zoom. Attached natively (non-passive) so preventDefault can
  // stop the browser's page-zoom while over the reader.
  useEffect(() => {
    const el = zoomRef.current;
    if (!el || !isContent) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      onSetZoom((z) => {
        const next = clampZoom(z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
        if (next <= 1) onSetPan({ x: 0, y: 0 });
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isContent, onSetZoom, onSetPan]);

  // Double-click toggles 1x <-> 2x. Zoom is centered (transform-origin center);
  // pointer-anchored zoom was deliberately not attempted to keep the pan math
  // simple and predictable.
  const handleDoubleClick = () => {
    if (!isContent) return;
    onSetPan({ x: 0, y: 0 });
    onSetZoom((z) => (z > 1 ? 1 : 2));
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!zoomed) return;
    setDragging(true);
    panStart.current = { px: e.clientX, py: e.clientY, baseX: pan.x, baseY: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = panStart.current;
    if (!start) return;
    const rect = zoomRef.current?.getBoundingClientRect();
    // Clamp the pan so the scaled page can't be dragged completely off-screen.
    const maxX = rect ? (rect.width * (zoom - 1)) / 2 : Infinity;
    const maxY = rect ? (rect.height * (zoom - 1)) / 2 : Infinity;
    const nx = start.baseX + (e.clientX - start.px);
    const ny = start.baseY + (e.clientY - start.py);
    onSetPan({
      x: Math.min(maxX, Math.max(-maxX, nx)),
      y: Math.min(maxY, Math.max(-maxY, ny)),
    });
  };
  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    panStart.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Directional page-turn: in LTR, NEXT slides the incoming page in from the
  // right; in RTL the slide inverts so NEXT comes in from the left. Reduced
  // motion drops the translate and keeps a plain opacity fade.
  const motionSign = slideDirection * (direction === "rtl" ? -1 : 1);
  const slideMotion = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, x: motionSign > 0 ? 28 : -28 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: motionSign > 0 ? -28 : 28 },
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
      <div
        ref={zoomRef}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          "flex w-full justify-center gap-1",
          fit === "fit-width" ? "items-start" : "items-center",
          zoomed && (dragging ? "cursor-grabbing" : "cursor-grab"),
        )}
        style={{
          transform: zoomed
            ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
            : undefined,
          transformOrigin: "center center",
          transition: reduceMotion || dragging ? "none" : "transform 0.18s ease-out",
          touchAction: zoomed ? "none" : undefined,
        }}
      >
        {renderPages.map((pageNumber) => (
          <div
            key={pageNumber}
            className={cn(
              "flex min-w-0 justify-center",
              isSpreadView ? "flex-1" : "w-full",
            )}
          >
            <ReaderPageImage
              key={imageUrls[pageNumber - 1]}
              src={imageUrls[pageNumber - 1]}
              alt={`Page ${pageNumber}`}
              pageNumber={pageNumber}
              eager
              imageClassName={pageImageClass}
            />
          </div>
        ))}
      </div>
    </>
  );

  useEffect(() => {
    if (isEnd) onChapterEndVisible();
  }, [isEnd, onChapterEndVisible]);

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div
        className={cn(
          "flex flex-1 p-4",
          scrollable
            ? "items-start justify-center overflow-auto"
            : "items-center justify-center",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide}
            initial={slideMotion.initial}
            animate={slideMotion.animate}
            exit={slideMotion.exit}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="relative flex w-full justify-center"
          >
            {slideContent}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Click zones. Left/right map to reading order per direction. Removed
          while zoomed so drags reach the page instead of turning it. */}
      {isContent && !zoomed && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={leftZoneAction}
            className={cn(
              "absolute inset-y-0 left-0 w-1/3",
              direction === "rtl" ? "cursor-e-resize" : "cursor-w-resize",
            )}
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
            onClick={rightZoneAction}
            className={cn(
              "absolute inset-y-0 right-0 w-1/3",
              direction === "rtl" ? "cursor-w-resize" : "cursor-e-resize",
            )}
          />
        </>
      )}

      {/* Zoom indicator + reset. Fixed and independent of zen/idle-fade so it
          never disappears while a page is zoomed. */}
      {isContent && zoomed && (
        <button
          type="button"
          onClick={() => {
            onSetPan({ x: 0, y: 0 });
            onSetZoom(1);
          }}
          aria-label={`Zoom ${Math.round(zoom * 100)} percent. Reset zoom`}
          className="fixed left-1/2 top-16 z-50 flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-reader-line bg-reader-chrome px-3.5 text-sm font-semibold text-reader-foreground shadow-2xl backdrop-blur transition hover:bg-reader-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-reader-focus"
        >
          <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
          <span className="text-xs font-medium text-reader-muted">Reset</span>
        </button>
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
          {direction === "rtl" ? (
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
        <span className="text-reader-muted tabular-nums" aria-live="polite">
          {pageCounter}
        </span>
        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          aria-label={isEnd ? "Next chapter" : "Next page"}
          className="grid h-11 min-w-11 place-items-center rounded-lg px-3 hover:bg-reader-control-hover focus-visible:ring-2 focus-visible:ring-reader-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {direction === "rtl" ? (
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

function SegmentedRadioGroup<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; ariaLabel?: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-lg bg-reader-canvas/60 p-1"
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel ?? option.label}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-reader-focus disabled:cursor-not-allowed disabled:opacity-40",
              active
                ? "bg-reader-control-selected text-reader-foreground"
                : "text-reader-muted hover:bg-reader-control-hover",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ReaderSettingsPanel({
  panelRef,
  mode,
  direction,
  spread,
  spreadOffset,
  effectiveFit,
  imageQuality,
  isWideViewport,
  onChangeDirection,
  onChangeSpread,
  onToggleSpreadOffset,
  onChangeFit,
  onChangeImageQuality,
  onOpenShortcuts,
  onClose,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  mode: Mode;
  direction: Direction;
  spread: Spread;
  spreadOffset: boolean;
  effectiveFit: FitMode;
  imageQuality: ImageQuality;
  isWideViewport: boolean;
  onChangeDirection: (value: Direction) => void;
  onChangeSpread: (value: Spread) => void;
  onToggleSpreadOffset: () => void;
  onChangeFit: (value: FitMode) => void;
  onChangeImageQuality: (value: ImageQuality) => void;
  onOpenShortcuts: () => void;
  onClose: () => void;
}) {
  // Direction and spread only affect paged mode; disable (with a hint) in
  // vertical mode where they are meaningless. Offset only matters for double.
  const pagedEnabled = mode === "paged";
  const offsetEnabled = pagedEnabled && spread === "double";
  const narrowHint = spread === "double" && !isWideViewport;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Reader settings"
      className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-reader-line bg-reader-chrome p-4 text-left shadow-2xl backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-reader-foreground">
          Reader settings
        </h2>
        <button
          type="button"
          aria-label="Close reader settings"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-reader-muted transition hover:bg-reader-control-hover hover:text-reader-foreground focus-visible:ring-2 focus-visible:ring-reader-focus"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-4">
        <section>
          <p className="mb-1.5 text-xs font-medium text-reader-muted">
            Reading direction
          </p>
          <SegmentedRadioGroup<Direction>
            label="Reading direction"
            value={direction}
            disabled={!pagedEnabled}
            onChange={onChangeDirection}
            options={[
              { value: "ltr", label: "LTR", ariaLabel: "Left to right" },
              { value: "rtl", label: "RTL", ariaLabel: "Right to left" },
            ]}
          />
          {!pagedEnabled && (
            <p className="mt-1.5 text-[11px] text-reader-muted">
              Available in paged mode.
            </p>
          )}
        </section>

        <section>
          <p className="mb-1.5 text-xs font-medium text-reader-muted">
            Page layout
          </p>
          <SegmentedRadioGroup<Spread>
            label="Page layout"
            value={spread}
            disabled={!pagedEnabled}
            onChange={onChangeSpread}
            options={[
              { value: "single", label: "Single" },
              { value: "double", label: "Double" },
            ]}
          />
          <button
            type="button"
            aria-pressed={spreadOffset}
            disabled={!offsetEnabled}
            onClick={onToggleSpreadOffset}
            className={cn(
              "mt-2 flex w-full items-center justify-between rounded-lg border border-reader-line px-3 py-2 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-reader-focus disabled:cursor-not-allowed disabled:opacity-40",
              spreadOffset
                ? "bg-reader-control-selected text-reader-foreground"
                : "text-reader-muted hover:bg-reader-control-hover",
            )}
          >
            <span>Shift pairing by one</span>
            <span aria-hidden="true">{spreadOffset ? "On" : "Off"}</span>
          </button>
          {!pagedEnabled ? (
            <p className="mt-1.5 text-[11px] text-reader-muted">
              Available in paged mode.
            </p>
          ) : narrowHint ? (
            <p className="mt-1.5 text-[11px] text-reader-muted">
              Screen too narrow — showing single pages.
            </p>
          ) : null}
        </section>

        <section>
          <p className="mb-1.5 text-xs font-medium text-reader-muted">Fit</p>
          <SegmentedRadioGroup<FitMode>
            label="Fit mode"
            value={effectiveFit}
            onChange={onChangeFit}
            options={[
              { value: "fit-width", label: "Width", ariaLabel: "Fit width" },
              { value: "fit-height", label: "Height", ariaLabel: "Fit height" },
              { value: "original", label: "Original", ariaLabel: "Original size" },
            ]}
          />
        </section>

        <section>
          <p className="mb-1.5 text-xs font-medium text-reader-muted">
            Image quality
          </p>
          <SegmentedRadioGroup<ImageQuality>
            label="Image quality"
            value={imageQuality}
            onChange={onChangeImageQuality}
            options={[
              { value: "auto", label: "Auto" },
              {
                value: "saver",
                label: "Data saver",
                ariaLabel: "Data saver quality",
              },
              {
                value: "original",
                label: "Original",
                ariaLabel: "Original quality",
              },
            ]}
          />
        </section>
      </div>

      {/* Footer: keyboard-shortcuts discovery for readers without a keyboard. */}
      <div className="mt-4 border-t border-reader-line pt-3">
        <button
          type="button"
          onClick={onOpenShortcuts}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-xs font-medium text-reader-muted transition hover:bg-reader-control-hover hover:text-reader-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-reader-focus"
        >
          <Keyboard className="h-4 w-4" aria-hidden="true" />
          Keyboard shortcuts
        </button>
      </div>
    </div>
  );
}

// --- Keyboard-shortcuts overlay ----------------------------------------------
// Follows the command-palette dialog conventions: role="dialog", aria-modal,
// focus trap, Esc to close, scroll lock. Focus restore is handled by the caller
// (closeShortcuts). The listed keys are direction-aware for paged RTL.
function ReaderShortcutsOverlay({
  mode,
  direction,
  onClose,
}: {
  mode: Mode;
  direction: Direction;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const rtl = direction === "rtl";

  // Scroll lock while open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Focus the first focusable element (the close button) on open.
  useEffect(() => {
    const timer = setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    }, 20);
    return () => clearTimeout(timer);
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => element.offsetParent !== null);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const pagedGroup: ShortcutRow[] = [
    { keys: [rtl ? "←" : "→"], label: "Next page" },
    { keys: [rtl ? "→" : "←"], label: "Previous page" },
    { keys: ["+", "="], label: "Zoom in" },
    { keys: ["−", "_"], label: "Zoom out" },
    { keys: ["0"], label: "Reset zoom" },
  ];
  const verticalGroup: ShortcutRow[] = [
    { keys: ["↓", "PageDown", "J"], label: "Scroll down" },
    { keys: ["↑", "PageUp", "K"], label: "Scroll up" },
    { keys: ["Home"], label: "Jump to top" },
    { keys: ["End"], label: "Jump to bottom" },
  ];
  const generalGroup: ShortcutRow[] = [
    { keys: ["Z"], label: "Immersive mode" },
    { keys: ["?"], label: "This shortcuts list" },
    { keys: ["Esc"], label: "Close dialogs" },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[10vh] sm:pt-[15vh]"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-2xl border border-reader-line bg-reader-chrome p-5 text-reader-foreground shadow-2xl backdrop-blur",
          !reduceMotion && "yomi-rise",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="grid h-11 w-11 place-items-center rounded-lg text-reader-muted transition hover:bg-reader-control-hover hover:text-reader-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-reader-focus"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5">
          <ShortcutSection
            title={
              mode === "paged" ? "Paged mode (current)" : "Paged mode"
            }
            rows={pagedGroup}
          />
          {mode === "paged" && rtl && (
            <p className="-mt-3 text-xs text-reader-muted">
              You&rsquo;re reading right-to-left, so ← turns to the next page.
            </p>
          )}
          <ShortcutSection
            title={
              mode === "vertical" ? "Vertical mode (current)" : "Vertical mode"
            }
            rows={verticalGroup}
          />
          <ShortcutSection title="Anywhere" rows={generalGroup} />
          <p className="text-xs text-reader-muted">
            Zoom (+, −, 0, double-click, ⌘/Ctrl + scroll, drag to pan) works in
            paged mode only — vertical mode uses the Fit settings instead.
          </p>
        </div>
      </div>
    </div>
  );
}

interface ShortcutRow {
  keys: string[];
  label: string;
}

function ShortcutSection({
  title,
  rows,
}: {
  title: string;
  rows: ShortcutRow[];
}) {
  return (
    <section>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-reader-muted">
        {title}
      </p>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4">
            <span className="text-sm">{row.label}</span>
            <span className="flex flex-wrap items-center justify-end gap-1">
              {row.keys.map((key) => (
                <kbd
                  key={key}
                  className="inline-flex min-h-6 min-w-6 items-center justify-center rounded border border-reader-line bg-reader-canvas px-1.5 font-mono text-[11px] font-medium text-reader-foreground"
                >
                  {key}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
