"use client";

import { useLocalWeekStats } from "@/lib/use-local-week-stats";

// A quiet stats strip near the Continue rail. Numbers come from local reading
// progress (see lib/local-reading-stats.ts) so it works for anonymous readers
// and adds no network requests. BRAND rule: never shame a broken streak — when
// there is no current rhythm we simply show this week's nights, never
// "streak lost". Renders nothing without history (no reserved space, no CLS).

function StatItem({
  value,
  label,
  emphasis = false,
}: {
  value: string;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span
        className={
          emphasis
            ? "font-display text-xl font-bold leading-none tracking-tight text-brand-primary sm:text-2xl"
            : "font-display text-xl font-bold leading-none tracking-tight text-content-primary sm:text-2xl"
        }
      >
        {value}
      </span>
      <span className="mt-1.5 truncate text-xs font-medium text-content-secondary">
        {label}
      </span>
    </div>
  );
}

export function ReadingStats() {
  const stats = useLocalWeekStats();

  // Render null until data resolves or when there is no history.
  if (!stats || !stats.hasHistory) return null;

  const hasRhythm = stats.rhythmNights > 0;
  const streakValue = hasRhythm
    ? String(stats.rhythmNights)
    : String(stats.nightsThisWeek);
  const streakLabel = hasRhythm
    ? `night${stats.rhythmNights === 1 ? "" : "s"} in a row`
    : `night${stats.nightsThisWeek === 1 ? "" : "s"} this week`;

  // A reader with only stale history (nothing this week and no live rhythm) has
  // nothing warm to show — stay quiet rather than surface zeros.
  if (!hasRhythm && stats.nightsThisWeek === 0) return null;

  return (
    <section
      aria-label="Your reading this week"
      className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-card border border-line-subtle bg-surface-panel px-5 py-4"
    >
      <StatItem value={streakValue} label={streakLabel} emphasis />
      {stats.pagesThisWeek > 0 && (
        <StatItem
          value={stats.pagesThisWeek.toLocaleString()}
          label={`page${stats.pagesThisWeek === 1 ? "" : "s"} this week`}
        />
      )}
      {stats.minutesThisWeek > 0 && (
        <StatItem
          value={`${stats.minutesThisWeek}`}
          label={`minute${stats.minutesThisWeek === 1 ? "" : "s"} this week`}
        />
      )}
    </section>
  );
}
