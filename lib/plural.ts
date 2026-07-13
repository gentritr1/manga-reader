/**
 * Naive English pluralizer for count labels, e.g. plural(1, "page") → "page",
 * plural(2, "page") → "pages". Extracted so the home rhythm card, the local
 * week-stats line, and the analytics recap share one implementation instead of
 * each re-deriving `count === 1 ? "" : "s"`. Case is preserved from `word`
 * ("Page" → "Pages"). Only handles regular -s plurals — that is all this app's
 * count nouns (page, night, minute, title) need.
 */
export function plural(count: number, word: string) {
  return `${word}${count === 1 ? "" : "s"}`;
}
