"use client";

import Script from "next/script";
import { cn } from "@/lib/utils";

const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";

export type AdPlacement = "chapter-start" | "chapter-end" | "banner";

// Adsterra "Native Banner" keys, configured in .env.local.
// Each placement needs the invoke.js src and the container element id Adsterra
// gives you (looks like "container-xxxxxxxxxxxx").
const CONFIG: Record<AdPlacement, { src?: string; containerId?: string }> = {
  "chapter-start": {
    src: process.env.NEXT_PUBLIC_ADSTERRA_START_SRC,
    containerId: process.env.NEXT_PUBLIC_ADSTERRA_START_CONTAINER,
  },
  "chapter-end": {
    src: process.env.NEXT_PUBLIC_ADSTERRA_END_SRC,
    containerId: process.env.NEXT_PUBLIC_ADSTERRA_END_CONTAINER,
  },
  banner: {
    src: process.env.NEXT_PUBLIC_ADSTERRA_BANNER_SRC,
    containerId: process.env.NEXT_PUBLIC_ADSTERRA_BANNER_CONTAINER,
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
  const { src, containerId } = CONFIG[placement];
  const configured = ADS_ENABLED && src && containerId;

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
        <div id={containerId} />
      </div>
      <Script
        id={`adsterra-${placement}`}
        src={src}
        strategy="lazyOnload"
        async
        data-cfasync="false"
      />
    </div>
  );
}
