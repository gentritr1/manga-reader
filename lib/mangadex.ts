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

export interface TagGroup {
  label: string;
  tags: { name: string; id: string }[];
}

// Canonical MangaDex tags (from GET /manga/tag), grouped for the browse filters.
export const TAG_GROUPS: TagGroup[] = [
  {
    label: "Genres",
    tags: [
      { name: "Action", id: "391b0423-d847-456f-aff0-8b0cfc03066b" },
      { name: "Adventure", id: "87cc87cd-a395-47af-b27a-93258283bbc6" },
      { name: "Boys' Love", id: "5920b825-4181-4a17-beeb-9918b0ff7a30" },
      { name: "Comedy", id: "4d32cc48-9f00-4cca-9b5a-a839f0764984" },
      { name: "Crime", id: "5ca48985-9a9d-4bd8-be29-80dc0303db72" },
      { name: "Drama", id: "b9af3a63-f058-46de-a9a0-e0c13906197a" },
      { name: "Fantasy", id: "cdc58593-87dd-415e-bbc0-2ec27bf404cc" },
      { name: "Girls' Love", id: "a3c67850-4684-404e-9b7f-c69850ee5da6" },
      { name: "Historical", id: "33771934-028e-4cb3-8744-691e866a923e" },
      { name: "Horror", id: "cdad7e68-1419-41dd-bdce-27753074a640" },
      { name: "Isekai", id: "ace04997-f6bd-436e-b261-779182193d3d" },
      { name: "Magical Girls", id: "81c836c9-914a-4eca-981a-560dad663e73" },
      { name: "Mecha", id: "50880a9d-5440-4732-9afb-8f457127e836" },
      { name: "Medical", id: "c8cbe35b-1b2b-4a3f-9c37-db84c4514856" },
      { name: "Mystery", id: "ee968100-4191-4968-93d3-f82d72be7e46" },
      { name: "Philosophical", id: "b1e97889-25b4-4258-b28b-cd7f4d28ea9b" },
      { name: "Psychological", id: "3b60b75c-a2d7-4860-ab56-05f391bb889c" },
      { name: "Romance", id: "423e2eae-a7a2-4a8b-ac03-a8351462d71d" },
      { name: "Sci-Fi", id: "256c8bd9-4904-4360-bf4f-508a76d67183" },
      { name: "Slice of Life", id: "e5301a23-ebd9-49dd-a0cb-2add944c7fe9" },
      { name: "Sports", id: "69964a64-2f90-4d33-beeb-f3ed2875eb4c" },
      { name: "Superhero", id: "7064a261-a137-4d3a-8848-2d385de3a99c" },
      { name: "Thriller", id: "07251805-a27e-4d59-b488-f0bfbec15168" },
      { name: "Tragedy", id: "f8f62932-27da-4fe4-8ee1-6779a8c5edba" },
      { name: "Wuxia", id: "acc803a4-c95a-4c22-86fc-eb6b582d82a2" },
    ],
  },
  {
    label: "Themes",
    tags: [
      { name: "Aliens", id: "e64f6742-c834-471d-8d72-dd51fc02b835" },
      { name: "Animals", id: "3de8c75d-8ee3-48ff-98ee-e20a65c86451" },
      { name: "Cooking", id: "ea2bc92d-1c26-4930-9b7c-d5c0dc1b6869" },
      { name: "Crossdressing", id: "9ab53f92-3eed-4e9b-903a-917c86035ee3" },
      { name: "Delinquents", id: "da2d50ca-3018-4cc0-ac7a-6b7d472a29ea" },
      { name: "Demons", id: "39730448-9a5f-48a2-85b0-a70db87b1233" },
      { name: "Genderswap", id: "2bd2e8d0-f146-434a-9b51-fc9ff2c5fe6a" },
      { name: "Ghosts", id: "3bb26d85-09d5-4d2e-880c-c34b974339e9" },
      { name: "Gyaru", id: "fad12b5e-68ba-460e-b933-9ae8318f5b65" },
      { name: "Harem", id: "aafb99c1-7f60-43fa-b75f-fc9502ce29c7" },
      { name: "Mafia", id: "85daba54-a71c-4554-8a28-9901a8b0afad" },
      { name: "Magic", id: "a1f53773-c69a-4ce5-8cab-fffcd90b1565" },
      { name: "Martial Arts", id: "799c202e-7daa-44eb-9cf7-8a3c0441531e" },
      { name: "Military", id: "ac72833b-c4e9-4878-b9db-6c8a4a99444a" },
      { name: "Monster Girls", id: "dd1f77c5-dea9-4e2b-97ae-224af09caf99" },
      { name: "Monsters", id: "36fd93ea-e8b8-445e-b836-358f02b3d33d" },
      { name: "Music", id: "f42fbf9e-188a-447b-9fdc-f19dc1e4d685" },
      { name: "Ninja", id: "489dd859-9b61-4c37-af75-5b18e88daafc" },
      { name: "Office Workers", id: "92d6d951-ca5e-429c-ac78-451071cbf064" },
      { name: "Police", id: "df33b754-73a3-4c54-80e6-1a74a8058539" },
      { name: "Post-Apocalyptic", id: "9467335a-1b83-4497-9231-765337a00b96" },
      { name: "Reincarnation", id: "0bc90acb-ccc1-44ca-a34a-b9f3a73259d0" },
      { name: "Reverse Harem", id: "65761a2a-415e-47f3-bef2-a9dababba7a6" },
      { name: "Samurai", id: "81183756-1453-4c81-aa9e-f6e1b63be016" },
      { name: "School Life", id: "caaa44eb-cd40-4177-b930-79d3ef2afe87" },
      { name: "Supernatural", id: "eabc5b4c-6aff-42f3-b657-3e90cbd00b75" },
      { name: "Survival", id: "5fff9cde-849c-4d78-aab0-0d52b2ee1d25" },
      { name: "Time Travel", id: "292e862b-2d17-4062-90a2-0356caa4ae27" },
      { name: "Vampires", id: "d7d1730f-6eb0-4ba6-9437-602cac38664c" },
      { name: "Video Games", id: "9438db5a-7e2a-4ac0-b39e-e0d95a34b8a8" },
      { name: "Villainess", id: "d14322ac-4d6f-4e9b-afd9-629d5f4d8a41" },
      { name: "Virtual Reality", id: "8c86611e-fab7-4986-9dec-d1a2f44acdd5" },
      { name: "Zombies", id: "631ef465-9aba-4afb-b0fc-ea10efe274a8" },
    ],
  },
  {
    label: "Format",
    tags: [
      { name: "Long Strip", id: "3e2b8dae-350e-4ab8-a8ce-016e844b9f0d" },
      { name: "Web Comic", id: "e197df38-d0e7-43b5-9b09-2842d0c326dd" },
      { name: "Full Color", id: "f5ba408b-0e7a-484d-8d49-4e9125ac96de" },
      { name: "Official Colored", id: "320831a8-4026-470b-94f6-8353740e6f04" },
      { name: "Oneshot", id: "0234a31e-a729-4e28-9d6a-3f87c4966b9e" },
      { name: "Award Winning", id: "0a39b5a1-b235-4886-a747-1d05d216532d" },
      { name: "4-Koma", id: "b11fda93-8f1d-4bef-b2ed-8803d3733170" },
      { name: "Doujinshi", id: "b13b2a48-c720-44a9-9c77-39c9979373fb" },
      { name: "Adaptation", id: "f4122d1c-3b44-44d0-9936-ff7502c39ad3" },
      { name: "Anthology", id: "51d83883-4103-437c-b4b1-731cb73d786c" },
    ],
  },
];

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
  const rawLimit = Math.trunc(params.limit ?? 24);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 100)
    : 24;
  const rawOffset = Math.trunc(params.offset ?? 0);
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
  q.set("limit", String(limit));
  q.set("offset", String(offset));
  q.append("includes[]", "cover_art");
  q.append("includes[]", "author");
  for (const cr of ["safe", "suggestive"]) q.append("contentRating[]", cr);
  q.append("availableTranslatedLanguage[]", "en");
  q.set("hasAvailableChapters", "true"); // drop titles with no chapters at all

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
