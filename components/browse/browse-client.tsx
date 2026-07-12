"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Search, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  MANGA_SEARCH_GC_TIME_MS,
  MANGA_SEARCH_STALE_TIME_MS,
  searchMangaClient,
  type ClientSearchResult,
} from "@/lib/mangadex-client";
import {
  PUBLIC_CONTENT_RATINGS,
  TAG_GROUPS,
  type MangaStatus,
  type SimpleManga,
  type SortOption,
} from "@/lib/mangadex";
import {
  READING_LANGUAGES,
  DEFAULT_READING_LANGUAGE,
  normalizeReadingLanguage,
  readReadingLanguage,
  writeReadingLanguage,
} from "@/lib/reading-language";
import { MangaCard } from "@/components/manga/manga-card";
import { MangaGridSkeleton } from "@/components/manga/manga-grid";
import { InternalAdPreview } from "@/components/ads/internal-ad-preview";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;
// Vertical buffer around the viewport within which a card mounts its cover
// image. Beyond this band the <img> is unmounted, so the count of decoded
// covers held in memory stays bounded no matter how deep the infinite grid
// grows. ~1200px each way ≈ several extra rows of pre/post-load headroom, so
// covers are ready well before they scroll into view at normal speed.
const COVER_WINDOW_MARGIN = "1200px 0px";

/** Register an element with the shared cover-window observer. Returns a cleanup. */
type RegisterCard = (el: Element, onChange: (near: boolean) => void) => () => void;
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

// Language options for the curated reading-language <Select>.
const LANGUAGE_OPTIONS = READING_LANGUAGES.map((l) => ({
  value: l.code,
  label: l.label,
}));

// Content-rating chips. Safe + Suggestive only — erotica/pornographic are
// intentionally omitted (out of brand scope; the proxy also drops them).
const RATING_CHIPS: { value: (typeof PUBLIC_CONTENT_RATINGS)[number]; label: string }[] = [
  { value: "safe", label: "Safe" },
  { value: "suggestive", label: "Suggestive" },
];
const DEFAULT_RATINGS: string[] = [...PUBLIC_CONTENT_RATINGS];

// Parse the ?rating= URL param into a valid, non-empty subset of the public set.
function parseRatingParam(raw: string | null): string[] {
  if (!raw) return DEFAULT_RATINGS;
  const parsed = raw
    .split(",")
    .filter((r) => (DEFAULT_RATINGS as string[]).includes(r));
  return parsed.length > 0 ? parsed : DEFAULT_RATINGS;
}

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

