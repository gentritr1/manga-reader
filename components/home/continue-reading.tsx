"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Play } from "lucide-react";
import { Section } from "@/components/manga/section";

interface HistoryItem {
  mangaId: string;
  chapterId: string;
  title: string;
  coverUrl: string | null;
  chapter: string | null;
}

export function ContinueReading() {
  const { status } = useSession();
  const { data = [] } = useQuery({
    queryKey: ["history"],
    enabled: status === "authenticated",
    queryFn: async (): Promise<HistoryItem[]> => {
      const res = await fetch("/api/history");
      if (!res.ok) return [];
      return (await res.json()).history as HistoryItem[];
    },
  });

  if (status !== "authenticated" || data.length === 0) return null;

  return (
    <Section title="Continue reading">
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
        {data.map((item) => (
          <Link
            key={item.mangaId}
            href={`/read/${item.chapterId}`}
            className="group relative flex w-64 shrink-0 gap-3 overflow-hidden rounded-xl border border-border bg-card p-3"
          >
            <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-md bg-muted">
              {item.coverUrl && (
                <Image src={item.coverUrl} alt="" fill sizes="56px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
              {item.chapter && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Chapter {item.chapter}
                </p>
              )}
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent">
                <Play className="h-3 w-3 fill-current" /> Resume
              </span>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}
