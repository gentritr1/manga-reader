"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Script from "next/script";
import { cn } from "@/lib/utils";

type AdsterraAdPlacement = "banner" | "feed" | "rectangle" | "reader";

const placementClass: Record<AdsterraAdPlacement, string> = {
  banner: "min-h-24 max-w-3xl",
  feed: "min-h-44",
  rectangle: "min-h-64 max-w-sm",
  reader: "min-h-40 max-w-xl",
};

type AdAccessResponse = {
  show?: boolean;
  scriptUrl?: string | null;
};

export function AdsterraAdSlot({
  placement,
  className,
}: {
  placement: AdsterraAdPlacement;
  className?: string;
}) {
  const { status } = useSession();
  const [scriptUrl, setScriptUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    let active = true;

    fetch("/api/internal-ad-preview", { cache: "no-store" })
      .then((response) =>
        response.ok
          ? response.json()
          : ({ show: false, scriptUrl: null } satisfies AdAccessResponse),
      )
      .then((data: AdAccessResponse) => {
        if (active) {
          setScriptUrl(data.show && data.scriptUrl ? data.scriptUrl : null);
        }
      })
      .catch(() => {
        if (active) setScriptUrl(null);
      });

    return () => {
      active = false;
    };
  }, [status]);

  if (status !== "authenticated" || !scriptUrl) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={cn(
        "mx-auto grid w-full place-items-center overflow-hidden",
        placementClass[placement],
        className,
      )}
    >
      <span className="sr-only">Advertisement</span>
      <Script
        id={`adsterra-${placement}`}
        src={scriptUrl}
        strategy="afterInteractive"
        async
        data-cfasync="false"
      />
    </aside>
  );
}

export { AdsterraAdSlot as InternalAdPreview };
