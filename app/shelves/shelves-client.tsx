"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { createShelf, deleteShelf } from "./actions";
import { Plus, Trash2, Share, Loader2, Check, LibraryBig, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { YomiMark } from "@/components/brand/yomi-mark";
import { SITE_HOST, SITE_NAME } from "@/lib/site";
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

type LoadedCoverSources = Record<string, Record<string, string>>;

const SHARE_CARD_WIDTH = 1080;
const SHARE_CARD_HEIGHT = 1350;
const SHARE_COVER_LIMIT = 6;
const COVER_WAIT_MS = 1800;

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

const SHARE_SPINE_BACKGROUNDS = [
  "linear-gradient(180deg, var(--brand-violet), color-mix(in oklch, var(--brand-violet) 42%, var(--reader-canvas)))",
  "linear-gradient(180deg, var(--brand-cyan), color-mix(in oklch, var(--brand-cyan) 34%, var(--reader-canvas)))",
  "linear-gradient(180deg, var(--brand-coral), color-mix(in oklch, var(--brand-coral) 34%, var(--reader-canvas)))",
  "linear-gradient(180deg, var(--library), color-mix(in oklch, var(--library) 36%, var(--reader-canvas)))",
  "linear-gradient(180deg, var(--discovery), color-mix(in oklch, var(--discovery) 30%, var(--reader-canvas)))",
  "linear-gradient(180deg, var(--action-primary), color-mix(in oklch, var(--action-primary) 34%, var(--reader-canvas)))",
];

const SHARE_SLOT_OFFSETS = [26, 0, 18, 8, 30, 12];
const SHARE_SLOT_ROTATIONS = [-2.4, 1.4, -1.2, 2, -1.8, 1];

function slugifyShelfName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "shelf";
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitForFonts() {
  if ("fonts" in document) {
    await document.fonts.ready.catch(() => undefined);
  }
}

async function waitForImageReady(img: HTMLImageElement) {
  if (img.complete) {
    if (img.naturalWidth > 0) {
      await img.decode().catch(() => undefined);
      return true;
    }
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = async (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      img.removeEventListener("load", handleLoad);
      img.removeEventListener("error", handleError);
      if (ready) await img.decode().catch(() => undefined);
      resolve(ready);
    };
    const handleLoad = () => void finish(img.naturalWidth > 0);
    const handleError = () => void finish(false);
    const timeout = window.setTimeout(() => void finish(false), COVER_WAIT_MS);

    img.addEventListener("load", handleLoad);
    img.addEventListener("error", handleError);
  });
}

function sameOriginImageSource(img: HTMLImageElement) {
  const source = img.currentSrc || img.src;
  if (!source) return null;
  if (source.startsWith("data:") || source.startsWith("blob:")) return source;

  try {
    const url = new URL(source, window.location.href);
    return url.origin === window.location.origin ? url.href : null;
  } catch {
    return null;
  }
}

