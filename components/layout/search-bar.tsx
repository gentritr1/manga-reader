"use client";

import { Search, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { MangaCoverImage } from "@/components/manga/cover-image";
import { cn } from "@/lib/utils";
import {
  MANGA_SEARCH_GC_TIME_MS,
  MANGA_SEARCH_STALE_TIME_MS,
  searchMangaClient,
} from "@/lib/mangadex-client";
import { coverUrl } from "@/lib/mangadex";

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SearchBar({
  className,
  inputClassName,
  iconClassName,
  placeholder = "Search manga...",
}: {
  className?: string;
  inputClassName?: string;
  iconClassName?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const debouncedValue = useDebounced(value);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["search-autocomplete", debouncedValue],
    queryFn: ({ signal }) => searchMangaClient({ title: debouncedValue, limit: 5 }, signal),
    enabled: debouncedValue.trim().length >= 2,
    staleTime: MANGA_SEARCH_STALE_TIME_MS,
    gcTime: MANGA_SEARCH_GC_TIME_MS,
  });

  return (
    <form
      ref={containerRef}
      onSubmit={(e) => {
        e.preventDefault();
        setIsOpen(false);
        const q = value.trim();
        router.push(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse");
      }}
      className={cn("relative", className)}
    >
      <Search
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
          iconClassName,
        )}
      />
      <Input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (value.trim().length >= 2) setIsOpen(true);
        }}
        placeholder={placeholder}
        className={cn("pl-9", inputClassName)}
        aria-label="Search manga"
      />

      {isOpen && value.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-card border border-line-subtle bg-surface-panel shadow-elevation-panel">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : data?.manga && data.manga.length > 0 ? (
            <div className="flex flex-col py-1">
              {data.manga.map((m) => {
                const cover = coverUrl(m.id, m.coverFileName, 256);
                const statusStr = m.status ? m.status.charAt(0).toUpperCase() + m.status.slice(1) : "";
                const tag = m.tags[0] ?? statusStr ?? "Manga";

                return (
                  <Link
                    key={m.id}
                    href={`/manga/${m.id}`}
                    prefetch={false}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 transition hover:bg-surface-panel-raised focus-visible:bg-surface-panel-raised"
                  >
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-surface-muted">
                      {cover ? (
                        <MangaCoverImage
                          src={cover}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-snug text-foreground">
                        {m.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-content-secondary">
                        {m.year ? `${m.year} • ` : ""}{tag}
                      </p>
                    </div>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push(`/browse?q=${encodeURIComponent(value.trim())}`);
                }}
                className="mx-3 mb-1 mt-1 rounded bg-surface-muted py-1.5 text-xs font-medium text-content-secondary transition hover:bg-surface-muted/80 hover:text-foreground"
              >
                View all results
              </button>
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-content-secondary">
              No results found for &quot;{value}&quot;
            </div>
          )}
        </div>
      )}
    </form>
  );
}
