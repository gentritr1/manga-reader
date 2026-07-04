"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { MangaCoverImage } from "@/components/manga/cover-image";
import {
  DEFAULT_SERIES_TINT,
  extractTintFromImage,
  readCachedSeriesTint,
  writeCachedSeriesTint,
} from "@/lib/extract-tint";

type SeriesTintCoverImageProps = ComponentProps<typeof MangaCoverImage> & {
  mangaId: string;
};

export function SeriesTintCoverImage({
  mangaId,
  ...props
}: SeriesTintCoverImageProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const scope = wrapper?.closest<HTMLElement>("[data-yomi-series-tint-scope]");
    if (!wrapper || !scope) return;

    const applyTint = (tint: string) => {
      scope.style.setProperty("--series-tint", tint);
    };

    const cached = readCachedSeriesTint(mangaId);
    if (cached) {
      applyTint(cached);
      return;
    }

    applyTint(DEFAULT_SERIES_TINT);

    let cancelled = false;
    let sampled = false;
    let frame = 0;
    const timeouts: Array<ReturnType<typeof setTimeout>> = [];
    const sample = () => {
      if (cancelled || sampled) return;

      const image = wrapper.querySelector<HTMLImageElement>(
        'img[data-yomi-tint-cover="true"]',
      );
      if (!image) return;

      const tint = extractTintFromImage(image);
      if (!tint) return;

      sampled = true;
      writeCachedSeriesTint(mangaId, tint);
      applyTint(tint);
    };

    wrapper.addEventListener("load", sample, true);
    frame = requestAnimationFrame(sample);
    timeouts.push(setTimeout(sample, 250));
    timeouts.push(setTimeout(sample, 1000));

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      timeouts.forEach(clearTimeout);
      wrapper.removeEventListener("load", sample, true);
    };
  }, [mangaId]);

  return (
    <span ref={wrapperRef} className="absolute inset-0">
      <MangaCoverImage {...props} data-yomi-tint-cover="true" />
    </span>
  );
}
