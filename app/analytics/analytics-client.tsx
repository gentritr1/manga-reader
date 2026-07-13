"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { YomiMark } from "@/components/brand/yomi-mark";
import { SITE_HOST, SITE_NAME } from "@/lib/site";
import { useReadingRhythm } from "@/lib/use-reading-rhythm";
import { useLocalWeekStats } from "@/lib/use-local-week-stats";
import { formatWeekLine } from "@/lib/local-reading-stats";
import { plural } from "@/lib/plural";
import {
  SHARE_CARD_COLORS,
  SHARE_CARD_RECAP_BACKGROUND,
  SHARE_SPINE_BACKGROUNDS,
} from "@/lib/share-card-theme";
import {
  collectLoadedCoverSources,
  waitForFonts,
  waitForPaint,
  waitForRenderedImages,
} from "@/lib/share-card-rasterize";

interface Props {
  totalPages: number;
  formattedTime: string;
  averageSpeed: string;
  seriesCount: number;
  topManga: { title: string; pages: number; coverUrl: string | null }[];
  name: string;
}

const C = SHARE_CARD_COLORS;

// The recap/export card renders at one fixed composition width so the exported
// PNG is deterministic (same share size on every device) and matches what is
// shown on screen. 672px === the card's previous max-w-2xl (42rem), so the
// canonical desktop export is byte-identical in size to before this change.
const CARD_WIDTH = 672;

