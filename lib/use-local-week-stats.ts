"use client";

import { useEffect, useState } from "react";
import {
  computeLocalWeekStats,
  readAllLocalProgress,
  type LocalWeekStats,
} from "@/lib/local-reading-stats";

/**
 * Reads local reading progress after mount and returns the "my week" stats.
 * Returns null until mounted so SSR and the first client paint are identical
 * (no hydration flash / CLS). Consumers should render nothing while null or when
 * `hasHistory` is false.
 */
export function useLocalWeekStats(): LocalWeekStats | null {
  const [stats, setStats] = useState<LocalWeekStats | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStats(computeLocalWeekStats(readAllLocalProgress()));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return stats;
}
