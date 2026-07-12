"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ListPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToShelf, removeFromShelf } from "@/app/shelves/actions";
import { cn } from "@/lib/utils";

const colorMap: Record<string, string> = {
  indigo: "bg-indigo-500",
  rose: "bg-rose-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  cyan: "bg-cyan-500",
  violet: "bg-violet-500",
  fuchsia: "bg-fuchsia-500",
  orange: "bg-orange-500",
  slate: "bg-slate-500",
};

type ShelfForButton = {
  id: string;
  name: string;
  colorVibe: string;
  items: Array<{ mangaId: string }>;
};

export function AddToShelfButton({
  shelves,
  mangaId,
  title,
  coverUrl,
}: {
  shelves: ShelfForButton[];
  mangaId: string;
  title: string;
  coverUrl: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();
  const [optimisticShelfIds, setOptimisticShelfIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [settleKey, setSettleKey] = useState(0);
  const isInShelf =
    shelves.some((shelf) => shelf.items.some((item) => item.mangaId === mangaId)) ||
    optimisticShelfIds.size > 0;
  const settleInitial =
    settleKey === 0 ? false : reduceMotion ? { opacity: 0.7 } : { scale: 0.92, y: 2 };
  const settleAnimate =
    settleKey === 0 ? undefined : reduceMotion ? { opacity: 1 } : { scale: 1, y: 0 };

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [isOpen]);

  const toggleShelf = (shelfId: string, isAdded: boolean) => {
    if (isAdded) {
      setOptimisticShelfIds((current) => {
        const next = new Set(current);
        next.delete(shelfId);
        return next;
      });
    } else {
      setOptimisticShelfIds((current) => {
        const next = new Set(current);
        next.add(shelfId);
        return next;
      });
      setSettleKey((key) => key + 1);
    }

    startTransition(async () => {
      const result = isAdded
        ? await removeFromShelf(shelfId, mangaId)
        : await addToShelf(shelfId, mangaId, title, coverUrl);

      if (result?.error) {
        setOptimisticShelfIds((current) => {
          const next = new Set(current);
          if (isAdded) next.add(shelfId);
          else next.delete(shelfId);
          return next;
        });
      }
    });
  };

  return (
    <div className="relative flex-1 min-[480px]:flex-none" ref={containerRef}>
      <Button
        variant={isInShelf ? "library" : "secondary"}
        size="lg"
        onClick={() => setIsOpen(!isOpen)}
        aria-pressed={isInShelf}
        className="w-full"
      >
        <motion.span
          key={settleKey}
          initial={settleInitial}
          animate={settleAnimate}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2"
        >
          {isInShelf ? (
            <Check
              className="h-5 w-5 fill-library text-library"
              aria-hidden="true"
            />
          ) : (
            <ListPlus className="h-5 w-5" aria-hidden="true" />
          )}
          {isInShelf ? "In a shelf" : "Add to Shelf"}
        </motion.span>
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 min-[480px]:left-auto min-[480px]:right-0 mt-2 w-64 rounded-xl border border-line-subtle bg-surface-panel shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-3 border-b border-line-subtle bg-surface-muted/50">
            <h4 className="text-sm font-bold text-content-primary">Your Shelves</h4>
          </div>
          <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-1">
            {shelves.length === 0 ? (
              <p className="text-sm text-content-secondary p-4 text-center">You do not have any shelves yet.</p>
            ) : (
              shelves.map((shelf) => {
                const isAdded =
                  shelf.items.some((item) => item.mangaId === mangaId) ||
                  optimisticShelfIds.has(shelf.id);
                return (
                  <button
                    key={shelf.id}
                    onClick={() => toggleShelf(shelf.id, isAdded)}
                    disabled={isPending}
                    className="flex min-h-11 items-center justify-between w-full p-2.5 rounded-lg hover:bg-surface-muted transition-colors text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-3 h-3 rounded-full shadow-sm", colorMap[shelf.colorVibe] || "bg-indigo-500")} />
                      <span className="text-sm font-medium text-content-primary truncate max-w-[140px]">{shelf.name}</span>
                    </div>
                    {isAdded ? (
                      <Check className="h-4 w-4 fill-library text-brand-primary" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
