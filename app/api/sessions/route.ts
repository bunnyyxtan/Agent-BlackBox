import { NextResponse } from "next/server";

import { guardApiRequest } from "@/lib/security/api-guard";
import { listSessionsSafeForWallet } from "@/lib/session-service";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function GET(request: Request) {
  const guard = await guardApiRequest(request, { profile: "read" });
  if (guard) return guard;

  const url = new URL(request.url);
  const ownerWallet = url.searchParams.get("ownerWallet") ?? "";
  const result = await listSessionsSafeForWallet(ownerWallet);
  const response: ApiSuccessResponse<{
    sessions: typeof result.sessions;
    realCount: number;
    sampleFallback: boolean;
    walletRequired: boolean;
    ownerWallet: string | null;
    stats: NonNullable<typeof result.stats>;
  }> = {
    ok: true,
    message:
      result.warning ??
      (result.walletRequired
        ? "Connect wallet to view wallet-scoped sessions."
        : result.sampleFallback
          ? "Sample traces loaded because this wallet has no recorded sessions yet."
          : "Wallet-scoped sessions loaded from the server-side session store."),
    data: {
      sessions: result.sessions,
      realCount: result.realCount,
      sampleFallback: result.sampleFallback,
      walletRequired: Boolean(result.walletRequired),
      ownerWallet: result.ownerWallet ?? null,
      stats: result.stats ?? { total: 0, walrusStored: 0, suiAnchored: 0, fullyVerified: 0 },
    },
  };
  return NextResponse.json(response);
}
