"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// Resolves the ad gate once per authenticated page session and shares it with
// every ad slot via context. Ad slots no longer fetch their own access decision
// (previously one fetch per slot).
//
// Keeping this read outside the root Server Component layout preserves the
// static/ISR page shells. Anonymous viewers do not call the endpoint.
//
// Server secrets never reach the client. Only the two first-created user
// accounts can receive showAds=true.

export type AdGateValue = {
  showAds: boolean;
  socialScriptUrl: string | null;
};

const DEFAULT_GATE: AdGateValue = { showAds: false, socialScriptUrl: null };

const AdGateContext = createContext<AdGateValue>(DEFAULT_GATE);

export function AdGateProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [gate, setGate] = useState<{ userId: string; value: AdGateValue } | null>(
    null,
  );

  useEffect(() => {
    if (status !== "authenticated" || !userId) {
      return;
    }

    let active = true;

    fetch("/api/internal-ad-preview", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : DEFAULT_GATE))
      .then((data: AdGateValue) => {
        if (active) {
          setGate({
            userId,
            value: {
              showAds: Boolean(data?.showAds),
              socialScriptUrl: data?.socialScriptUrl ?? null,
            },
          });
        }
      })
      .catch(() => {
        if (active) setGate({ userId, value: DEFAULT_GATE });
      });

    return () => {
      active = false;
    };
  }, [status, userId]);

  const value =
    gate && status === "authenticated" && gate.userId === userId
      ? gate.value
      : DEFAULT_GATE;

  return <AdGateContext.Provider value={value}>{children}</AdGateContext.Provider>;
}

export function useAdGate(): AdGateValue {
  return useContext(AdGateContext);
}
