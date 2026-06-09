"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { BookOpen, Clock3, History, LogIn, Play } from "lucide-react";
import { Section } from "@/components/manga/section";
import { buttonClassName } from "@/components/ui/button";

interface HistoryItem {
  mangaId: string;
  chapterId: string;
  title: string;
  coverUrl: string | null;
  chapter: string | null;
}

export function ContinueReading() {
  const { status } = useSession();
  const { data = [], isLoading } = useQuery({
    queryKey: ["history"],
    enabled: status === "authenticated",
    queryFn: async (): Promise<HistoryItem[]> => {
      const res = await fetch("/api/history");
      if (!res.ok) return [];
      return (await res.json()).history as HistoryItem[];
    },
  });

  if (status === "loading" || (status === "authenticated" && isLoading)) {
    return (
      <Section
        title="Your next chapter"
        description="Recent reads stay ready for the next commute, break, or late-night page turn."
      >
        <div className="flex gap-4 overflow-hidden pb-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-28 w-64 shrink-0 rounded-xl border border-border bg-card skeleton"
            />
          ))}
        </div>
      </Section>
    );
  }

  if (status !== "authenticated" || data.length === 0) {
    return <EmptyContinueReading authenticated={status === "authenticated"} />;
  }

  return (
    <Section
      title="Your next chapter"
      description="Recent reads stay ready for the next commute, break, or late-night page turn."
    >
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {data.map((item) => (
            <Link
              key={item.mangaId}
              href={`/read/${item.chapterId}`}
              className="group relative flex min-h-28 w-64 shrink-0 gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:border-accent/45 hover:shadow-lg hover:shadow-accent/10 focus-visible:border-accent"
            >
              <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {item.coverUrl && (
                  <Image
                    src={item.coverUrl}
                    alt={`${item.title} cover`}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
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
                  <Play className="h-3 w-3 fill-current" /> Resume chapter
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent sm:hidden"
          aria-hidden="true"
        />
      </div>
    </Section>
  );
}

function EmptyContinueReading({ authenticated }: { authenticated: boolean }) {
  return (
    <Section
      title="Your next chapter"
      description="Build a small return shelf as you read. Yomi keeps the next chapter easy to find without slowing discovery down."
    >
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-accent-cool to-accent-warm" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-3 sm:grid-cols-3">
            <ReturnStep
              icon={BookOpen}
              title="Open a chapter"
              copy="Start from a spotlight pick, a fresh update, or a search result."
            />
            <ReturnStep
              icon={History}
              title="Keep your place"
              copy="Save your place and Yomi brings the next page back to the surface."
            />
            <ReturnStep
              icon={Clock3}
              title="Return daily"
              copy="The shelf becomes a quick scan of what is worth resuming."
            />
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link
              href="/browse?sort=latest"
              className={buttonClassName({
                className: "bg-accent-warm text-spotlight hover:opacity-95",
              })}
            >
              Browse new chapters
            </Link>
            {!authenticated && (
              <Link
                href="/login"
                className={buttonClassName({ variant: "outline" })}
              >
                <LogIn className="h-4 w-4" /> Log in to sync
              </Link>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}

function ReturnStep({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof BookOpen;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-muted text-accent">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">
          {copy}
        </span>
      </span>
    </div>
  );
}
