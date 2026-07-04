"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type SimpleManga } from "@/lib/mangadex";
import { MangaCard } from "./manga-card";
import { cn } from "@/lib/utils";

function CarouselArrow({
  dir,
  show,
  railId,
  onScroll,
}: {
  dir: 1 | -1;
  show: boolean;
  railId: string;
  onScroll: (dir: 1 | -1) => void;
}) {
  return (
    <button
      aria-label={dir === -1 ? "Scroll left" : "Scroll right"}
      aria-controls={railId}
      onClick={() => onScroll(dir)}
      className={cn(
        "absolute top-[34%] z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-line-subtle bg-surface-canvas/90 [box-shadow:var(--elevation-panel)] backdrop-blur transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus sm:grid",
        dir === -1 ? "left-2" : "right-2",
        show ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {dir === -1 ? (
        <ChevronLeft className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </button>
  );
}

export function MangaCarousel({
  manga,
  ariaLabel = "Manga carousel",
}: {
  manga: SimpleManga[];
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const railId = useId();
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollBy({
      left: dir * el.clientWidth * 0.85,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className="relative overflow-hidden">
      <CarouselArrow
        dir={-1}
        show={canPrev}
        railId={railId}
        onScroll={scroll}
      />
      <CarouselArrow
        dir={1}
        show={canNext}
        railId={railId}
        onScroll={scroll}
      />
      <div
        id={railId}
        ref={ref}
        role="region"
        tabIndex={0}
        className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth rounded-lg pb-2 focus-visible:ring-2 focus-visible:ring-focus"
        aria-label={ariaLabel}
      >
        {manga.map((m) => (
          <div key={m.id} className="w-36 shrink-0 sm:w-44">
            <MangaCard manga={m} />
          </div>
        ))}
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface-canvas to-transparent sm:hidden"
        aria-hidden="true"
      />
    </div>
  );
}
