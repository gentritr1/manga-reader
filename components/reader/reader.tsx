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
import { Button } from "@/components/ui/button";
import { AdSlot } from "@/components/ads/ad-slot";
import { cn } from "@/lib/utils";

type Mode = "vertical" | "paged";

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
}

export function Reader(props: Props) {
  const { imageUrls, prevId, nextId, mangaId } = props;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("vertical");
  // Paged slides: 0 = intro, 1..N = pages, N+1 = end.
  const [slide, setSlide] = useState(0);
  const total = imageUrls.length;
  const lastSlide = total + 1;

  // Restore preferred mode.
  useEffect(() => {
    const saved = localStorage.getItem("reader-mode") as Mode | null;
    if (saved) setMode(saved);
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

  // Reset to intro when chapter changes.
  useEffect(() => setSlide(0), [props.chapterId]);

  const backHref = mangaId ? `/manga/${mangaId}` : "/";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-black/80 px-4 backdrop-blur">
        <Link href={backHref} className="flex items-center gap-2 text-sm hover:text-white/80">
          <ArrowLeft className="h-5 w-5" />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-medium">{props.mangaTitle}</p>
          <p className="truncate text-xs text-white/60">
            {props.chapterLabel}
            {props.chapterTitle ? ` — ${props.chapterTitle}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => changeMode("vertical")}
            aria-label="Vertical mode"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10",
              mode === "vertical" && "bg-white/15",
            )}
          >
            <Rows3 className="h-5 w-5" />
          </button>
          <button
            onClick={() => changeMode("paged")}
            aria-label="Paged mode"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10",
              mode === "paged" && "bg-white/15",
            )}
          >
            <Columns2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      {mode === "vertical" ? (
        <VerticalReader {...props} />
      ) : (
        <PagedReader
          {...props}
          slide={slide}
          total={total}
          lastSlide={lastSlide}
          onNext={next}
          onPrev={prev}
        />
      )}
    </div>
  );
}

function ChapterNav({
  prevId,
  nextId,
  variant,
}: {
  prevId: string | null;
  nextId: string | null;
  variant: "light" | "dark";
}) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant={variant === "dark" ? "outline" : "secondary"}
        disabled={!prevId}
        onClick={() => prevId && router.push(`/read/${prevId}`)}
      >
        <ChevronLeft className="h-4 w-4" /> Previous
      </Button>
      <Button disabled={!nextId} onClick={() => nextId && router.push(`/read/${nextId}`)}>
        Next chapter <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function VerticalReader(props: Props) {
  return (
    <div className="mx-auto max-w-3xl">
      {/* Intro / chapter-start ad */}
      <div className="px-4 py-8">
        <AdSlot placement="chapter-start" className="mx-auto max-w-xl" />
      </div>

      <div className="flex flex-col items-center">
        {props.imageUrls.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Page ${i + 1}`}
            loading={i < 2 ? "eager" : "lazy"}
            className="w-full"
          />
        ))}
      </div>

      {/* End / chapter-end ad + nav */}
      <div className="space-y-6 px-4 py-10">
        <p className="text-center text-sm text-white/60">End of {props.chapterLabel}</p>
        <ChapterNav prevId={props.prevId} nextId={props.nextId} variant="dark" />
        <AdSlot placement="chapter-end" className="mx-auto max-w-xl" />
      </div>
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
}: Props & {
  slide: number;
  total: number;
  lastSlide: number;
  onNext: () => void;
  onPrev: () => void;
}) {
  const isIntro = slide === 0;
  const isEnd = slide === lastSlide;

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex flex-1 items-center justify-center p-4">
        {isIntro ? (
          <div className="w-full max-w-xl space-y-6 text-center">
            <h2 className="text-lg font-semibold">{chapterLabel}</h2>
            <AdSlot placement="chapter-start" />
            <Button size="lg" onClick={onNext}>
              Start reading <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : isEnd ? (
          <div className="w-full max-w-xl space-y-6 text-center">
            <p className="text-sm text-white/60">End of {chapterLabel}</p>
            <ChapterNav prevId={prevId} nextId={nextId} variant="dark" />
            <AdSlot placement="chapter-end" />
          </div>
        ) : (
          <img
            src={imageUrls[slide - 1]}
            alt={`Page ${slide}`}
            className="max-h-[calc(100vh-7rem)] w-auto max-w-full object-contain"
          />
        )}
      </div>

      {/* Click zones */}
      {!isIntro && !isEnd && (
        <>
          <button
            aria-label="Previous page"
            onClick={onPrev}
            className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize"
          />
          <button
            aria-label="Next page"
            onClick={onNext}
            className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize"
          />
        </>
      )}

      {/* Footer controls */}
      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-white/10 bg-black/80 px-4 py-2 text-sm backdrop-blur">
        <button onClick={onPrev} className="rounded-lg px-3 py-1 hover:bg-white/10">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-white/70">
          {isIntro ? "Start" : isEnd ? "End" : `${slide} / ${total}`}
        </span>
        <button onClick={onNext} className="rounded-lg px-3 py-1 hover:bg-white/10">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
