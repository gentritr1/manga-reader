"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Rows3,
} from "lucide-react";
import { InternalAdPreview } from "@/components/ads/internal-ad-preview";
import { cn } from "@/lib/utils";

type Mode = "vertical" | "paged";
const MAX_IMAGE_RETRIES = 3;

interface ReaderSessionState {
  startedAt: number;
  mode: Mode;
  pagesSeen: Set<number>;
  maxPagedPage: number;
  flushed: boolean;
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
}

export function Reader(props: Props) {
  return <ReaderContent key={props.chapterId} {...props} />;
}

function ReaderContent(props: Props) {
  const { imageUrls, prevId, nextId, mangaId } = props;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("vertical");
  const [zenMode, setZenMode] = useState(false);
  const toggleZenMode = useCallback(() => setZenMode((z) => !z), []);
  // Paged slides: 0 = intro, 1..N = pages, N+1 = end.
  const [slide, setSlide] = useState(0);
  const total = imageUrls.length;
  const lastSlide = total + 1;

  const sessionRef = useRef<ReaderSessionState>({
    startedAt: 0,
    mode: "vertical",
    pagesSeen: new Set<number>(),
    maxPagedPage: 0,
    flushed: true,
  });

  useEffect(() => {
    sessionRef.current = {
      startedAt: Date.now(),
      mode: sessionRef.current.mode,
      pagesSeen: new Set<number>(),
      maxPagedPage: 0,
      flushed: false,
    };
  }, [props.chapterId]);

  useEffect(() => {
    sessionRef.current.mode = mode;
  }, [mode]);

  useEffect(() => {
    if (mode !== "paged") return;
    const page = slide > total ? total : slide;
    if (page > 0 && page > sessionRef.current.maxPagedPage) {
      sessionRef.current.maxPagedPage = page;
    }
  }, [mode, slide, total]);

  const markVerticalPageVisible = useCallback(
    (pageNumber: number) => {
      if (pageNumber < 1 || pageNumber > total) return;
      sessionRef.current.pagesSeen.add(pageNumber);
    },
    [total],
  );

  const flushReadingSession = useCallback(() => {
    const readingSession = sessionRef.current;
    if (!mangaId || readingSession.flushed || readingSession.startedAt === 0) return;

    const durationSeconds = Math.round((Date.now() - readingSession.startedAt) / 1000);
    if (durationSeconds < 3) return;

    const pagesRead = Math.max(
      Math.min(readingSession.maxPagedPage, total),
      Math.min(readingSession.pagesSeen.size, total),
    );

    if (pagesRead <= 0) return;

    readingSession.flushed = true;

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        mangaId,
        mangaTitle: props.mangaTitle,
        chapterId: props.chapterId,
        pagesRead,
        durationSeconds,
      }),
    }).catch(() => {});
  }, [mangaId, props.mangaTitle, props.chapterId, total]);

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
    if (!shouldPreloadNext || !nextId) return;
    [1, 2, 3, 4, 5].forEach((pageNumber) => {
      const img = new Image();
      img.src = `/chapter-page/${nextId}/${pageNumber}`;
    });
  }, [shouldPreloadNext, nextId]);

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
    if (!mangaId) return;
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mangaId,
        chapterId: props.chapterId,
        title: props.mangaTitle,
        coverUrl: props.coverUrl ?? undefined,
        chapter: props.chapterLabel.replace(/^Chapter\s*/i, "") || undefined,
      }),
    }).catch(() => {});
  }, [mangaId, props.chapterId, props.mangaTitle, props.coverUrl, props.chapterLabel]);

  const goNextChapter = useCallback(() => {
    if (nextId) router.push(`/read/${nextId}`);
  }, [nextId, router]);
  const goPrevChapter = useCallback(() => {
    if (prevId) router.push(`/read/${prevId}`);
  }, [prevId, router]);

  // Paged navigation + keyboard.
  const next = useCallback(() => {
    setSlide((s) => {
      if (s < lastSlide) return s + 1;
      goNextChapter();
      return s;
    });
  }, [lastSlide, goNextChapter]);
  const prev = useCallback(() => {
    setSlide((s) => {
      if (s > 0) return s - 1;
      goPrevChapter();
      return s;
    });
  }, [goPrevChapter]);

  useEffect(() => {
    if (mode !== "paged") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, next, prev]);

  // Preload neighbour image in paged mode.
  useEffect(() => {
    if (mode !== "paged") return;
    const i = slide; // current page index in 1..N maps to imageUrls[slide-1]
    [i, i + 1].forEach((p) => {
      if (p >= 1 && p <= total) {
        const img = new Image();
        img.src = imageUrls[p - 1];
      }
    });
  }, [slide, mode, imageUrls, total]);

  const backHref = mangaId ? `/manga/${mangaId}` : "/";

  return (
    <div className="min-h-screen bg-reader-canvas text-reader-foreground relative overflow-hidden">
      <h1 className="sr-only">
        {props.mangaTitle} {props.chapterLabel}
        {props.chapterTitle ? `: ${props.chapterTitle}` : ""}
      </h1>
      {/* Top bar */}
      <header className={cn("sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-reader-line bg-reader-chrome px-4 backdrop-blur transition-all duration-300", zenMode && "-translate-y-full opacity-0 pointer-events-none")}>
        <Link
          href={backHref}
          aria-label={`Back to ${props.mangaTitle}`}
          className="flex min-h-11 items-center gap-2 rounded-lg text-sm hover:text-reader-muted focus-visible:ring-reader-focus"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-medium">{props.mangaTitle}</p>
          <p className="truncate text-xs text-reader-muted">
            {props.chapterLabel}
            {props.chapterTitle ? `: ${props.chapterTitle}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => changeMode("vertical")}
            aria-label="Vertical mode"
            aria-pressed={mode === "vertical"}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-lg transition hover:bg-reader-control-hover focus-visible:ring-reader-focus",
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
              "grid h-11 w-11 place-items-center rounded-lg transition hover:bg-reader-control-hover focus-visible:ring-reader-focus",
              mode === "paged" && "bg-reader-control-selected",
            )}
          >
            <Columns2 className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {mode === "vertical" ? (
        <VerticalReader
          {...props}
          toggleZenMode={toggleZenMode}
          onPageVisible={markVerticalPageVisible}
        />
      ) : (
        <PagedReader
          {...props}
          slide={slide}
          total={total}
          lastSlide={lastSlide}
          onNext={next}
          onPrev={prev}
          zenMode={zenMode}
          toggleZenMode={toggleZenMode}
        />
      )}
    </div>
  );
}

function ChapterNav({ prevId, nextId }: { prevId: string | null; nextId: string | null }) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center gap-6 text-sm font-medium">
      <button
        type="button"
        disabled={!prevId}
        onClick={() => prevId && router.push(`/read/${prevId}`)}
        className="flex items-center gap-1.5 text-reader-muted transition hover:text-reader-foreground disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
      </button>
      <button
        type="button"
        disabled={!nextId}
        onClick={() => nextId && router.push(`/read/${nextId}`)}
        className="flex items-center gap-1.5 text-reader-muted transition hover:text-reader-foreground disabled:pointer-events-none disabled:opacity-30"
      >
        Next chapter <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function VerticalReader(
  props: Props & {
    toggleZenMode: () => void;
    onPageVisible: (pageNumber: number) => void;
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
          />
        ))}
      </div>

      <div className="space-y-8 px-4 py-10">
        <p className="text-center text-sm text-reader-muted">End of {props.chapterLabel}</p>
        <ChapterNav prevId={props.prevId} nextId={props.nextId} />
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
}: {
  src: string;
  alt: string;
  pageNumber: number;
  eager: boolean;
  onVisible: (pageNumber: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);
  const canRetry = retry < MAX_IMAGE_RETRIES;

  useEffect(() => {
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
    setRetry((current) => Math.min(current + 1, MAX_IMAGE_RETRIES));
  };
  const imageSrc =
    retry > 0 ? `${src}${src.includes("?") ? "&" : "?"}readerRetry=${retry}` : src;

  return (
    <div ref={pageRef} className="relative w-full overflow-hidden bg-reader-canvas">
      <img
        key={retry}
        src={imageSrc}
        alt={alt}
        width={1440}
        height={2048}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setFailed(false)}
        onError={() => setFailed(true)}
        className="h-auto w-full"
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
              className="rounded-lg border border-reader-line px-3 py-2 transition hover:bg-reader-control-hover focus-visible:ring-reader-focus"
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
  total,
  lastSlide,
  onNext,
  onPrev,
  prevId,
  nextId,
  chapterLabel,
  chapterTitle,
  zenMode,
  toggleZenMode,
  recap,
}: Props & {
  slide: number;
  total: number;
  lastSlide: number;
  onNext: () => void;
  onPrev: () => void;
  zenMode: boolean;
  toggleZenMode: () => void;
}) {
  const isIntro = slide === 0;
  const isEnd = slide === lastSlide;
  const prevDisabled = isIntro && !prevId;
  const nextDisabled = isEnd && !nextId;

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex flex-1 items-center justify-center p-4">
        {isIntro ? (
          <div className="w-full max-w-xl space-y-6 text-center">
            {recap && (
              <div className="rounded-2xl border border-reader-line bg-reader-chrome/50 p-6 backdrop-blur shadow-2xl mb-8 animate-in fade-in slide-in-from-bottom-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-reader-muted mb-2">The Story So Far</p>
                <p className="text-sm leading-relaxed">{recap}</p>
              </div>
            )}
            <h2 className="text-lg font-semibold">{chapterLabel}</h2>
            {chapterTitle && (
              <p className="text-sm text-reader-muted">{chapterTitle}</p>
            )}
            <button
              type="button"
              onClick={onNext}
              aria-label="Start reading"
              className="inline-flex items-center gap-1 text-sm font-medium text-reader-muted transition hover:text-reader-foreground"
            >
              Start reading <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : isEnd ? (
          <div className="w-full max-w-xl space-y-8 text-center">
            <p className="text-sm text-reader-muted">End of {chapterLabel}</p>
            <ChapterNav prevId={prevId} nextId={nextId} />
            <InternalAdPreview placement="reader" />
          </div>
        ) : (
          <>
            {/* Dynamic Ambiance Glow */}
            <div className="absolute inset-0 -z-10 overflow-hidden bg-reader-canvas pointer-events-none transition-opacity duration-700" style={{ opacity: zenMode ? 1 : 0.3 }}>
              <img
                src={imageUrls[slide - 1]}
                alt=""
                className="h-full w-full object-cover blur-[80px]"
              />
            </div>
            <img
              src={imageUrls[slide - 1]}
              alt={`Page ${slide}`}
              width={1440}
              height={2048}
              decoding="async"
              referrerPolicy="no-referrer"
              className={cn("w-auto max-w-full object-contain drop-shadow-2xl transition-all duration-300", zenMode ? "max-h-screen" : "max-h-[calc(100vh-7rem)]")}
            />
          </>
        )}
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
          className="grid h-11 min-w-11 place-items-center rounded-lg px-3 hover:bg-reader-control-hover focus-visible:ring-reader-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
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
          className="grid h-11 min-w-11 place-items-center rounded-lg px-3 hover:bg-reader-control-hover focus-visible:ring-reader-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
