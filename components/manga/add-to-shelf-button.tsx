"use client";

import { useState, useRef, useEffect, useTransition } from "react";
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
    startTransition(async () => {
      if (isAdded) {
        await removeFromShelf(shelfId, mangaId);
      } else {
        await addToShelf(shelfId, mangaId, title, coverUrl);
      }
    });
  };

  return (
    <div className="relative flex-1 min-[480px]:flex-none" ref={containerRef}>
      <Button
        variant="secondary"
        size="lg"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full"
      >
        <ListPlus className="h-5 w-5 mr-2" /> Add to Shelf
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
                const isAdded = shelf.items.some((item) => item.mangaId === mangaId);
                return (
                  <button
                    key={shelf.id}
                    onClick={() => toggleShelf(shelf.id, isAdded)}
                    disabled={isPending}
                    className="flex items-center justify-between w-full p-2.5 rounded-lg hover:bg-surface-muted transition-colors text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-3 h-3 rounded-full shadow-sm", colorMap[shelf.colorVibe] || "bg-indigo-500")} />
                      <span className="text-sm font-medium text-content-primary truncate max-w-[140px]">{shelf.name}</span>
                    </div>
                    {isAdded ? (
                      <Check className="h-4 w-4 text-brand-primary" />
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
