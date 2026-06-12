"use client";

import Script from "next/script";
import { cn } from "@/lib/utils";

const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";

export type AdPlacement = "chapter-start" | "chapter-end" | "banner";

type NativeAdConfig = {
  type: "native";
  src?: string;
  containerId?: string;
};

type IframeAdConfig = {
  type: "iframe";
  key?: string;
  width: number;
  height: number;
};

type AdConfig = NativeAdConfig | IframeAdConfig;

const iframeSrc = (key?: string) =>
  key ? `https://www.highperformanceformat.com/${key}/invoke.js` : undefined;

// Adsterra slots, configured in .env.local. Native ads need a script URL and
// container id; iframe ads need the unit key and dimensions from Adsterra.
const CONFIG: Record<AdPlacement, AdConfig> = {
  "chapter-start": {
    type: "native",
    src: process.env.NEXT_PUBLIC_ADSTERRA_CHAPTER_START_SRC,
    containerId: process.env.NEXT_PUBLIC_ADSTERRA_CHAPTER_START_CONTAINER,
  },
  "chapter-end": {
    type: "iframe",
    key: process.env.NEXT_PUBLIC_ADSTERRA_CHAPTER_END_KEY,
    width: 300,
    height: 250,
  },
  banner: {
    type: "iframe",
    key: process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY,
    width: 728,
    height: 90,
  },
};

const LABELS: Record<AdPlacement, string> = {
  "chapter-start": "Sponsored before you read",
  "chapter-end": "Sponsored after the chapter",
  banner: "Advertisement",
};

export function AdSlot({
  placement,
  className,
}: {
  placement: AdPlacement;
  className?: string;
}) {
  const config = CONFIG[placement];
  const src = config.type === "native" ? config.src : iframeSrc(config.key);
  const configured =
    ADS_ENABLED &&
    src &&
    (config.type === "iframe" || (config.type === "native" && config.containerId));

  // Show a labelled placeholder in development so slots are visible during
  // layout work. In production an unconfigured/disabled slot renders nothing.
  if (!configured) {
    if (process.env.NODE_ENV !== "development") return null;
    return (
      <div
        className={cn(
          "grid min-h-24 w-full place-items-center rounded-xl border border-dashed border-border bg-muted/40 text-xs text-muted-foreground",
          className,
        )}
      >
        Ad slot · {placement} (configure Adsterra keys to enable)
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <p className="mb-1 text-center text-xs uppercase tracking-wider text-muted-foreground">
        {LABELS[placement]}
      </p>
      <div className="flex justify-center">
        {config.type === "native" ? <div id={config.containerId} /> : null}
      </div>
      {config.type === "iframe" && (
        <Script
          id={`adsterra-options-${placement}`}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.atOptions = {
                key: "${config.key}",
                format: "iframe",
                height: ${config.height},
                width: ${config.width},
                params: {}
              };
            `,
          }}
        />
      )}
      <Script
        id={`adsterra-${placement}`}
        src={src}
        strategy={config.type === "iframe" ? "afterInteractive" : "lazyOnload"}
        async
        data-cfasync="false"
      />
    </div>
  );
}
