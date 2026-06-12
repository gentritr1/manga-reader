"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { cn } from "@/lib/utils";

const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
const MOBILE_BANNER_QUERY = "(max-width: 767px)";

export type AdPlacement = "chapter-end" | "banner" | "browse-feed";

type NativeAdConfig = {
  type: "native";
  src?: string;
  containerId?: string;
  minHeight: number;
};

type IframeUnit = {
  key?: string;
  width: number;
  height: number;
};

type IframeAdConfig = {
  type: "iframe";
  desktop: IframeUnit;
  mobile?: IframeUnit;
};

type AdConfig = NativeAdConfig | IframeAdConfig;

type AtOptions = {
  key: string;
  format: "iframe";
  height: number;
  width: number;
  params: Record<string, never>;
};

const iframeSrc = (key?: string) =>
  key ? `https://www.highperformanceformat.com/${key}/invoke.js` : undefined;

// Adsterra slots, configured in .env.local. Native ads need a script URL and
// container id; iframe ads need the unit key and dimensions from Adsterra.
const CONFIG: Record<AdPlacement, AdConfig> = {
  "chapter-end": {
    type: "iframe",
    desktop: {
      key: process.env.NEXT_PUBLIC_ADSTERRA_CHAPTER_END_KEY,
      width: 300,
      height: 250,
    },
  },
  banner: {
    type: "iframe",
    desktop: {
      key: process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY,
      width: 728,
      height: 90,
    },
    mobile: {
      key: process.env.NEXT_PUBLIC_ADSTERRA_MOBILE_BANNER_KEY,
      width: 320,
      height: 50,
    },
  },
  "browse-feed": {
    type: "native",
    src:
      process.env.NEXT_PUBLIC_ADSTERRA_BROWSE_FEED_SRC ??
      process.env.NEXT_PUBLIC_ADSTERRA_CHAPTER_START_SRC,
    containerId:
      process.env.NEXT_PUBLIC_ADSTERRA_BROWSE_FEED_CONTAINER ??
      process.env.NEXT_PUBLIC_ADSTERRA_CHAPTER_START_CONTAINER,
    minHeight: 180,
  },
};

const LABELS: Record<AdPlacement, string> = {
  "chapter-end": "Advertisement",
  banner: "Advertisement",
  "browse-feed": "Advertisement",
};

function useIsMobileBanner() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_BANNER_QUERY);
    const update = () => setIsMobile(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function selectIframeUnit(config: IframeAdConfig, isMobile: boolean | null) {
  if (!config.mobile) return config.desktop;
  if (isMobile === null) return undefined;
  return isMobile ? config.mobile : config.desktop;
}

export function AdSlot({
  placement,
  className,
}: {
  placement: AdPlacement;
  className?: string;
}) {
  const config = CONFIG[placement];
  const isMobile = useIsMobileBanner();
  const iframeUnit =
    config.type === "iframe" ? selectIframeUnit(config, isMobile) : undefined;
  const src = config.type === "native" ? config.src : iframeSrc(iframeUnit?.key);
  const scriptId = `adsterra-${placement}`;
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const configured =
    ADS_ENABLED &&
    src &&
    (config.type === "iframe" ||
      (config.type === "native" && config.containerId));
  const placeholderSize =
    config.type === "iframe"
      ? iframeUnit ?? config.mobile ?? config.desktop
      : { width: 728, height: config.minHeight };
  const slotStyle = {
    maxWidth: placeholderSize.width,
    minHeight: placeholderSize.height,
  };

  useEffect(() => {
    if (!configured || config.type !== "iframe" || !src || !iframeUnit) return;

    const container = iframeContainerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const atOptions: AtOptions = {
      key: iframeUnit.key ?? "",
      format: "iframe",
      height: iframeUnit.height,
      width: iframeUnit.width,
      params: {},
    };

    (window as Window & { atOptions?: AtOptions }).atOptions = atOptions;

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = src;
    script.async = false;
    script.setAttribute("data-cfasync", "false");
    container.appendChild(script);

    return () => {
      script.remove();
      container.innerHTML = "";
    };
  }, [config, configured, iframeUnit, scriptId, src]);

  // Show a labelled placeholder in development so slots are visible during
  // layout work. In production an unconfigured/disabled slot renders nothing.
  if (!configured) {
    if (process.env.NODE_ENV !== "development") return null;
    return (
      <aside
        aria-label={LABELS[placement]}
        className={cn(
          "mx-auto grid w-full place-items-center rounded-xl border border-dashed border-border bg-muted/40 px-3 text-center text-xs text-muted-foreground",
          className,
        )}
        style={slotStyle}
      >
        Ad slot · {placement} (configure Adsterra keys to enable)
      </aside>
    );
  }

  return (
    <aside
      aria-label={LABELS[placement]}
      className={cn("mx-auto w-full", className)}
      style={slotStyle}
    >
      <p className="mb-1 text-center text-xs uppercase tracking-wider text-muted-foreground">
        {LABELS[placement]}
      </p>
      <div className="flex justify-center">
        {config.type === "native" ? <div id={config.containerId} /> : null}
        {config.type === "iframe" && iframeUnit ? (
          <div
            className="max-w-full overflow-hidden"
            style={{
              minHeight: iframeUnit.height,
              width: iframeUnit.width,
            }}
          >
            <div ref={iframeContainerRef} />
          </div>
        ) : null}
      </div>
      {config.type === "native" && (
        <Script
          id={scriptId}
          src={src}
          strategy="lazyOnload"
          async
          data-cfasync="false"
        />
      )}
    </aside>
  );
}
