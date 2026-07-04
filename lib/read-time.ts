export const DEFAULT_SECONDS_PER_PAGE = 8;

export function normalizeSecondsPerPage(value: number | null | undefined) {
  if (!Number.isFinite(value) || !value) return DEFAULT_SECONDS_PER_PAGE;
  return Math.min(120, Math.max(2, value));
}

export function formatReadTimeEstimate(
  pages: number,
  secondsPerPage: number | null | undefined = DEFAULT_SECONDS_PER_PAGE,
) {
  if (!Number.isFinite(pages) || pages <= 0) return null;

  const seconds = pages * normalizeSecondsPerPage(secondsPerPage);
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `~${minutes} min`;
}
