"use client";

import { useEffect, useState } from "react";
import { useLocalWeekStats } from "@/lib/use-local-week-stats";

// An editorial "Your reading rhythm" card near the Continue rail. Numbers come
// from local reading progress (see lib/local-reading-stats.ts) so it works for
// anonymous readers and adds no network requests. BRAND rule: never shame a
// broken streak — when there is no current rhythm we simply show this week's
// nights, never "streak lost". Renders nothing without history (no reserved
// space, no CLS).

const WEEKLY_GOAL_STORAGE_KEY = "yomi-weekly-goal";
const DEFAULT_WEEKLY_GOAL = 25;

/**
 * The reader's weekly page goal, read from localStorage after mount. Returns
 * null until mounted so SSR and the first client paint stay identical (no
 * hydration flash). Mirrors the useLocalWeekStats mount-effect pattern (a
 * deferred read via setTimeout — not rAF) so the read stays a macrotask off the
 * render; any malformed / non-positive value falls back to the default rather
 * than breaking the goal math.
 */
function useWeeklyGoal(): number | null {
  const [goal, setGoal] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let resolved = DEFAULT_WEEKLY_GOAL;
      try {
        const raw = window.localStorage.getItem(WEEKLY_GOAL_STORAGE_KEY);
        const parsed = raw == null ? NaN : Math.trunc(Number(raw));
        if (Number.isFinite(parsed) && parsed > 0) resolved = parsed;
      } catch {
        // Ignore storage errors — keep the default goal.
      }
      setGoal(resolved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return goal;
}

function plural(count: number, word: string) {
  return `${word}${count === 1 ? "" : "s"}`;
}

/** A single line-art flourish for the card's top-right. Decorative only. */
function RhythmFlourish() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 48"
      fill="none"
      className="pointer-events-none absolute right-4 top-4 hidden h-8 w-20 opacity-60 sm:block"
    >
      {/* A minimal mountain range — thin line-art in the subtle line token so it
          stays quiet in both themes. */}
      <path
        d="M2 42 L28 16 L44 32 L70 6 L90 30 L104 20 L118 42"
        stroke="var(--line-subtle)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The circular streak emblem. Built as one inline SVG: two thin rings, the
 * ring-band label set on two arcs via <textPath> (top = "KEEP IT UP", bottom =
 * the streak semantic), and the streak number + flame layered as crisp HTML on
 * top so the display face and lucide-quality mark render sharp at any DPI.
 *
 * Arc geometry (center 80,80): both text paths run from the left point
 * (80-R, 80) to the right point (80+R, 80). The top path uses sweep-flag 1
 * (clockwise, over the top) so glyphs sit upright reading left-to-right; the
 * bottom path uses sweep-flag 0 (counter-clockwise, under the bottom) so its
 * glyphs are also upright and read left-to-right.
 */
function StreakBadge({
  value,
  bottomLabel,
}: {
  value: string;
  bottomLabel: string;
}) {
  const R = 65; // text baseline radius, sits mid-band between the two rings

  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden="true">
        <defs>
          <path id="rhythm-arc-top" d={`M ${80 - R},80 A ${R},${R} 0 0 1 ${80 + R},80`} />
          <path
            id="rhythm-arc-bottom"
            d={`M ${80 - R},80 A ${R},${R} 0 0 0 ${80 + R},80`}
          />
        </defs>

        <circle
          cx="80"
          cy="80"
          r="76"
          fill="none"
          stroke="var(--line-subtle)"
          strokeWidth="1.5"
        />
        <circle
          cx="80"
          cy="80"
          r="56"
          fill="none"
          stroke="var(--line-subtle)"
          strokeWidth="1"
        />

        <text
          fill="var(--content-secondary)"
          style={{
            fontSize: "9.5px",
            letterSpacing: "2.5px",
            fontWeight: 600,
          }}
        >
          <textPath href="#rhythm-arc-top" startOffset="50%" textAnchor="middle">
            KEEP IT UP
          </textPath>
        </text>
        <text
          fill="var(--content-secondary)"
          style={{
            fontSize: "9.5px",
            letterSpacing: "2.5px",
            fontWeight: 600,
          }}
        >
          <textPath
            href="#rhythm-arc-bottom"
            startOffset="50%"
            textAnchor="middle"
          >
            {bottomLabel}
          </textPath>
        </text>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl font-extrabold leading-none tracking-tight tabular-nums text-content-primary">
          {value}
        </span>
        {/* Custom filled flame: a single solid path reads as a clean violet mark
            at ~18px, where lucide's stroke-detail flame would muddy. */}
        <svg
          viewBox="0 0 24 24"
          className="mt-2 h-[18px] w-[18px] fill-brand-primary"
          aria-hidden="true"
        >
          <path d="M12 2c2.4 3 5 5.4 5 9a5 5 0 0 1-10 0c0-1.5.6-2.9 1.7-4.1C9.6 8.6 11 6.6 12 2z" />
        </svg>
      </div>
    </div>
  );
}

