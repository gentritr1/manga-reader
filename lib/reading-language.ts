// Shared reading-language preference (global, default "en").
//
// This is a PURE, isomorphic module (no next/headers, no "use client") so it can
// be imported from the browse client, the /api/md proxy, and server components
// alike. Server components read the raw cookie value themselves via
// `cookies()` (next/headers) and pass it through `normalizeReadingLanguage`.
//
// Storage flow (see the browse Filters language picker):
//   - localStorage `yomi-language`  → the client source of truth for the picker.
//   - cookie       `yomi-language`  → written alongside so SERVER components
//                                     (manga detail + reader neighbor feeds) can
//                                     read the same preference via cookies().
// With no cookie/localStorage the effective language is "en" — identical to the
// pre-PR-12 hardcoded behavior, so existing users see zero change.

export const READING_LANGUAGE_COOKIE = "yomi-language";
export const READING_LANGUAGE_STORAGE_KEY = "yomi-language";
export const DEFAULT_READING_LANGUAGE = "en";

export interface ReadingLanguageOption {
  /** MangaDex translatedLanguage code. */
  code: string;
  label: string;
}

// Curated set of well-supported MangaDex translation languages. Chinese is split
// into Simplified (zh) and Traditional (zh-hk): the preference is a single code,
// so rather than special-casing a multi-code "Chinese" entry through the whole
// availableTranslatedLanguage/translatedLanguage plumbing, each variant is its
// own selectable option (using the two codes the brief called out, zh / zh-hk).
export const READING_LANGUAGES: ReadingLanguageOption[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "pt-br", label: "Portuguese (BR)" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "ru", label: "Russian" },
  { code: "pl", label: "Polish" },
  { code: "id", label: "Indonesian" },
  { code: "vi", label: "Vietnamese" },
  { code: "th", label: "Thai" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese (Simplified)" },
  { code: "zh-hk", label: "Chinese (Traditional)" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
];

const SUPPORTED_CODES = new Set(READING_LANGUAGES.map((l) => l.code));

/** True when `code` is one of the curated MangaDex language codes. */
export function isSupportedReadingLanguage(code: string | null | undefined): boolean {
  return typeof code === "string" && SUPPORTED_CODES.has(code);
}

/** Coerce any value to a supported language code, falling back to English. */
export function normalizeReadingLanguage(
  value: string | null | undefined,
): string {
  return isSupportedReadingLanguage(value)
    ? (value as string)
    : DEFAULT_READING_LANGUAGE;
}

/** Read the picker's stored language (client only). Returns "en" during SSR. */
export function readReadingLanguage(): string {
  if (typeof window === "undefined") return DEFAULT_READING_LANGUAGE;
  try {
    return normalizeReadingLanguage(
      localStorage.getItem(READING_LANGUAGE_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_READING_LANGUAGE;
  }
}

/**
 * Persist the language for both the client (localStorage, drives the picker) and
 * the server (cookie, read by server components via cookies()). Setting English
 * clears the cookie so the "no cookie = English" default path is exercised.
 */
export function writeReadingLanguage(code: string): void {
  if (typeof window === "undefined") return;
  const value = normalizeReadingLanguage(code);
  try {
    localStorage.setItem(READING_LANGUAGE_STORAGE_KEY, value);
  } catch {}
  const oneYear = 60 * 60 * 24 * 365;
  if (value === DEFAULT_READING_LANGUAGE) {
    // Drop the cookie so server components fall back to the English default.
    document.cookie = `${READING_LANGUAGE_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } else {
    document.cookie = `${READING_LANGUAGE_COOKIE}=${encodeURIComponent(
      value,
    )}; path=/; max-age=${oneYear}; samesite=lax`;
  }
}