// useLayoutEffect runs before paint (so the scale is applied with no flash /
// CLS on the client) but warns during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function AnalyticsClient({
  totalPages,
  formattedTime,
  averageSpeed,
  seriesCount,
  topManga,
  name,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rhythmQuery = useReadingRhythm();
  const rhythm = rhythmQuery.data;
  const weekStats = useLocalWeekStats();
  const weekLine = formatWeekLine(weekStats);
  // Covers rasterized to same-origin data URLs at export time (keyed by the
  // series' rank index). Same mechanism the shelves share card uses.
  const [coverSources, setCoverSources] = useState<Record<string, string>>({});

  const handleExport = async () => {
    if (!cardRef.current) return;
    try {
      // Pre-rasterize the next/image covers (served same-origin via /_next/image)
      // to data URLs and swap them in, so html-to-image has inline, un-tainted
      // pixels to draw — identical to the shelves card's cover mechanism.
      const sources = await collectLoadedCoverSources(cardRef.current);
      setCoverSources(sources);
      await waitForPaint();

      await waitForFonts();
      await waitForRenderedImages(cardRef.current);

      // html-to-image is only needed on this explicit export action, so load it
      // on demand to keep it out of the route's initial JS bundle.
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: C.canvas,
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `yomi-chapter-pulse-${name.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to export image:", error);
    }
  };

  return (
    // One max-width column holds both the scaled card and the export row, so the
    // row's right edge lines up with the card's right edge at every width (the
    // card always fills this column's width — full on desktop, scaled-to-fill on
    // mobile — so their right edges coincide).
    <div className="mx-auto w-full space-y-4" style={{ maxWidth: CARD_WIDTH }}>
      <ScaleToFit cardWidth={CARD_WIDTH}>
        <div
          ref={cardRef}
          className="relative overflow-hidden rounded-card p-8"
          style={{
            width: CARD_WIDTH,
            backgroundColor: C.canvas,
            backgroundImage: SHARE_CARD_RECAP_BACKGROUND,
            border: `1px solid ${C.lineInverse}`,
            color: C.inverse,
          }}
        >
          <header className="flex items-start justify-between gap-4">
            <div>
              <h2
                className="font-display text-3xl font-extrabold tracking-tight"
                style={{ color: C.inverse }}
              >
                Chapter Pulse
              </h2>
              <p
                className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: C.inverseMuted }}
              >
                {`${name}'s reading recap`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <YomiMark className="h-9 w-9" />
              <span
                className="font-display text-lg font-extrabold"
                style={{ color: C.inverse }}
              >
                {SITE_NAME}
              </span>
            </div>
          </header>

          {/* Editorial deck line: one set line between two hairlines. Text only —
              no box, no dot, no stripe. Numerals are emphasized with weight and
              the display face, never a second colour. */}
          {weekLine && (
            <div
              className="mt-7 py-3.5 text-center"
              style={{
                borderTop: `1px solid ${C.lineInverse}`,
                borderBottom: `1px solid ${C.lineInverse}`,
              }}
            >
              <DeckLine text={weekLine} />
            </div>
          )}

          {/* Stat row — the home rhythm card's hairline-divided column set:
              display numeral + small-caps label per column, vertical hairlines
              between columns. No hero-metric blocks in dead space. */}
          <div className="mt-8 flex items-stretch">
            <StatColumn
              value={totalPages.toLocaleString()}
              label={`${plural(totalPages, "Page")} read`}
            />
            <StatColumn
              value={formattedTime}
              label="Time spent"
              withDivider
            />
            <StatColumn
              value={seriesCount.toLocaleString()}
              label="Series"
              withDivider
            />
          </div>

          {/* Top series — a tight ranked list: display rank numeral, small cover,
              title, right-aligned plain page count. Hairlines between rows. */}
          <div className="mt-9">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: C.inverseMuted }}
            >
              Top series
            </p>

            {topManga.length === 0 ? (
              <p
                className="mt-4 text-sm font-medium"
                style={{ color: C.inverseMuted }}
              >
                Start reading to build your recap.
              </p>
            ) : (
              <div className="mt-2">
                {topManga.map((manga, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 py-3"
                    style={
                      i > 0
                        ? { borderTop: `1px solid ${C.lineInverse}` }
                        : undefined
                    }
                  >
                    <span
                      className="font-display w-5 shrink-0 text-lg font-extrabold tabular-nums"
                      style={{ color: C.inverseMuted }}
                    >
                      {i + 1}
                    </span>
                    <SeriesCover
                      index={i}
                      coverUrl={manga.coverUrl}
                      dataUrl={coverSources[String(i)]}
                      title={manga.title}
                    />
                    <span
                      className="min-w-0 flex-1 truncate text-base font-bold"
                      style={{ color: C.inverse }}
                    >
                      {manga.title}
                    </span>
                    <span
                      className="shrink-0 text-sm font-medium tabular-nums"
                      style={{ color: C.inverseMuted }}
                    >
                      {manga.pages.toLocaleString()} {plural(manga.pages, "page")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <footer
            className="mt-9 flex items-center justify-between gap-4 pt-5"
            style={{
              color: C.inverseMuted,
              borderTop: `1px solid ${C.lineInverse}`,
            }}
          >
            <span className="text-xs font-bold tracking-wide">{SITE_HOST}</span>
            <span className="text-xs font-bold tracking-wide">
              {rhythm && rhythm.rhythmDays > 0
                ? `${rhythm.rhythmDays}-night rhythm`
                : `${averageSpeed}s / page average`}
            </span>
          </footer>
        </div>
      </ScaleToFit>

      {/* Export action anchored to the card: a right-aligned row directly below
          it, in the same max-width column. Kept OUTSIDE the scaled card node so
          the button stays at its true ≥44px size and is never captured in the
          exported PNG. */}
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <p className="text-sm text-content-secondary">Saves a PNG of this card</p>
        <Button
          onClick={handleExport}
          size="lg"
          disabled={rhythmQuery.isLoading}
          className="h-12 px-8 font-bold"
        >
          <Download className="mr-2 h-5 w-5" aria-hidden="true" />
          Export recap
        </Button>
      </div>
    </div>
  );
}

// The deck line rendered with numerals emphasized by weight (and the display
// face), never a second colour — so it reads as one editorial line on the card's
// light inverse ink. Digit runs (including thousands separators) are split out
// and set heavier; everything else stays the base weight.
function DeckLine({ text }: { text: string }) {
  const parts = text.split(/(\d[\d,]*)/);
  return (
    <p
      className="text-sm font-medium leading-relaxed"
      style={{ color: C.inverse }}
    >
      {parts.map((part, i) =>
        /^\d/.test(part) ? (
          <span key={i} className="font-display font-extrabold">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

// One column of the stat row — mirrors the home rhythm card's StatColumn
// (display numeral + small-caps micro-label), with an explicit-literal vertical
// hairline separating columns (explicit literals inside the captured card).
function StatColumn({
  value,
  label,
  withDivider = false,
}: {
  value: string;
  label: string;
  withDivider?: boolean;
}) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-col"
      style={
        withDivider
          ? {
              borderLeft: `1px solid ${C.lineInverse}`,
              paddingLeft: "1.25rem",
              marginLeft: "1.25rem",
            }
          : undefined
      }
    >
      <span
        className="font-display text-3xl font-extrabold leading-none tracking-tight tabular-nums"
        style={{ color: C.inverse }}
      >
        {value}
      </span>
      <span
        className="mt-2 text-[11px] font-semibold uppercase leading-tight tracking-[0.14em]"
        style={{ color: C.inverseMuted }}
      >
        {label}
      </span>
    </div>
  );
}

// Scale-to-fit wrapper for the recap card. The card itself renders at a single
// fixed CARD_WIDTH (so it is one DOM node — what you see is exactly what the PNG
// exports, with no responsive divergence). This wrapper measures the available
// width and scales the card down with a top-left transform so it never overflows
// on narrow screens, compensating the layout height so nothing below it shifts.
// The card only ever scales DOWN (scale ≤ 1); on desktop the wrapper is capped
// at CARD_WIDTH and centred, so the card sits centred with balanced margins
// instead of stranded to one side. The transform lives on this wrapper, NOT on
// the exported card node, so html-to-image still captures the card at 1:1.
function ScaleToFit({
  cardWidth,
  children,
}: {
  cardWidth: number;
  children: ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useIsomorphicLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const available = outer.clientWidth;
      const next = Math.min(1, available / cardWidth);
      setScale(next);
      setHeight(inner.offsetHeight * next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [cardWidth]);

  return (
    // overflow-hidden clips the un-scaled layout box on narrow screens so there
    // is never a horizontal scrollbar, even before the first measurement.
    <div
      ref={outerRef}
      className="mx-auto w-full overflow-hidden"
      style={{ maxWidth: cardWidth, height }}
    >
      <div
        ref={innerRef}
        style={{
          width: cardWidth,
          transformOrigin: "top left",
          transform: scale === 1 ? undefined : `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// A single cover in the Top series list. Small (rounded-sm, hairline border) so
// it reads as an editorial thumbnail beside the title, not a hero shelf. Displays
// the remote cover through next/image (served same-origin via /_next/image, so it
// can be rasterized on export). During export the parent swaps in `dataUrl` — a
// same-origin PNG data URL — which html-to-image can draw. Missing covers fall
// back to a spine gradient. Colors are explicit oklch literals only.
function SeriesCover({
  index,
  coverUrl,
  dataUrl,
  title,
}: {
  index: number;
  coverUrl: string | null;
  dataUrl?: string;
  title: string;
}) {
  return (
    <div
      className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-sm"
      style={{
        background:
          SHARE_SPINE_BACKGROUNDS[index % SHARE_SPINE_BACKGROUNDS.length],
        outline: `1px solid ${C.lineInverse}`,
        outlineOffset: -1,
      }}
    >
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt=""
          draggable={false}
          style={{
            display: "block",
            height: "100%",
            width: "100%",
            objectFit: "cover",
          }}
        />
      ) : coverUrl ? (
        <Image
          src={coverUrl}
          alt=""
          fill
          sizes="40px"
          data-share-cover-id={String(index)}
          className="object-cover"
        />
      ) : (
        <span
          className="font-display absolute inset-x-1 top-1.5 text-[8px] font-extrabold leading-tight"
          style={{
            color: "oklch(0.96 0.018 284 / 0.84)",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 3,
            overflow: "hidden",
          }}
        >
          {title}
        </span>
      )}
    </div>
  );
}
