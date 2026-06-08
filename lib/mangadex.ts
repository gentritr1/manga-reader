// Pure, isomorphic MangaDex helpers and types (no fetching here).
// Server fetching lives in mangadex-server.ts; client fetching in mangadex-client.ts.

export const MD_API = "https://api.mangadex.org";
export const MD_UPLOADS = "https://uploads.mangadex.org";

export type MangaStatus = "ongoing" | "completed" | "hiatus" | "cancelled";
export type ContentRating = "safe" | "suggestive" | "erotica" | "pornographic";

export interface SimpleManga {
  id: string;
  title: string;
  description: string;
  coverFileName: string | null;
  status: MangaStatus | null;
  year: number | null;
  contentRating: ContentRating | null;
  tags: string[];
  author: string | null;
  lastChapter: string | null;
}

export interface SimpleChapter {
  id: string;
  chapter: string | null;
  volume: string | null;
  title: string | null;
  pages: number;
  language: string;
  publishedAt: string;
  scanlationGroup: string | null;
  /** Set when the chapter is hosted off-site (official/licensed releases). */
  externalUrl: string | null;
}

/** A chapter is readable in-app only when it has pages and no external host. */
export function isReadable(c: SimpleChapter): boolean {
  return c.pages > 0 && !c.externalUrl;
}

export interface ChapterPages {
  baseUrl: string;
  hash: string;
  data: string[]; // full-quality page filenames
  dataSaver: string[]; // compressed page filenames
}

interface MdEntity {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
}

function pickLocalized(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const map = value as Record<string, string>;
  return map.en ?? map["ja-ro"] ?? Object.values(map)[0] ?? "";
}

export function simplifyManga(raw: MdEntity): SimpleManga {
  const attrs = (raw.attributes ?? {}) as Record<string, unknown>;
  const rels = ((raw as unknown as { relationships?: MdEntity[] }).relationships ??
    []) as MdEntity[];

  const cover = rels.find((r) => r.type === "cover_art");
  const author = rels.find((r) => r.type === "author");
  const tags = (attrs.tags as MdEntity[] | undefined) ?? [];

  return {
    id: raw.id,
    title: pickLocalized(attrs.title) || "Untitled",
    description: pickLocalized(attrs.description),
    coverFileName: (cover?.attributes?.fileName as string) ?? null,
    status: (attrs.status as MangaStatus) ?? null,
    year: (attrs.year as number) ?? null,
    contentRating: (attrs.contentRating as ContentRating) ?? null,
    tags: tags
      .map((t) => pickLocalized(t.attributes?.name))
      .filter(Boolean)
      .slice(0, 8),
    author: (author?.attributes?.name as string) ?? null,
    lastChapter: (attrs.lastChapter as string) || null,
  };
}

export function simplifyChapter(raw: MdEntity): SimpleChapter {
  const attrs = (raw.attributes ?? {}) as Record<string, unknown>;
  const rels = ((raw as unknown as { relationships?: MdEntity[] }).relationships ??
    []) as MdEntity[];
  const group = rels.find((r) => r.type === "scanlation_group");

  return {
    id: raw.id,
    chapter: (attrs.chapter as string) ?? null,
    volume: (attrs.volume as string) ?? null,
    title: (attrs.title as string) || null,
    pages: (attrs.pages as number) ?? 0,
    language: (attrs.translatedLanguage as string) ?? "en",
    publishedAt: (attrs.publishAt as string) ?? "",
    scanlationGroup: (group?.attributes?.name as string) ?? null,
    externalUrl: (attrs.externalUrl as string) || null,
  };
}

/** Cover thumbnail URL. size: 256 or 512 for thumbs, undefined for original. */
export function coverUrl(
  mangaId: string,
  fileName: string | null,
  size?: 256 | 512,
): string | null {
  if (!fileName) return null;
  const suffix = size ? `.${size}.jpg` : "";
  return `${MD_UPLOADS}/covers/${mangaId}/${fileName}${suffix}`;
}

/** Build a single page image URL from an at-home server response. */
export function pageImageUrl(
  pages: ChapterPages,
  index: number,
  dataSaver = false,
): string {
  const folder = dataSaver ? "data-saver" : "data";
  const files = dataSaver ? pages.dataSaver : pages.data;
  return `${pages.baseUrl}/${folder}/${pages.hash}/${files[index]}`;
}

export const GENRE_TAGS: Record<string, string> = {
  Action: "391b0423-d847-456f-aff0-8b0cfc03066b",
  Adventure: "87cc87cd-a395-47af-b27a-93258283bbc6",
  Comedy: "4d32cc48-9f00-4cca-9b5a-a839f0764984",
  Drama: "b9af3a63-f058-46de-a9a0-e0c13906197a",
  Fantasy: "cdc58593-87dd-415e-bbc0-2ec27bf404cc",
  Horror: "cdad7e68-1419-41dd-bdce-27753074a640",
  Isekai: "ace04997-f6bd-436e-b261-779182193d3d",
  Mystery: "07251805-a27e-4d59-b488-f0bfbec15168",
  Romance: "423e2eae-a7a2-4a8b-ac03-a8351462d71d",
  "Sci-Fi": "256c8bd9-4904-4360-bf4f-508a76d67183",
  "Slice of Life": "e5301a23-ebd9-49dd-a0cb-2add944c7fe7",
  Sports: "69964a64-2f90-4d33-beeb-f3ed2875eb4c",
  Supernatural: "eabc5b4c-6aff-42f3-b657-3e90cbd00b75",
  Thriller: "07251805-a27e-4d59-b488-f0bfbec15168",
};

export type SortOption =
  | "relevance"
  | "latest"
  | "popular"
  | "rating"
  | "title";

export interface SearchParams {
  title?: string;
  genres?: string[]; // tag UUIDs
  status?: MangaStatus;
  sort?: SortOption;
  limit?: number;
  offset?: number;
}

/** Build the query string for a /manga search (used by both server and client). */
export function buildMangaQuery(params: SearchParams): string {
  const q = new URLSearchParams();
  const limit = params.limit ?? 24;
  q.set("limit", String(limit));
  q.set("offset", String(params.offset ?? 0));
  q.append("includes[]", "cover_art");
  q.append("includes[]", "author");
  for (const cr of ["safe", "suggestive"]) q.append("contentRating[]", cr);
  q.append("availableTranslatedLanguage[]", "en");

  if (params.title) q.set("title", params.title);
  if (params.status) q.append("status[]", params.status);
  for (const g of params.genres ?? []) q.append("includedTags[]", g);

  switch (params.sort) {
    case "latest":
      q.set("order[latestUploadedChapter]", "desc");
      break;
    case "popular":
      q.set("order[followedCount]", "desc");
      break;
    case "rating":
      q.set("order[rating]", "desc");
      break;
    case "title":
      q.set("order[title]", "asc");
      break;
    default:
      if (!params.title) q.set("order[followedCount]", "desc");
  }
  return q.toString();
}
