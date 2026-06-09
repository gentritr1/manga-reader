"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type SimpleManga } from "@/lib/mangadex";
import { MangaCard } from "./manga-card";
import { cn } from "@/lib/utils";

export function MangaCarousel({ manga }: { manga: SimpleManga[] }) {
  const ref = useRef<HTMLDivElement>(null);
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
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const Arrow = ({ dir, show }: { dir: 1 | -1; show: boolean }) => (
    <button
      aria-label={dir === -1 ? "Scroll left" : "Scroll right"}
      onClick={() => scroll(dir)}
      className={cn(
        "absolute top-[34%] z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/90 shadow-lg backdrop-blur transition hover:bg-muted sm:grid",
        dir === -1 ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2",
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

  return (
    <div className="relative">
      <Arrow dir={-1} show={canPrev} />
      <Arrow dir={1} show={canNext} />
      <div
        ref={ref}
        className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth pb-2"
      >
        {manga.map((m) => (
          <div key={m.id} className="w-36 shrink-0 sm:w-44">
            <MangaCard manga={m} />
          </div>
        ))}
      </div>
    </div>
  );
}
