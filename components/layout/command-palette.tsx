"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ChevronRight, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { searchMangaClient } from "@/lib/mangadex-client";
import { coverUrl } from "@/lib/mangadex";

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function CommandPalette({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const debouncedValue = useDebounced(value);
  const router = useRouter();
  const paletteId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closePalette = useCallback(() => {
    setOpen(false);
    setValue("");
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  // Toggle with Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  // Prevent background scrolling when open
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const handleDialogKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null);

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [closePalette],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["search-autocomplete", debouncedValue],
    queryFn: ({ signal }) => searchMangaClient({ title: debouncedValue, limit: 5 }, signal),
    enabled: debouncedValue.trim().length >= 2,
  });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={open ? paletteId : undefined}
        aria-label="Search manga"
        className={cn(
          // Up through lg: a ghost icon button that matches the theme toggle.
          // Only at xl+ does it expand into a real search field with room for
          // its full placeholder — so no truncated-placeholder state can exist.
          "flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg text-sm text-content-secondary transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus xl:justify-start xl:rounded-xl xl:border xl:border-line-subtle xl:bg-surface-muted/30 xl:px-3.5 xl:hover:bg-surface-muted/80",
          className
        )}
      >
        <Search className="h-5 w-5 shrink-0 xl:h-4 xl:w-4" aria-hidden="true" />
        <span className="hidden min-w-0 flex-1 truncate text-left font-medium xl:block">
          Search manga...
        </span>
        <kbd className="pointer-events-none hidden h-5 shrink-0 select-none items-center gap-1 rounded border border-line-subtle bg-surface-canvas/50 px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4"
            onClick={closePalette}
          >
            <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-[2px]" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              onClick={(e) => e.stopPropagation()}
              id={paletteId}
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Search manga"
              onKeyDown={handleDialogKeyDown}
              className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line-subtle bg-surface-panel/90 backdrop-blur-3xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)]"
            >
              <div className="flex items-center px-4 bg-transparent border-b border-line-subtle/50">
              <Search className="mr-3 h-5 w-5 text-content-secondary" />
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Search manga by title..."
                style={{ boxShadow: "none", outline: "none" }}
                className="flex h-16 w-full bg-transparent py-3 text-base outline-none border-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-content-secondary/50 text-content-primary font-medium"
                onKeyDown={(e) => {
                  if (e.key === "Escape") closePalette();
                  if (e.key === "Backspace" && value === "") closePalette();
                  if (e.key === "Enter" && value.trim()) {
                    closePalette();
                    router.push(`/browse?q=${encodeURIComponent(value.trim())}`);
                  }
                }}
              />
              {isLoading && <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />}
              <button
                type="button"
                onClick={closePalette}
                aria-label="Close search"
                className="ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-control text-content-secondary transition hover:bg-surface-muted hover:text-content-primary focus-visible:ring-2 focus-visible:ring-focus"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="bg-transparent min-h-[100px]">
              {value.trim().length >= 2 && (
                <div className="max-h-[60vh] overflow-y-auto p-2">
                  {data?.manga && data.manga.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {data.manga.map((m, i) => {
                        const cover = coverUrl(m.id, m.coverFileName, 256);
                        const statusStr = m.status ? m.status.charAt(0).toUpperCase() + m.status.slice(1) : "";
                        const tag = m.tags[0] || statusStr || "Manga";

                        return (
                          <Link
                            key={m.id}
                            href={`/manga/${m.id}`}
                            onClick={closePalette}
                            style={{ animationDelay: `${i * 40}ms`, animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                            className="group flex items-center gap-3 rounded-xl px-3 py-2 transition-all hover:bg-black/5 dark:hover:bg-white/10 focus-visible:bg-black/5 dark:focus-visible:bg-white/10 focus:outline-none focus:ring-0 active:scale-[0.98] animate-in slide-in-from-bottom-2 fade-in fill-mode-both duration-200"
                          >
                            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-black/5 dark:bg-white/5 shadow-sm ring-1 ring-black/10 dark:ring-white/10">
                              {cover && <Image src={cover} alt="" fill sizes="40px" className="object-cover" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-content-primary tracking-tight">
                                {m.title}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-wider text-content-secondary/80">
                                {m.year ? `${m.year} • ` : ""}{tag}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-content-secondary opacity-0 -translate-x-2 transition-all duration-200 ease-out group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0" />
                          </Link>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          closePalette();
                          router.push(`/browse?q=${encodeURIComponent(value.trim())}`);
                        }}
                        style={{ animationDelay: `${data.manga.length * 40}ms`, animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                        className="mt-2 mx-1 w-[calc(100%-8px)] rounded-lg bg-black/5 dark:bg-white/5 py-2.5 text-xs font-bold text-content-primary transition hover:bg-black/10 dark:hover:bg-white/10 animate-in fade-in fill-mode-both duration-300"
                      >
                        View all results
                      </button>
                    </div>
              ) : !isLoading && (
                <div className="py-14 text-center text-sm font-medium text-content-secondary">
                  No results found for {value}
                </div>
              )}
                </div>
              )}
              
              {value.trim().length < 2 && (
                <div className="px-4 py-8 text-center text-xs font-medium text-content-secondary/70">
                  Type at least 2 characters to search...
                </div>
              )}
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
