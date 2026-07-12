// Client-safe ad configuration.
//
// Everything in this module is derived exclusively from NEXT_PUBLIC_* env vars,
// which Next.js inlines into the client bundle. It therefore contains NO server
// secrets (no ADSTERRA_SCRIPT_URL) and is safe to
// import from Client Components. The per-slot ad config used to be computed in
// the force-dynamic /api/internal-ad-preview route and fetched once per slot;
// it now lives here so slots can build their config locally with zero network
// round-trips.

export type AdPlacement = "banner" | "feed" | "rectangle" | "reader";

export type NativeAdConfig = {
  type: "native";
  src: string;
  containerId: string;
  minHeight: number;
};

export type IframeAdConfig = {
  type: "iframe";
  key: string;
  src: string;
  width: number;
  height: number;
};

export type AdConfig = NativeAdConfig | IframeAdConfig;

export function normalizeScriptUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const srcMatch = trimmed.match(/\bsrc=["']([^"']+)["']/i);
  const candidate = srcMatch?.[1] ?? trimmed;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function normalizeKey(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/^\/([^/]+)\/invoke\.js$/);
    return match?.[1] ?? null;
  } catch {
    return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null;
  }
}

function iframeConfig(
  key: string | null,
  size: { width: number; height: number },
): IframeAdConfig | null {
  if (!key) return null;

  return {
    type: "iframe",
    key,
    src: `https://www.highperformanceformat.com/${key}/invoke.js`,
    ...size,
  };
}

/**
 * True when `placement` has a usable ad config (ads enabled AND the placement's
 * NEXT_PUBLIC_* keys are present/valid). This is exactly the null-decision
 * AdsterraAdSlot already makes internally, surfaced so wrappers can avoid
 * painting an empty bordered box around a slot that will render nothing — even
 * for an ad-enabled account whose slot keys aren't configured.
 */
export function isAdSlotConfigured(placement: AdPlacement): boolean {
  return placementConfig(placement) !== null;
}

export function placementConfig(placement: AdPlacement): AdConfig | null {
  if (process.env.NEXT_PUBLIC_ADS_ENABLED !== "true") return null;

  switch (placement) {
    case "banner":
      return iframeConfig(normalizeKey(process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY), {
        width: 728,
        height: 90,
      });
    case "feed": {
      const src = normalizeScriptUrl(
        process.env.NEXT_PUBLIC_ADSTERRA_BROWSE_FEED_SRC ??
          process.env.NEXT_PUBLIC_ADSTERRA_CHAPTER_START_SRC,
      );
      const containerId =
        process.env.NEXT_PUBLIC_ADSTERRA_BROWSE_FEED_CONTAINER?.trim() ||
        process.env.NEXT_PUBLIC_ADSTERRA_CHAPTER_START_CONTAINER?.trim();

      if (!src || !containerId) return null;

      return {
        type: "native",
        src,
        containerId,
        minHeight: 180,
      };
    }
    case "rectangle":
    case "reader":
      return iframeConfig(normalizeKey(process.env.NEXT_PUBLIC_ADSTERRA_CHAPTER_END_KEY), {
        width: 300,
        height: 250,
      });
  }
}
