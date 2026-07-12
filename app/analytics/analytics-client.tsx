"use client";

import { useRef } from "react";
import { Download, TrendingUp, BookOpen, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { YomiMark } from "@/components/brand/yomi-mark";
import { SITE_HOST, SITE_NAME } from "@/lib/site";
import { useReadingRhythm } from "@/lib/use-reading-rhythm";
import { useLocalWeekStats } from "@/lib/use-local-week-stats";
import { formatWeekLine } from "@/lib/local-reading-stats";
import {
  SHARE_CARD_BACKGROUND_IMAGE,
  SHARE_CARD_COLORS,
  SHARE_CARD_SHELF_EDGE,
} from "@/lib/share-card-theme";

interface Props {
  totalPages: number;
  formattedTime: string;
  averageSpeed: string;
  topManga: { title: string; pages: number }[];
  name: string;
}

const C = SHARE_CARD_COLORS;

export function AnalyticsClient({
  totalPages,
  formattedTime,
  averageSpeed,
  topManga,
  name,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rhythmQuery = useReadingRhythm();
  const rhythm = rhythmQuery.data;
  const weekStats = useLocalWeekStats();
  const weekLine = formatWeekLine(weekStats);

  const handleExport = async () => {
    if (!cardRef.current) return;
    try {
      // html-to-image is only needed on this explicit export action, so load it
      // on demand to keep it out of the route's initial JS bundle.
      const { toPng } = await import("html-to-image");
      if ("fonts" in document) {
        await document.fonts.ready.catch(() => undefined);
      }
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: C.canvas,
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `yomi-chapter-pulse-${name.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to export image:", error);
    }
  };

  return (
    <div className="space-y-8">
      <div
        ref={cardRef}
        className="relative max-w-2xl overflow-hidden rounded-card p-6 sm:p-8"
        style={{
          backgroundColor: C.canvas,
          backgroundImage: SHARE_CARD_BACKGROUND_IMAGE,
          color: C.inverse,
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ backgroundImage: SHARE_CARD_SHELF_EDGE }}
        />

        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h2
              className="font-display text-3xl font-extrabold tracking-tight"
              style={{ color: C.inverse }}
            >
              Chapter Pulse
            </h2>
            <p
              className="mt-1 text-xs font-semibold uppercase tracking-wider"
              style={{ color: C.inverseMuted }}
            >
              {`${name}'s reading recap`}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <YomiMark className="h-9 w-9" />
            <span
              className="font-display text-lg font-extrabold"
              style={{ color: C.inverse }}
            >
              {SITE_NAME}
            </span>
          </div>
        </div>

        {weekLine && (
          <div
            className="mb-8 flex items-center gap-3 rounded-card px-4 py-3"
            style={{
              backgroundColor: C.violetTint16,
              border: `1px solid ${C.lineInverse}`,
            }}
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: C.violet }}
            />
            <span
              className="font-display text-sm font-extrabold"
              style={{ color: C.inverse }}
            >
              My week
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: C.inverseMuted }}
            >
              {weekLine}
            </span>
          </div>
        )}

        <div className="mb-10 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div
              className="flex items-center gap-2"
              style={{ color: C.inverseMuted }}
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Pages read
              </span>
            </div>
            <p
              className="font-display text-4xl font-extrabold"
              style={{ color: C.inverse }}
            >
              {totalPages.toLocaleString()}
            </p>
          </div>

          <div className="space-y-2">
            <div
              className="flex items-center gap-2"
              style={{ color: C.inverseMuted }}
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Time spent
              </span>
            </div>
            <p
              className="font-display text-4xl font-extrabold"
              style={{ color: C.inverse }}
            >
              {formattedTime}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div
            className="flex items-center gap-2 pb-4"
            style={{
              color: C.inverseMuted,
              borderBottom: `1px solid ${C.lineInverse}`,
            }}
          >
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Top series
            </span>
          </div>

          {topManga.length === 0 ? (
            <p className="text-sm font-medium" style={{ color: C.inverseMuted }}>
              Start reading to build your recap.
            </p>
          ) : (
            <div className="space-y-4">
              {topManga.map((manga, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <span
                      className="font-display w-6 shrink-0 text-xl font-extrabold"
                      style={{ color: C.inverseMuted }}
                    >
                      {i + 1}
                    </span>
                    <span
                      className="max-w-[180px] truncate text-base font-bold sm:max-w-[300px]"
                      style={{ color: C.inverse }}
                    >
                      {manga.title}
                    </span>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
                    style={{
                      color: C.inverseMuted,
                      border: `1px solid ${C.lineInverse}`,
                    }}
                  >
                    {manga.pages} pages
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="mt-10 flex items-center justify-between gap-4 pt-5"
          style={{
            color: C.inverseMuted,
            borderTop: `1px solid ${C.lineInverse}`,
          }}
        >
          <span className="text-xs font-bold tracking-wide">{SITE_HOST}</span>
          <span className="text-xs font-bold tracking-wide">
            {rhythm && rhythm.rhythmDays > 0
              ? `${rhythm.rhythmDays}-night rhythm`
              : `${averageSpeed}s / page average`}
          </span>
        </div>
      </div>

      <Button
        onClick={handleExport}
        size="lg"
        disabled={rhythmQuery.isLoading}
        className="h-12 px-8 font-bold"
      >
        <Download className="mr-2 h-5 w-5" aria-hidden="true" />
        Export recap
      </Button>
    </div>
  );
}
