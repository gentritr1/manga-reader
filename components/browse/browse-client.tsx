"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import {
  MANGA_SEARCH_GC_TIME_MS,
  MANGA_SEARCH_STALE_TIME_MS,
  searchMangaClient,
} from "@/lib/mangadex-client";
import {
  TAG_GROUPS,
  type MangaStatus,
  type SortOption,
} from "@/lib/mangadex";
import { MangaCard } from "@/components/manga/manga-card";
import { MangaGridSkeleton } from "@/components/manga/manga-grid";
import { InternalAdPreview } from "@/components/ads/internal-ad-preview";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;
const LATEST_BROWSE_STALE_TIME_MS = 2 * 60 * 1000;
const SORTS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Best match" },
  { value: "popular", label: "Most popular" },
  { value: "latest", label: "Latest updates" },
  { value: "rating", label: "Top rated" },
  { value: "title", label: "Title A-Z" },
];
const STATUSES: { value: MangaStatus | ""; label: string }[] = [
  { value: "", label: "Any status" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "hiatus", label: "Hiatus" },
  { value: "cancelled", label: "Cancelled" },
];

function shouldShowInternalPreview(index: number) {
  return index === 12;
}

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
  const searchId = useId();
  const filtersId = useId();

  const [title, setTitle] = useState(params.get("q") ?? "");
  const [sort, setSort] = useState<SortOption>(
    (params.get("sort") as SortOption) ||
      // Default to newest-updated when just browsing; "best match" only when searching.
      (params.get("q") ? "relevance" : "latest"),
  );
  const [status, setStatus] = useState<MangaStatus | "">(
    (params.get("status") as MangaStatus) || "",
  );
  const [genres, setGenres] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const debouncedTitle = useDebounced(title);
  const browseStaleTime =
    sort === "latest" && !debouncedTitle && !status && genres.length === 0
      ? LATEST_BROWSE_STALE_TIME_MS
      : MANGA_SEARCH_STALE_TIME_MS;

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
    queryFn: ({ pageParam, signal }) =>
      searchMangaClient({
        title: debouncedTitle || undefined,
        sort,
        status: status || undefined,
        genres,
        limit: PAGE_SIZE,
        offset: pageParam,
      }, signal),
    getNextPageParam: (lastPage, all) => {
      const loaded = all.reduce((n, p) => n + p.manga.length, 0);
      return loaded < lastPage.total && lastPage.manga.length === PAGE_SIZE
        ? loaded
        : undefined;
    },
    staleTime: browseStaleTime,
    gcTime: MANGA_SEARCH_GC_TIME_MS,
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
      <div className="mb-6 max-w-2xl space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Browse manga
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          New releases, popular series, and genre shelves in one clean scan.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <label htmlFor={searchId} className="sr-only">
              Search manga by title
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchId}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Search by title..."
              aria-label="Search manga by title"
              className="h-11 pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
            aria-controls={filtersId}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </Button>
        </div>

        {showFilters && (
          <div
            id={filtersId}
            className="space-y-4 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {TAG_GROUPS.map((group) => (
                <div key={group.label} className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.tags.map((tag) => (
                      <button
                        type="button"
                        key={tag.id}
                        onClick={() => toggleGenre(tag.id)}
                        aria-pressed={genres.includes(tag.id)}
                        className={cn(
                          "min-h-11 rounded-full border px-3 text-sm font-medium transition",
                          genres.includes(tag.id)
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {genres.length > 0 && (
              <button
                type="button"
                onClick={() => setGenres([])}
                aria-label={`Clear ${genres.length} selected genre filters`}
                className="min-h-11 rounded-lg text-sm font-medium text-accent hover:underline"
              >
                Clear {genres.length} selected
              </button>
            )}
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
            {items.map((m, index) => (
              <Fragment key={m.id}>
                {shouldShowInternalPreview(index) && (
                  <InternalAdPreview
                    placement="feed"
                    className="col-span-2 my-3 sm:col-span-3 md:col-span-4 lg:col-span-5 xl:col-span-6"
                  />
                )}
                <MangaCard manga={m} eager={index < 6} />
              </Fragment>
            ))}
          </div>
          <div ref={sentinel} className="h-12" />
          {query.isFetchingNextPage && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Loading more...
            </p>
          )}
        </>
      )}
    </div>
  );
}