function loadedImageDataUrl(img: HTMLImageElement) {
  if (!sameOriginImageSource(img) || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    return null;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

async function collectLoadedShelfCoverSources(
  shelfId: string,
  items: ShelfItem[],
) {
  const shelfEl = document.getElementById(`shelf-${shelfId}`);
  if (!shelfEl) return {};

  const images = Array.from(
    shelfEl.querySelectorAll<HTMLImageElement>("img[data-share-cover-id]"),
  );
  const imageByItemId = new Map(
    images.map((img) => [img.dataset.shareCoverId, img]),
  );
  const entries = await Promise.all(
    items.map(async (item) => {
      const img = imageByItemId.get(item.id);
      if (!img) return null;

      const ready = await waitForImageReady(img);
      if (!ready) return null;

      const source = loadedImageDataUrl(img);
      return source ? ([item.id, source] as const) : null;
    }),
  );

  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

async function waitForRenderedImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map((img) => waitForImageReady(img)));
}

export function ShelvesClient({ initialShelves }: { initialShelves: Shelf[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("violet");
  const [isPending, startTransition] = useTransition();
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [coverSourcesByShelf, setCoverSourcesByShelf] =
    useState<LoadedCoverSources>({});

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

  const handleExport = async (shelf: Shelf) => {
    setExportError(null);
    setExportingId(shelf.id);

    try {
      const coverSources = await collectLoadedShelfCoverSources(
        shelf.id,
        shelf.items.slice(0, SHARE_COVER_LIMIT),
      );
      setCoverSourcesByShelf((current) => ({
        ...current,
        [shelf.id]: coverSources,
      }));
      await waitForPaint();

      const el = document.getElementById(`share-shelf-${shelf.id}`);
      if (!el) return;

      await waitForFonts();
      await waitForRenderedImages(el);

      // html-to-image is only needed on this explicit share/export action, so
      // load it on demand to keep it out of the route's initial JS bundle.
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        backgroundColor: getComputedStyle(el).backgroundColor,
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `yomi-shelf-${slugifyShelfName(shelf.name)}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to export shelf image:", err);
      setExportError("Could not create the shelf image. Try again.");
    } finally {
      setExportingId((current) => (current === shelf.id ? null : current));
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
        <>
          {exportError && (
            <p
              role="status"
              className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
            >
              {exportError}
            </p>
          )}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {initialShelves.map((shelf) => (
              <ShelfCard
                key={shelf.id}
                shelf={shelf}
                deleting={deletingId === shelf.id}
                exporting={exportingId === shelf.id}
                onDelete={() => handleDelete(shelf.id)}
                onExport={() => handleExport(shelf)}
              />
            ))}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed left-[-20000px] top-0 z-[-1] overflow-hidden"
          >
            {initialShelves.map((shelf) => (
              <ShareShelfCard
                key={shelf.id}
                shelf={shelf}
                coverSources={coverSourcesByShelf[shelf.id] ?? {}}
              />
            ))}
          </div>
        </>
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
  exporting,
  onDelete,
  onExport,
}: {
  shelf: Shelf;
  deleting: boolean;
  exporting: boolean;
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
                      data-share-cover-id={item.id}
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
          disabled={exporting}
          aria-label={`Share shelf ${shelf.name}`}
          title="Share shelf"
          className="h-9 w-9 backdrop-blur"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share className="h-4 w-4" />
          )}
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

function ShareShelfCard({
  shelf,
  coverSources,
}: {
  shelf: Shelf;
  coverSources: Record<string, string>;
}) {
  const count = shelf.items.length;
  const slots = Array.from({ length: SHARE_COVER_LIMIT }, (_, index) => ({
    item: shelf.items[index],
    index,
  }));
  const titleFontSize =
    shelf.name.length > 44 ? 58 : shelf.name.length > 28 ? 68 : 82;
  const countLabel =
    count === 0 ? "Empty shelf" : `${count} title${count === 1 ? "" : "s"}`;

  return (
    <div
      id={`share-shelf-${shelf.id}`}
      className="dark relative overflow-hidden"
      style={{
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        backgroundColor: "var(--reader-canvas)",
        backgroundImage:
          "radial-gradient(circle at 50% 20%, color-mix(in oklch, var(--brand-violet) 22%, transparent), transparent 36%), radial-gradient(circle at 80% 56%, color-mix(in oklch, var(--brand-cyan) 14%, transparent), transparent 28%), linear-gradient(180deg, var(--surface-spotlight) 0%, var(--reader-canvas) 72%)",
        color: "var(--content-inverse)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-16 top-16 h-1.5 rounded-full"
        style={{ backgroundImage: "var(--shelf-edge)" }}
      />

      <div className="absolute inset-x-20 top-36">
        <p
          className="font-black"
          style={{
            color: "var(--content-inverse-muted)",
            fontSize: 28,
            letterSpacing: 0,
          }}
        >
          {SITE_NAME} shelf
        </p>
        <h2
          className="mt-7 font-black leading-[0.98]"
          style={{
            display: "-webkit-box",
            fontSize: titleFontSize,
            letterSpacing: 0,
            maxHeight: 176,
            overflow: "hidden",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            textWrap: "balance",
          }}
        >
          {shelf.name}
        </h2>
        <p
          className="mt-8 font-bold"
          style={{
            color: "var(--content-inverse-muted)",
            fontSize: 30,
            letterSpacing: 0,
          }}
        >
          {countLabel}
        </p>
      </div>

      <div className="absolute inset-x-20 top-[500px] h-[620px]">
        <div className="relative h-full">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-[190px] h-8 rounded-full"
            style={{
              backgroundImage: "var(--shelf-edge)",
              boxShadow:
                "0 32px 70px color-mix(in oklch, var(--brand-violet) 28%, transparent)",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-8 bottom-[156px] h-20 rounded-[999px]"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in oklch, var(--content-inverse) 14%, transparent), color-mix(in oklch, var(--reader-canvas) 76%, transparent))",
              filter: "blur(18px)",
            }}
          />

          <div className="absolute inset-x-0 bottom-[218px] flex h-[360px] items-end justify-center gap-5">
            {slots.map(({ item, index }) => {
              const source = item ? coverSources[item.id] ?? null : null;
              return (
                <ShareShelfSlot
                  key={item?.id ?? `empty-${index}`}
                  index={index}
                  source={source}
                  title={item?.title}
                />
              );
            })}
          </div>
        </div>
      </div>

      <footer className="absolute inset-x-20 bottom-20 flex items-center justify-between gap-8 border-t border-line-inverse pt-8">
        <span
          className="font-black"
          style={{ fontSize: 24, letterSpacing: 0, color: "var(--content-inverse)" }}
        >
          {SITE_HOST}
        </span>
        <span
          className="font-bold"
          style={{
            color: "var(--content-inverse-muted)",
            fontSize: 24,
            letterSpacing: 0,
          }}
        >
          Made with {SITE_NAME}
        </span>
      </footer>
    </div>
  );
}

function ShareShelfSlot({
  index,
  source,
  title,
}: {
  index: number;
  source: string | null;
  title?: string;
}) {
  const width = 128 + (index % 2) * 10;
  const height = Math.round(width * 1.5);

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[22px] ring-1 ring-line-inverse"
      style={{
        width,
        height,
        background: SHARE_SPINE_BACKGROUNDS[index % SHARE_SPINE_BACKGROUNDS.length],
        boxShadow:
          "0 28px 60px color-mix(in oklch, var(--reader-canvas) 58%, transparent)",
        transform: `translateY(${SHARE_SLOT_OFFSETS[index]}px) rotate(${SHARE_SLOT_ROTATIONS[index]}deg)`,
      }}
    >
      {source ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt=""
          draggable={false}
          style={{
            display: "block",
            height: "100%",
            objectFit: "cover",
            width: "100%",
          }}
        />
      ) : (
        <div className="absolute inset-0">
          <div
            className="absolute inset-y-5 left-4 w-1 rounded-full"
            style={{ background: "color-mix(in oklch, var(--content-inverse) 48%, transparent)" }}
          />
          <div
            className="absolute bottom-5 left-5 right-5 h-3 rounded-full"
            style={{ background: "color-mix(in oklch, var(--content-inverse) 28%, transparent)" }}
          />
          {title && (
            <span
              className="absolute inset-x-6 top-7 font-black leading-none"
              style={{
                color: "color-mix(in oklch, var(--content-inverse) 84%, transparent)",
                fontSize: 18,
                letterSpacing: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
