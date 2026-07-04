"use client";

import { useRef } from "react";
import { toPng } from "html-to-image";
import { Download, TrendingUp, BookOpen, Clock, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReadingRhythm } from "@/lib/use-reading-rhythm";

interface Props {
  totalPages: number;
  formattedTime: string;
  averageSpeed: string;
  topManga: { title: string; pages: number }[];
  name: string;
}

export function AnalyticsClient({ totalPages, formattedTime, averageSpeed, topManga, name }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rhythmQuery = useReadingRhythm();
  const rhythm = rhythmQuery.data;

  const handleExport = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#15131d",
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
        className="relative max-w-2xl overflow-hidden rounded-card border border-line-shelf bg-surface-shelf p-6 shadow-[var(--elevation-shelf)] sm:p-8"
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-content-primary">Chapter Pulse</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-content-secondary">{`${name}'s reading recap`}</p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-control border border-library-line bg-library-surface text-library-foreground">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        {rhythm && rhythm.rhythmDays > 0 && (
          <div className="mb-10 flex items-center justify-between gap-4 rounded-card border border-library-line bg-library-surface px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                className="h-2.5 w-2.5 rounded-full bg-library shadow-[0_0_14px_var(--library)]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-black text-content-primary">
                  {rhythm.rhythmDays}-day rhythm
                </p>
                <p className="text-xs font-semibold text-content-secondary">
                  {rhythm.readToday ? "Read today" : "Ready for today's chapter"}
                </p>
              </div>
            </div>
            <span className="rounded-full border border-discovery-line bg-discovery-surface px-3 py-1 text-xs font-bold text-discovery-foreground">
              Chapter Pulse
            </span>
          </div>
        )}

        <div className="mb-10 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-content-secondary">
              <BookOpen className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Pages read</span>
            </div>
            <p className="text-3xl font-black text-content-primary sm:text-4xl">{totalPages.toLocaleString()}</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-content-secondary">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Time spent</span>
            </div>
            <p className="text-3xl font-black text-content-primary sm:text-4xl">{formattedTime}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2 text-content-secondary border-b border-line-subtle pb-4">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Top series</span>
          </div>
          
          {topManga.length === 0 ? (
            <p className="text-sm font-medium text-content-secondary">Start reading to build your recap.</p>
          ) : (
            <div className="space-y-4">
              {topManga.map((manga, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="w-6 text-xl font-black text-content-secondary/50">{i + 1}</span>
                    <span className="max-w-[180px] truncate text-base font-bold text-content-primary sm:max-w-[300px]">{manga.title}</span>
                  </div>
                  <span className="rounded-full border border-line-subtle bg-surface-canvas px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-content-secondary">
                    {manga.pages} pages
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 flex items-center justify-between gap-4 border-t border-line-subtle pt-5 text-content-secondary">
          <span className="text-[10px] font-black uppercase tracking-[0.18em]">yomireader.com</span>
          <span className="text-xs font-bold tracking-wide">{averageSpeed}s / page average</span>
        </div>
      </div>

      <Button
        onClick={handleExport}
        size="lg"
        disabled={rhythmQuery.isLoading}
        className="h-12 px-8 font-bold"
      >
        <Download className="h-5 w-5 mr-2" />
        Export recap
      </Button>
    </div>
  );
}
