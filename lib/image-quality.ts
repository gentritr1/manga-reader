// Global chapter-page image quality preference. Client-only: resolution depends
// on navigator.connection and the value is stored in localStorage, neither of
// which exist during SSR. Kept separate from the per-title reader prefs so it is
// a single account-wide setting.

export type ImageQuality = "auto" | "saver" | "original";

export const IMAGE_QUALITY_KEY = "yomi-image-quality";
export const DEFAULT_IMAGE_QUALITY: ImageQuality = "auto";

export function readImageQuality(): ImageQuality {
  if (typeof localStorage === "undefined") return DEFAULT_IMAGE_QUALITY;
  try {
    const raw = localStorage.getItem(IMAGE_QUALITY_KEY);
    if (raw === "auto" || raw === "saver" || raw === "original") return raw;
  } catch {}
  return DEFAULT_IMAGE_QUALITY;
}

// Persisted only when the user explicitly changes the setting (see the reader's
// change handler); reading never writes, so a fresh visitor leaves no key.
export function writeImageQuality(quality: ImageQuality): void {
  try {
    localStorage.setItem(IMAGE_QUALITY_KEY, quality);
  } catch {}
}

// Effective connection types that "auto" treats as slow enough to warrant the
// compressed data-saver variant. Deliberately excludes "3g": Chrome's
// effectiveType is a rolling throughput estimate that routinely dips to "3g"
// on healthy connections (observed flipping 4g→3g mid-session while streaming
// chapter pages), and acting on it double-fetches the SSR-rendered originals.
const SLOW_EFFECTIVE_TYPES = ["slow-2g", "2g"];

// Resolve a quality preference to a concrete data-saver boolean. Reads
// navigator.connection, so it is client-only; on the server it returns false
// (original quality), which matches the SSR-rendered proxy URLs and avoids a
// hydration mismatch / double fetch.
export function resolveDataSaver(quality: ImageQuality): boolean {
  if (quality === "original") return false;
  if (quality === "saver") return true;
  // auto
  if (typeof navigator === "undefined") return false;
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return SLOW_EFFECTIVE_TYPES.includes(connection.effectiveType ?? "");
}
