const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;
const MAX_TIMEZONE_OFFSET_MINUTES = 14 * 60;

export interface ReadingRhythmSummary {
  rhythmDays: number;
  readToday: boolean;
  tickedTodayRhythmDays: number | null;
}

export function normalizeTimezoneOffset(offsetMinutes: number) {
  if (!Number.isFinite(offsetMinutes)) return 0;
  return Math.max(
    -MAX_TIMEZONE_OFFSET_MINUTES,
    Math.min(MAX_TIMEZONE_OFFSET_MINUTES, Math.trunc(offsetMinutes)),
  );
}

function localDayKey(input: Date | number, timezoneOffsetMinutes: number) {
  const time = input instanceof Date ? input.getTime() : input;
  const localTime = time - timezoneOffsetMinutes * MS_PER_MINUTE;
  return Math.floor(localTime / MS_PER_DAY);
}

function graceAllowance(readDaysCounted: number) {
  return Math.max(1, Math.ceil((readDaysCounted + 1) / 7));
}

function countRhythmEndingAt(readDays: Set<number>, anchorDay: number) {
  if (!readDays.has(anchorDay)) return 0;

  const days = Array.from(readDays)
    .filter((day) => day <= anchorDay)
    .sort((a, b) => b - a);

  let count = 0;
  let graceUsed = 0;
  let previousDay: number | null = null;

  for (const day of days) {
    if (previousDay === null) {
      count = 1;
      previousDay = day;
      continue;
    }

    const gap = previousDay - day;
    if (gap === 1) {
      count += 1;
      previousDay = day;
      continue;
    }

    if (gap === 2 && graceUsed < graceAllowance(count)) {
      graceUsed += 1;
      count += 1;
      previousDay = day;
      continue;
    }

    break;
  }

  return count;
}

export function calculateReadingRhythm(
  readDates: Array<Date | number>,
  timezoneOffsetMinutes: number,
  now: Date | number = Date.now(),
): ReadingRhythmSummary {
  const normalizedOffset = normalizeTimezoneOffset(timezoneOffsetMinutes);
  const today = localDayKey(now, normalizedOffset);
  const readDays = new Set(
    readDates.map((date) => localDayKey(date, normalizedOffset)),
  );
  const readToday = readDays.has(today);
  const latestReadDay = Math.max(...readDays, Number.NEGATIVE_INFINITY);

  const rhythmDays =
    latestReadDay >= today - 2
      ? countRhythmEndingAt(readDays, latestReadDay)
      : 0;

  if (readToday) {
    return {
      rhythmDays,
      readToday,
      tickedTodayRhythmDays: null,
    };
  }

  const readDaysWithToday = new Set(readDays);
  readDaysWithToday.add(today);

  return {
    rhythmDays,
    readToday,
    tickedTodayRhythmDays: countRhythmEndingAt(readDaysWithToday, today),
  };
}
