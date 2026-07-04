"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export interface ReadingRhythmData {
  rhythmDays: number;
  readToday: boolean;
  tickedTodayRhythmDays: number | null;
  averageSecondsPerPage: number | null;
}

const RHYTHM_QUERY_KEY = ["reading-rhythm"] as const;

async function fetchReadingRhythm(
  timezoneOffset: number,
): Promise<ReadingRhythmData | null> {
  const params = new URLSearchParams({ tz: String(timezoneOffset) });
  const res = await fetch(`/api/analytics/streak?${params.toString()}`);
  if (!res.ok) return null;
  return (await res.json()) as ReadingRhythmData;
}

export function useReadingRhythm({ enabled = true } = {}) {
  const { status } = useSession();
  const [timezoneOffset, setTimezoneOffset] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTimezoneOffset(new Date().getTimezoneOffset());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return useQuery({
    queryKey:
      timezoneOffset === null
        ? [...RHYTHM_QUERY_KEY, "pending"]
        : [...RHYTHM_QUERY_KEY, timezoneOffset],
    queryFn: () => fetchReadingRhythm(timezoneOffset ?? 0),
    enabled: enabled && status === "authenticated" && timezoneOffset !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function useMarkReadingRhythmReadToday() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.setQueriesData<ReadingRhythmData | null>(
      { queryKey: RHYTHM_QUERY_KEY },
      (current) => {
        if (!current || current.readToday) return current;
        return {
          ...current,
          rhythmDays:
            current.tickedTodayRhythmDays ?? Math.max(1, current.rhythmDays),
          readToday: true,
          tickedTodayRhythmDays: null,
        };
      },
    );
  }, [queryClient]);
}
