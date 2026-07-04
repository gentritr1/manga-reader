import "server-only";

import { unstable_cache } from "next/cache";
import { auth } from "@/lib/auth";
import { normalizeScriptUrl } from "@/lib/ad-config";
import { prisma } from "@/lib/prisma";

// Server-only ad gate.
//
// `import "server-only"` guarantees this module and ADSTERRA_SCRIPT_URL can
// never be bundled into a Client Component. The ad gate endpoint calls this once
// per authenticated page session, then shares the result with every ad slot via
// context.
//
// Only the first two registered user accounts can see ads. The small DB lookup
// for those ids is cached because the first-created accounts are effectively
// stable after launch.

export type AdGate = {
  /** Whether the current viewer is allowed to see ads. */
  showAds: boolean;
  /** Adsterra social script URL, only populated when showAds is true. */
  socialScriptUrl: string | null;
};

const NO_ADS: AdGate = { showAds: false, socialScriptUrl: null };

const getFirstAdUserIds = unstable_cache(
  async () => {
    const users = await prisma.user.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
      take: 2,
    });
    return users.map((user) => user.id);
  },
  ["ad-gate-first-two-user-ids-v1"],
  { revalidate: 3600 },
);

export async function resolveAdGate(): Promise<AdGate> {
  try {
    // JWT session strategy: this reads the token, it does NOT query the DB.
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NO_ADS;

    const firstAdUserIds = await getFirstAdUserIds();
    if (!firstAdUserIds.includes(userId)) return NO_ADS;

    return {
      showAds: true,
      socialScriptUrl: normalizeScriptUrl(process.env.ADSTERRA_SCRIPT_URL),
    };
  } catch {
    return NO_ADS;
  }
}
