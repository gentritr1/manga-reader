"use client";

import { useEffect, useMemo, useRef } from "react";
import Script from "next/script";
import { cn } from "@/lib/utils";
import { placementConfig, type AdConfig, type AdPlacement } from "@/lib/ad-config";
import { useAdGate } from "@/components/ads/ad-gate-provider";

const placementClass: Record<AdPlacement, string> = {
  banner: "min-h-24 max-w-3xl",
  feed: "min-h-44",
  rectangle: "min-h-64 max-w-sm",
  reader: "min-h-40 max-w-xl",
};

type AtOptions = {
  key: string;
  format: "iframe";
  height: number;
  width: number;
  params: Record<string, never>;
};

const SOCIAL_SCRIPT_PREFIX = "adsterra-social-script-";

function injectScript({
  id,
  src,
  parent,
  async = false,
}: {
  id: string;
  src: string;
  parent: HTMLElement;
  async?: boolean;
}) {
  document.getElementById(id)?.remove();

  const script = document.createElement("script");
  script.id = id;
  script.async = async;
  script.setAttribute("data-cfasync", "false");
  script.src = src;
  parent.appendChild(script);

  return script;
}

export function AdsterraSocialAd() {
  // Gate is shared from AdGateProvider; this component does no per-slot fetch.
  const { showAds, socialScriptUrl } = useAdGate();

  useEffect(() => {
    document
      .querySelectorAll(`script[id^="${SOCIAL_SCRIPT_PREFIX}"]`)
      .forEach((script) => script.remove());

    return () => {
      document
        .querySelectorAll(`script[id^="${SOCIAL_SCRIPT_PREFIX}"]`)
        .forEach((script) => script.remove());
    };
  }, [showAds, socialScriptUrl]);

  if (!showAds || !socialScriptUrl) return null;

  return (
    <Script
      id={`${SOCIAL_SCRIPT_PREFIX}social`}
      src={socialScriptUrl}
      strategy="afterInteractive"
      data-cfasync="false"
    />
  );
}

export function AdsterraAdSlot({
  placement,
  className,
}: {
  placement: AdPlacement;
  className?: string;
}) {
  const { showAds, socialScriptUrl } = useAdGate();
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const nativeContainerRef = useRef<HTMLDivElement>(null);

  // Per-placement config is built directly from NEXT_PUBLIC_* env vars.
  const adConfig: AdConfig | null = useMemo(
    () => (showAds ? placementConfig(placement) : null),
    [showAds, placement],
  );

  useEffect(() => {
    if (!adConfig || adConfig.type !== "iframe") return;

    const container = iframeContainerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const atOptions: AtOptions = {
      key: adConfig.key,
      format: "iframe",
      height: adConfig.height,
      width: adConfig.width,
      params: {},
    };

    (window as Window & { atOptions?: AtOptions }).atOptions = atOptions;

    const script = injectScript({
      id: `adsterra-iframe-${placement}`,
      src: adConfig.src,
      parent: container,
    });

    return () => {
      script.remove();
      container.innerHTML = "";
    };
  }, [adConfig, placement]);

  useEffect(() => {
    if (!adConfig || adConfig.type !== "native") return;

    const container = nativeContainerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const target = document.createElement("div");
    target.id = adConfig.containerId;

    container.appendChild(target);
    const script = injectScript({
      id: `adsterra-native-${placement}`,
      src: adConfig.src,
      parent: container,
      async: true,
    });

    return () => {
      script.remove();
      container.innerHTML = "";
    };
  }, [adConfig, placement]);

  if (!showAds) return null;

  const socialScript = socialScriptUrl ? (
    <Script
      id={`adsterra-${placement}`}
      src={socialScriptUrl}
      strategy="afterInteractive"
      data-cfasync="false"
    />
  ) : null;

  if (!adConfig) return socialScript;

  const slotStyle =
    adConfig.type === "iframe"
      ? { maxWidth: adConfig.width, minHeight: adConfig.height }
      : { minHeight: adConfig.minHeight };

  return (
    <aside
      aria-label="Advertisement"
      className={cn(
        "mx-auto grid w-full place-items-center overflow-hidden text-center",
        placementClass[placement],
        className,
      )}
      style={slotStyle}
    >
      <span className="sr-only">Advertisement</span>
      {socialScript}
      {adConfig.type === "native" ? (
        <div ref={nativeContainerRef} />
      ) : (
        <div
          className="max-w-full overflow-hidden"
          style={{
            minHeight: adConfig.height,
            width: adConfig.width,
          }}
        >
          <div ref={iframeContainerRef} />
        </div>
      )}
    </aside>
  );
}

export { AdsterraAdSlot as InternalAdPreview };
