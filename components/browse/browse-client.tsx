"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Search, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import { Select } from "@/components/ui/select";
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
  const reduceMotion = useReducedMotion();

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
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
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

        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              key="filters"
              id={filtersId}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-5 border-t border-line-subtle pt-5"
            >
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
                    Sort by
                  </span>
                  <Select
                    value={sort}
                    options={SORTS}
                    onChange={setSort}
                    label="Sort by"
                    className="w-52"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
                    Status
                  </span>
                  <Select
                    value={status}
                    options={STATUSES}
                    onChange={setStatus}
                    label="Status"
                    className="w-44"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {TAG_GROUPS.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.tags.map((tag) => {
                        const selected = genres.includes(tag.id);
                        return (
                          <button
                            type="button"
                            key={tag.id}
                            onClick={() => toggleGenre(tag.id)}
                            aria-pressed={selected}
                            className={cn(
                              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:scale-95",
                              selected
                                ? "border-transparent bg-brand-primary text-brand-primary-foreground shadow-sm shadow-brand-primary/25"
                                : "border-line-subtle text-content-secondary hover:border-line-strong hover:bg-surface-muted/60 hover:text-content-primary",
                            )}
                          >
                            <AnimatePresence initial={false}>
                              {selected && (
                                <motion.span
                                  initial={reduceMotion ? false : { width: 0, opacity: 0 }}
                                  animate={{ width: "auto", opacity: 1 }}
                                  exit={reduceMotion ? { opacity: 0 } : { width: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="grid place-items-center overflow-hidden"
                                >
                                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                </motion.span>
                              )}
                            </AnimatePresence>
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {genres.length > 0 && (
                <button
                  type="button"
                  onClick={() => setGenres([])}
                  aria-label={`Clear ${genres.length} selected genre filters`}
                  className="min-h-9 rounded-lg text-sm font-medium text-brand-primary transition hover:underline"
                >
                  Clear {genres.length} selected
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
