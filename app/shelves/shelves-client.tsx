"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { createShelf, deleteShelf } from "./actions";
import { Plus, Trash2, Share, Loader2, Check, LibraryBig, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { YomiMark } from "@/components/brand/yomi-mark";
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

// Refined, jewel-toned shelf accents tuned to read well on the dark night-shelf
// canvas. Keyed by the colour ids the server already validates.
const SHELF_COLORS: Record<string, string> = {
  violet: "oklch(0.62 0.17 285)",
  indigo: "oklch(0.58 0.16 270)",
  cyan: "oklch(0.72 0.11 205)",
  emerald: "oklch(0.7 0.12 165)",
  amber: "oklch(0.78 0.13 75)",
  orange: "oklch(0.7 0.16 48)",
  rose: "oklch(0.68 0.17 14)",
  fuchsia: "oklch(0.65 0.2 330)",
  slate: "oklch(0.62 0.035 265)",
};
const COLOR_IDS = Object.keys(SHELF_COLORS);
const shelfColor = (id: string) => SHELF_COLORS[id] ?? SHELF_COLORS.violet;

// One-tap starter collections. Creating one is a single click, so a brand-new
// reader leaves with a useful shelf instead of a blank page.
const TEMPLATES: { name: string; color: string }[] = [
  { name: "Reading", color: "cyan" },
  { name: "Want to read", color: "violet" },
  { name: "Finished", color: "emerald" },
  { name: "Weekend binge", color: "amber" },
  { name: "All-time favorites", color: "rose" },
];

export function ShelvesClient({ initialShelves }: { initialShelves: Shelf[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("violet");
  const [isPending, startTransition] = useTransition();
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existingNames = new Set(
    initialShelves.map((s) => s.name.trim().toLowerCase()),
  );
  const availableTemplates = TEMPLATES.filter(
    (t) => !existingNames.has(t.name.toLowerCase()),
  );

  const submit = (shelfName: string, shelfColor: string) => {
    const trimmed = shelfName.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await createShelf(trimmed, shelfColor);
      if (result?.error) setError(result.error);
      else if (trimmed === name.trim()) setName("");
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    submit(name, color);
  };

  const handleTemplate = (template: { name: string; color: string }) => {
    setPendingTemplate(template.name);
    setError(null);
    startTransition(async () => {
      const result = await createShelf(template.name, template.color);
      if (result?.error) setError(result.error);
      setPendingTemplate(null);
    });
  };

  const handleDelete = (id: string) => {
    if (deletingId === id) {
      deleteShelf(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      setTimeout(
        () => setDeletingId((current) => (current === id ? null : current)),
        3000,
      );
    }
  };

  const handleExport = async (shelfId: string, shelfName: string) => {
    const el = document.getElementById(`shelf-${shelfId}`);
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { backgroundColor: "#0a0a12", pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `yomi-${shelfName.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to export image:", err);
    }
  };

  const hasShelves = initialShelves.length > 0;

  return (
    <div className="space-y-10">
      {/* Composer */}
      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-line-subtle bg-surface-panel p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label
              htmlFor="shelf-name"
              className="text-xs font-semibold uppercase tracking-wide text-content-secondary"
            >
              New shelf
            </label>
            <Input
              id="shelf-name"
              placeholder="Name it — Midnight Manhwa, Comfort Reads…"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              className="h-12 bg-surface-canvas text-base font-medium"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={isPending || !name.trim()}
            className="shrink-0 self-start sm:self-auto"
          >
            {isPending && !pendingTemplate ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create shelf
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
            Color
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_IDS.map((id) => {
              const selected = color === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setColor(id)}
                  aria-label={`${id} shelf color`}
                  aria-pressed={selected}
                  style={{ background: shelfColor(id) }}
                  className={cn(
                    "h-7 w-7 rounded-full transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel",
                    selected
                      ? "scale-110 ring-2 ring-content-primary ring-offset-2 ring-offset-surface-panel"
                      : "opacity-70 hover:scale-105 hover:opacity-100",
                  )}
                />
              );
            })}
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm font-medium text-danger">{error}</p>
        )}
      </form>

      {/* Starter templates */}
      {availableTemplates.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-content-secondary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-content-primary">
              {hasShelves ? "Add a starter shelf" : "Start with a shelf"}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableTemplates.map((t) => {
              const busy = pendingTemplate === t.name;
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => handleTemplate(t)}
                  disabled={isPending}
                  className="group inline-flex items-center gap-2 rounded-full border border-line-subtle bg-surface-panel px-4 py-2 text-sm font-medium text-content-primary transition-all duration-200 hover:border-line-strong hover:bg-surface-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:scale-95 disabled:opacity-50"
                >
                  <span
                    className="h-3 w-3 rounded-full transition-transform duration-200 group-hover:scale-110"
                    style={{ background: shelfColor(t.color) }}
                    aria-hidden="true"
                  />
                  {t.name}
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-content-secondary" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-content-secondary transition-transform duration-200 group-hover:rotate-90" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Shelves */}
      {hasShelves ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {initialShelves.map((shelf) => (
            <ShelfCard
              key={shelf.id}
              shelf={shelf}
              deleting={deletingId === shelf.id}
              onDelete={() => handleDelete(shelf.id)}
              onExport={() => handleExport(shelf.id, shelf.name)}
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface-shelf/40 px-6 py-16 text-center">
      <YomiMark className="mx-auto mb-4 h-12 w-12 opacity-90" />
      <h2 className="text-lg font-bold text-content-primary">No shelves yet</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-content-secondary">
        Name one above, or tap a starter shelf to begin. Add titles from any
        manga page with the shelf button.
      </p>
    </div>
  );
}

function ShelfCard({
  shelf,
  deleting,
  onDelete,
  onExport,
}: {
  shelf: Shelf;
  deleting: boolean;
  onDelete: () => void;
  onExport: () => void;
}) {
  const color = shelfColor(shelf.colorVibe);
  const count = shelf.items.length;

  return (
    <div className="group relative">
      <article
        id={`shelf-${shelf.id}`}
        className="relative min-h-[280px] overflow-hidden rounded-2xl border border-line-subtle bg-surface-panel p-5"
        // The shelf colour is woven into the surface as a soft tint, not stuck
        // on as a stripe. Identity reads from the dot beside the name.
        style={{
          backgroundImage: `radial-gradient(125% 80% at 100% 0%, color-mix(in oklab, ${color} 13%, transparent), transparent 54%)`,
        }}
      >
        <div className="relative flex h-full flex-col">
          <header className="mb-4 flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-[0.45rem] h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-line-inverse"
              style={{ background: color }}
            />
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-xl font-black tracking-tight text-content-primary">
                {shelf.name}
              </h3>
              <p className="mt-1 text-xs font-medium text-content-secondary">
                {count === 0 ? "Empty shelf" : `${count} title${count === 1 ? "" : "s"}`}
              </p>
            </div>
          </header>

          {count === 0 ? (
            <div className="mt-auto flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-surface-muted">
                <LibraryBig className="h-5 w-5 text-content-secondary" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-content-primary">Nothing here yet</p>
              <p className="mt-1 text-xs text-content-secondary">
                Add titles from any manga page.
              </p>
            </div>
          ) : (
            <div className="relative mt-auto grid grid-cols-3 gap-2.5">
              {shelf.items.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-muted shadow-[var(--elevation-cover)] ring-1 ring-line-inverse"
                >
                  {item.coverUrl && (
                    <Image
                      src={item.coverUrl}
                      alt=""
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </article>

      {/* Controls, hidden from the exported image */}
      <div className="absolute right-4 top-4 z-20 flex gap-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <Button
          size="icon"
          variant="secondary"
          onClick={onExport}
          aria-label={`Save ${shelf.name} as image`}
          className="h-9 w-9 backdrop-blur"
        >
          <Share className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={onDelete}
          aria-label={deleting ? "Confirm delete" : `Delete ${shelf.name}`}
          className={cn(
            "h-9 w-9 backdrop-blur transition-all duration-200",
            deleting
              ? "scale-105 bg-danger text-danger-foreground hover:brightness-110"
              : "text-danger hover:bg-danger/10",
          )}
        >
          {deleting ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
