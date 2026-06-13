"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Image from "next/image";
import { createShelf, deleteShelf } from "./actions";
import { Plus, Trash2, Share, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toPng } from "html-to-image";
import { cn } from "@/lib/utils";

type ShelfItem = {
  id: string;
  mangaId: string;
  title: string;
  coverUrl: string | null;
};

type Shelf = {
  id: string;
  name: string;
  colorVibe: string;
  items: ShelfItem[];
};

const colorMap: Record<string, { bg: string; ring: string }> = {
  indigo: { bg: "bg-indigo-500", ring: "ring-indigo-500" },
  rose: { bg: "bg-rose-500", ring: "ring-rose-500" },
  emerald: { bg: "bg-emerald-500", ring: "ring-emerald-500" },
  amber: { bg: "bg-amber-500", ring: "ring-amber-500" },
  cyan: { bg: "bg-cyan-500", ring: "ring-cyan-500" },
  violet: { bg: "bg-violet-500", ring: "ring-violet-500" },
  fuchsia: { bg: "bg-fuchsia-500", ring: "ring-fuchsia-500" },
  orange: { bg: "bg-orange-500", ring: "ring-orange-500" },
  slate: { bg: "bg-slate-500", ring: "ring-slate-500" },
};

const colorOptions = Object.entries(colorMap).map(([id, styles]) => ({
  id,
  ...styles,
}));

export function ShelvesClient({ initialShelves }: { initialShelves: Shelf[] }) {
  const [name, setName] = useState("");
  const [colorVibe, setColorVibe] = useState("indigo");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setIsColorPickerOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createShelf(name, colorVibe);
      if (result?.error) {
        setError(result.error);
      } else {
        setName("");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (deletingId === id) {
      deleteShelf(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId((current) => current === id ? null : current), 3000);
    }
  };

  const handleExport = async (shelfId: string, shelfName: string) => {
    const el = document.getElementById(`shelf-${shelfId}`);
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { backgroundColor: "#09090b", pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `yomi-${shelfName.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to export image:", error);
    }
  };

  return (
    <div className="space-y-12">
      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-surface-canvas border border-line-subtle rounded-2xl shadow-sm max-w-3xl focus-within:ring-1 focus-within:ring-line-strong transition-all relative">
        <Input
          placeholder="Name your new shelf... (e.g. Midnight Manhwa)"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          className="w-full sm:flex-1 h-12 bg-transparent border-none shadow-none text-base focus-visible:ring-0 placeholder:text-content-secondary/50 px-4 font-medium text-content-primary"
        />
        <div className="flex w-full sm:w-auto items-stretch gap-2 px-2 pb-2 sm:px-0 sm:pb-0 relative" ref={colorPickerRef}>
          <button
            type="button"
            onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
            className="flex items-center justify-center gap-2 px-4 bg-surface-muted/50 hover:bg-surface-muted border border-line-subtle rounded-xl transition-colors h-12 sm:h-10 shrink-0"
            aria-label="Pick color"
          >
            <div
              className={cn(
                "w-4 h-4 rounded-full ring-2 ring-offset-2 ring-offset-surface-canvas shadow-sm",
                colorMap[colorVibe]?.bg || colorMap.indigo.bg,
                colorMap[colorVibe]?.ring || colorMap.indigo.ring,
              )}
            />
            <span className="text-sm font-bold text-content-primary capitalize sm:hidden">Color</span>
          </button>

          {isColorPickerOpen && (
            <div className="absolute top-full sm:bottom-full sm:top-auto left-2 sm:left-auto sm:right-full mt-2 sm:mb-2 sm:mt-0 sm:mr-2 p-3 bg-surface-panel border border-line-subtle rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200 grid grid-cols-5 gap-2 w-[200px]" style={{ animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
              {colorOptions.map((vibe, i) => (
                <button
                  key={vibe.id}
                  type="button"
                  onClick={() => {
                    setColorVibe(vibe.id);
                    setIsColorPickerOpen(false);
                  }}
                  style={{ animationDelay: `${i * 25}ms`, animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all flex items-center justify-center place-self-center animate-in zoom-in-50 fade-in fill-mode-both duration-300",
                    vibe.bg,
                    colorVibe === vibe.id
                      ? cn("ring-2 ring-offset-2 ring-offset-surface-panel scale-110 shadow-md", vibe.ring)
                      : "opacity-60 hover:opacity-100 hover:scale-105",
                  )}
                  aria-label={`Select ${vibe.id} vibe`}
                />
              ))}
            </div>
          )}

          <Button type="submit" size="md" disabled={isPending} className="shrink-0 h-12 sm:h-10 rounded-xl px-6 font-bold shadow-sm bg-content-primary text-surface-canvas hover:brightness-110 transition-all flex-1 sm:flex-none">
            {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />} Create
          </Button>
        </div>
      </form>
      {error && <p className="text-red-500 text-sm font-medium px-4 mt-2 animate-in fade-in slide-in-from-top-2">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialShelves.map((shelf) => (
          <div key={shelf.id} className="relative group">
            <div
              id={`shelf-${shelf.id}`}
              className="p-6 rounded-2xl border border-line-subtle bg-surface-canvas overflow-hidden shadow-xl relative min-h-[300px]"
            >
              {/* Ambiance back glow */}
              <div className={cn("absolute -inset-1 opacity-20 blur-2xl z-0", colorMap[shelf.colorVibe]?.bg || colorMap.indigo.bg)} />

              <div className="relative z-10 flex flex-col h-full">
                <div className="mb-4">
                  <h3 className="text-2xl font-black tracking-tight text-content-primary drop-shadow-sm">{shelf.name}</h3>
                  <p className="text-[10px] font-bold text-content-secondary/80 uppercase tracking-[0.2em] mt-2 bg-surface-muted/50 inline-block px-2 py-1 rounded-md backdrop-blur-sm">Yomi Shelf</p>
                </div>
                
                {shelf.items.length === 0 ? (
                  <div className="mt-auto py-10 flex flex-col items-center justify-center text-center opacity-60">
                    <div className="h-12 w-12 rounded-full bg-surface-muted mb-4 flex items-center justify-center">
                      <Plus className="h-5 w-5 text-content-secondary" />
                    </div>
                    <p className="text-sm font-medium text-content-primary">Empty Shelf</p>
                    <p className="text-xs text-content-secondary mt-1">Browse manga to add them here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 mt-auto relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-canvas/20 to-transparent pointer-events-none z-10" />
                    {shelf.items.slice(0, 6).map((item) => (
                      <div key={item.id} className="aspect-[2/3] bg-surface-muted rounded-xl overflow-hidden relative shadow-md ring-1 ring-white/10 transition-transform hover:scale-[1.02]">
                        {item.coverUrl && (
                          <Image
                            src={item.coverUrl}
                            alt=""
                            fill
                            sizes="96px"
                            className="object-cover"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Controls (Hidden on Export) */}
            <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <Button size="icon" variant="secondary" onClick={() => handleExport(shelf.id, shelf.name)} aria-label="Export">
                <Share className="h-4 w-4"/>
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => handleDelete(shelf.id)}
                aria-label={deletingId === shelf.id ? "Confirm delete" : "Delete"}
                className={cn(
                  "transition-all duration-200",
                  deletingId === shelf.id
                    ? "text-white bg-red-500 hover:bg-red-600 scale-105"
                    : "text-red-500 hover:text-red-600 hover:bg-red-500/10",
                )}
              >
                {deletingId === shelf.id ? <Check className="h-4 w-4"/> : <Trash2 className="h-4 w-4"/>}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