export function BrowseClient({
  initialData,
  initialLanguage = DEFAULT_READING_LANGUAGE,
}: {
  // Server-seeded FIRST page of the DEFAULT result set (newest updates,
  // Safe+Suggestive, cookie language). Present only when the visitor landed with
  // no URL filters, so it always matches the default query key below.
  initialData?: ClientSearchResult;
  // Cookie-derived reading language the server seeded with. Used as the initial
  // state so the query key (which includes language) matches the seeded data on
  // the first render — no hydration mismatch, no immediate refetch.
  initialLanguage?: string;
} = {}) {
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
  // Content rating persists in the URL (shareable, like the other filters).
  const [rating, setRating] = useState<string[]>(() =>
    parseRatingParam(params.get("rating")),
  );
  // Reading language is a GLOBAL preference (localStorage + cookie), not a URL
  // filter. Start at the server-seeded cookie language for SSR/hydration parity
  // (defaults to English when there is no cookie), then reconcile from
  // localStorage after mount (mirrors the reader-prefs pattern). Seeding from the
  // same cookie the server read keeps the query key aligned with initialData.
  const [language, setLanguage] = useState<string>(initialLanguage);
  const [showFilters, setShowFilters] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // Client-only reconciliation from localStorage — a post-mount effect avoids
    // a hydration mismatch, so this setState is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLanguage(readReadingLanguage());
  }, []);

  const changeLanguage = useCallback((code: string) => {
    const next = normalizeReadingLanguage(code);
    setLanguage(next);
    // Persist to localStorage (drives this picker) AND a cookie (so server
    // components — manga detail + reader neighbor feeds — read the same value).
    writeReadingLanguage(next);
  }, []);

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
    // Only serialize rating when it differs from the Safe+Suggestive default.
    if (rating.length !== DEFAULT_RATINGS.length) sp.set("rating", rating.join(","));
    const qs = sp.toString();
    router.replace(qs ? `/browse?${qs}` : "/browse", { scroll: false });
  }, [debouncedTitle, sort, status, rating, router]);

  const query = useInfiniteQuery({
    queryKey: ["browse", debouncedTitle, sort, status, genres, language, rating],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      searchMangaClient({
        title: debouncedTitle || undefined,
        sort,
        status: status || undefined,
        genres,
        translatedLanguage: language,
        contentRating: rating,
        limit: PAGE_SIZE,
        offset: pageParam,
      }, signal),
    getNextPageParam: (lastPage, all) => {
      const loaded = all.reduce((n, p) => n + p.manga.length, 0);
      return loaded < lastPage.total && lastPage.manga.length === PAGE_SIZE
        ? loaded
        : undefined;
    },
    // Seed page 1 from the server ONLY on the default landing. React Query applies
    // initialData to whatever query key is active on mount; since the server only
    // seeds when there were no URL filters, that first key is always the default
    // one. No initialDataUpdatedAt → treated as fresh "now", so with browseStaleTime
    // (2min for the default view) there is no immediate duplicate fetch of page 1.
    initialData: initialData
      ? { pages: [initialData], pageParams: [0] }
      : undefined,
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

  // Image windowing: a single IntersectionObserver shared by every card. Cards
  // register their wrapper and get a boolean when they enter/leave the buffered
  // viewport band; only cards inside the band mount their cover <img>. This keeps
  // the number of decoded covers bounded while leaving the full card DOM (and
  // thus scroll geometry, alignment, focus order, and back/forward scroll
  // restoration) completely intact.
  const cardCallbacks = useRef(new Map<Element, (near: boolean) => void>());
  const coverObserver = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          cardCallbacks.current.get(entry.target)?.(entry.isIntersecting);
        }
      },
      { rootMargin: COVER_WINDOW_MARGIN, threshold: 0 },
    );
    coverObserver.current = obs;
    // Child effects run before this parent effect, so cards may have registered
    // before the observer existed — start observing whatever is already queued.
    for (const el of cardCallbacks.current.keys()) obs.observe(el);
    return () => {
      obs.disconnect();
      coverObserver.current = null;
    };
  }, []);

  const registerCard = useCallback<RegisterCard>((el, onChange) => {
    cardCallbacks.current.set(el, onChange);
    coverObserver.current?.observe(el);
    return () => {
      cardCallbacks.current.delete(el);
      coverObserver.current?.unobserve(el);
    };
  }, []);

  const toggleGenre = (id: string) =>
    setGenres((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

  // Toggle a rating chip. Deselecting the last active rating snaps back to Safe
  // so the query is never sent with an empty contentRating set.
  const toggleRating = (value: string) =>
    setRating((current) => {
      const next = current.includes(value)
        ? current.filter((r) => r !== value)
        : [...current, value];
      return next.length > 0 ? next : ["safe"];
    });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 max-w-2xl space-y-2">
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          Browse manga
        </h1>
        <p className="text-base leading-7 text-muted-foreground">
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
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
                    Language
                  </span>
                  <Select
                    value={language}
                    options={LANGUAGE_OPTIONS}
                    onChange={changeLanguage}
                    label="Reading language"
                    className="w-52"
                  />
                </div>
              </div>

              {/* Content rating. Safe + Suggestive only; erotica/pornographic are
                  deliberately omitted as out of brand scope. Deselecting both
                  re-selects Safe (never an empty rating query). */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
                  Content rating
                </p>
                <div className="flex flex-wrap gap-2">
                  {RATING_CHIPS.map((chip) => {
                    const selected = rating.includes(chip.value);
                    return (
                      <button
                        type="button"
                        key={chip.value}
                        onClick={() => toggleRating(chip.value)}
                        aria-pressed={selected}
                        className={cn(
                          "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:scale-95",
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
                        {chip.label}
                      </button>
                    );
                  })}
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
                              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:scale-95",
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
                  className="inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-brand-primary transition hover:underline"
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
                <BrowseCard
                  manga={m}
                  eager={index < 6}
                  register={registerCard}
                />
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

/**
 * A single browse-grid cell. Wraps MangaCard and drives cover-image windowing:
 * the card DOM is always mounted (so layout, alignment, focus order, and scroll
 * restoration are untouched), but its cover <img> mounts only while the cell is
 * within the shared observer's buffered viewport band. Eager (first-row / LCP)
 * cards always render their cover and skip the observer entirely.
 */
function BrowseCard({
  manga,
  eager,
  register,
}: {
  manga: SimpleManga;
  eager: boolean;
  register: RegisterCard;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);

  useEffect(() => {
    if (eager) return; // eager cards keep their cover mounted permanently
    const el = ref.current;
    if (!el) return;
    return register(el, setNear);
  }, [eager, register]);

  return (
    <div ref={ref}>
      <MangaCard manga={manga} eager={eager} renderCover={eager || near} />
    </div>
  );
}
