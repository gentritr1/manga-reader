import { NextResponse } from "next/server";
import { resolveAdGate } from "@/lib/ad-gate";

// Ad gate endpoint. Resolves "should this viewer see ads" server-side so the
// first-two-user check and social script URL never ship in a client bundle. It
// is fetched once per authenticated page session by AdGateProvider, not per ad
// slot. Per-slot ad config is built on the client from NEXT_PUBLIC_* env vars.
//
const noStore = {
  headers: { "Cache-Control": "private, no-store" },
};

export async function GET() {
  const gate = await resolveAdGate();
  return NextResponse.json(gate, noStore);
}
