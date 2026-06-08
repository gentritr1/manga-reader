"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { searchMangaClient } from "@/lib/mangadex-client";
import {
  GENRE_TAGS,
  type MangaStatus,
  type SortOption,
} from "@/lib/mangadex";
import { MangaCard } from "@/components/manga/manga-card";
import { MangaGridSkeleton } from "@/components/manga/manga-grid";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;
const SORTS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Best match" },
  { value: "popular", label: "Most popular" },
  { value: "latest", label: "Latest updates" },
  { value: "rating", label: "Top rated" },
  { value: "title", label: "Title A–Z" },
];
const STATUSES: { value: MangaStatus | ""; label: string }[] = [
  { value: "", label: "Any status" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "hiatus", label: "Hiatus" },
  { value: "cancelled", label: "Cancelled" },
];

function useDebounced<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function BrowseClient() {
  const params = useSearchParams();
  const router = useRouter();

  const [title, setTitle] = useState(params.get("q") ?? "");
  const [sort, setSort] = useState<SortOption>(
    (params.get("sort") as SortOption) || "relevance",
  );
  const [status, setStatus] = useState<MangaStatus | "">(
    (params.get("status") as MangaStatus) || "",
  );
  const [genres, setGenres] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const debouncedTitle = useDebounced(title);

  // Keep the URL in sync for shareable searches.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (debouncedTitle) sp.set("q", debouncedTitle);
    if (sort !== "relevance") sp.set("sort", sort);
    if (status) sp.set("status", status);
    const qs = sp.toString();
    router.replace(qs ? `/browse?${qs}` : "/browse", { scroll: false });
  }, [debouncedTitle, sort, status, router]);

  const query = useInfiniteQuery({
    queryKey: ["browse", debouncedTitle, sort, status, genres],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      searchMangaClient({
        title: debouncedTitle || undefined,
        sort,
        status: status || undefined,
        genres,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, all) => {
      const loaded = all.reduce((n, p) => n + p.manga.length, 0);
      return loaded < lastPage.total && lastPage.manga.length === PAGE_SIZE
        ? loaded
        : undefined;
    },
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.manga) ?? [],
    [query.data],
  );
  const total = query.data?.pages[0]?.total ?? 0;

  // Infinite scroll sentinel.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query]);

  const toggleGenre = (id: string) =>
    setGenres((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Search by title…"
              className="h-11 pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setShowFilters((s) => !s)}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </Button>
        </div>

        {showFilters && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MangaStatus | "")}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(GENRE_TAGS).map(([name, id]) => (
                <button
                  key={id}
                  onClick={() => toggleGenre(id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    genres.includes(id)
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {query.isLoading ? (
        <MangaGridSkeleton count={18} />
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          No manga found. Try a different search or filters.
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {total.toLocaleString()} result{total === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((m) => (
              <MangaCard key={m.id} manga={m} />
            ))}
          </div>
          <div ref={sentinel} className="h-12" />
          {query.isFetchingNextPage && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Loading more…
            </p>
          )}
        </>
      )}
    </div>
  );
}