function StatColumn({
  value,
  label,
  className = "",
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col ${className}`}>
      <span className="font-display text-lg font-bold leading-none tracking-tight tabular-nums text-content-primary sm:text-xl">
        {value}
      </span>
      <span className="mt-1.5 text-[11px] font-medium uppercase leading-tight tracking-wide text-content-secondary">
        {label}
      </span>
    </div>
  );
}

export function ReadingStats() {
  const stats = useLocalWeekStats();
  const goal = useWeeklyGoal();

  // Render null until BOTH local sources resolve (no hydration flash / CLS) and
  // when there is no history.
  if (!stats || goal === null || !stats.hasHistory) return null;

  const hasRhythm = stats.rhythmNights > 0;
  const streakValue = hasRhythm
    ? String(stats.rhythmNights)
    : String(stats.nightsThisWeek);
  const bottomLabel = hasRhythm ? "NIGHT STREAK" : "NIGHTS THIS WEEK";

  // A reader with only stale history (nothing this week and no live rhythm) has
  // nothing warm to show — stay quiet rather than surface zeros.
  if (!hasRhythm && stats.nightsThisWeek === 0) return null;

  const pages = stats.pagesThisWeek;
  const minutes = stats.minutesThisWeek;

  // Goal math. Percent is clamped to [0, 100] for both the label and the bar;
  // when the goal is met the microcopy switches to a warm, pressure-free line
  // rather than an over-100% figure.
  const goalMet = pages >= goal;
  const percent = Math.min(100, Math.max(0, Math.round((pages / goal) * 100)));
  const goalMicrocopy = goalMet
    ? `goal met — ${pages.toLocaleString()} ${plural(pages, "page")}`
    : `${pages.toLocaleString()} / ${goal.toLocaleString()} pages`;

  return (
    <section
      aria-label="Your reading this week"
      className="relative overflow-hidden rounded-card border border-line-subtle bg-surface-panel"
    >
      <div className="relative flex flex-col items-center gap-6 p-5 sm:flex-row sm:gap-8 sm:p-6">
        <RhythmFlourish />

        <StreakBadge value={streakValue} bottomLabel={bottomLabel} />

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h2 className="font-display text-xl font-bold tracking-tight text-content-primary sm:text-2xl">
            Your reading rhythm
          </h2>
          <p className="mt-1 text-sm text-content-secondary">
            Small steps, big stories.
          </p>

          <div className="mt-5 flex items-stretch text-left">
            <StatColumn
              value={pages.toLocaleString()}
              label={`${plural(pages, "Page")} this week`}
              className="pr-4 sm:pr-5"
            />
            <StatColumn
              value={minutes.toLocaleString()}
              label={`${plural(minutes, "Minute")} this week`}
              className="border-l border-line-subtle px-4 sm:px-5"
            />

            <div className="flex min-w-0 flex-1 flex-col border-l border-line-subtle pl-4 sm:pl-5">
              <span className="font-display text-lg font-bold leading-none tracking-tight tabular-nums text-content-primary sm:text-xl">
                {percent}%
              </span>
              <span className="mt-1.5 text-[11px] font-medium uppercase leading-tight tracking-wide text-content-secondary">
                Weekly goal
              </span>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label="Weekly reading goal"
                className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-surface-muted"
              >
                <div
                  className="h-full rounded-full bg-brand-primary"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="mt-1.5 text-[11px] leading-tight text-content-secondary">
                {goalMicrocopy}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
