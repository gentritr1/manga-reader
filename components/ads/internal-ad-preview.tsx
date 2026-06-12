"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
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
  socialScriptUrl?: string | null;
  adConfig?: AdConfig | null;
};

type AdAccessState = {
  userId: string;
  response: AdAccessResponse;
};

type NativeAdConfig = {
  type: "native";
  src: string;
  containerId: string;
  minHeight: number;
};

type IframeAdConfig = {
  type: "iframe";
  key: string;
  src: string;
  width: number;
  height: number;
};

type AdConfig = NativeAdConfig | IframeAdConfig;

type AtOptions = {
  key: string;
  format: "iframe";
  height: number;
  width: number;
  params: Record<string, never>;
};

const SOCIAL_SCRIPT_ID = "adsterra-social-script";
let socialScriptMounts = 0;

function SocialAdScript({ src }: { src: string }) {
  useEffect(() => {
    socialScriptMounts += 1;

    let script = document.getElementById(SOCIAL_SCRIPT_ID) as HTMLScriptElement | null;

    if (!script || script.src !== src) {
      script?.remove();
      script = document.createElement("script");
      script.id = SOCIAL_SCRIPT_ID;
      script.src = src;
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      document.body.appendChild(script);
    }

    return () => {
      socialScriptMounts = Math.max(0, socialScriptMounts - 1);

      if (socialScriptMounts === 0) {
        document.getElementById(SOCIAL_SCRIPT_ID)?.remove();
      }
    };
  }, [src]);

  return null;
}

export function AdsterraAdSlot({
  placement,
  className,
}: {
  placement: AdsterraAdPlacement;
  className?: string;
}) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [adAccess, setAdAccess] = useState<AdAccessState | null>(null);
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const nativeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;

    let active = true;

    fetch(`/api/internal-ad-preview?placement=${placement}`, { cache: "no-store" })
      .then((response) =>
        response.ok
          ? response.json()
          : ({
              show: false,
              socialScriptUrl: null,
              adConfig: null,
            } satisfies AdAccessResponse),
      )
      .then((data: AdAccessResponse) => {
        if (active) setAdAccess({ userId, response: data });
      })
      .catch(() => {
        if (active) {
          setAdAccess({
            userId,
            response: { show: false, socialScriptUrl: null, adConfig: null },
          });
        }
      });

    return () => {
      active = false;
    };
  }, [placement, status, userId]);

  const currentAccess =
    status === "authenticated" && adAccess && adAccess.userId === userId
      ? adAccess.response
      : null;
  const adConfig = currentAccess?.show ? currentAccess.adConfig : null;
  const socialScriptUrl = currentAccess?.show ? currentAccess.socialScriptUrl : null;

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

    const script = document.createElement("script");
    script.id = `adsterra-iframe-${placement}`;
    script.src = adConfig.src;
    script.async = false;
    script.setAttribute("data-cfasync", "false");
    container.appendChild(script);

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

    const script = document.createElement("script");
    script.id = `adsterra-native-${placement}`;
    script.src = adConfig.src;
    script.async = true;
    script.setAttribute("data-cfasync", "false");

    container.append(target, script);

    return () => {
      script.remove();
      container.innerHTML = "";
    };
  }, [adConfig, placement]);

  if (status !== "authenticated" || !currentAccess?.show) return null;

  const socialScript = socialScriptUrl ? <SocialAdScript src={socialScriptUrl} /> : null;

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
