import { NextResponse } from "next/server";

import { guardApiRequest } from "@/lib/security/api-guard";
import { listSessionsSafeForWallet, toSessionListItem } from "@/lib/session-service";
import { getSupabaseStorageStatus } from "@/lib/supabase/server";
import type { SessionListItem } from "@/types/blackbox";

interface SessionsApiResponse {
  sessions: SessionListItem[];
  source: "supabase" | "local-json" | "demo";
  ownerWallet: string | null;
  isWalletScoped: boolean;
  realCount: number;
  sampleFallback: boolean;
  walletRequired: boolean;
  stats: {
    total: number;
    walrusStored: number;
    suiAnchored: number;
    fullyVerified: number;
  };
  message?: string;
  error?: string;
}

function getSessionSource(sampleFallback: boolean): SessionsApiResponse["source"] {
  if (sampleFallback) return "demo";
  return getSupabaseStorageStatus().configured ? "supabase" : "local-json";
}

function isStorageFailureWarning(warning?: string | null) {
  if (!warning) return false;
  return /(?:unavailable|could not|not writable|could not be parsed|failed|timed out)/i.test(warning);
}

export async function GET(request: Request) {
  const guard = await guardApiRequest(request, { profile: "read" });
  if (guard) return guard;

  const url = new URL(request.url);
  const ownerWallet = url.searchParams.get("ownerWallet") ?? "";
  const result = await listSessionsSafeForWallet(ownerWallet);
  const storageFailed = isStorageFailureWarning(result.warning);
  const message =
    result.warning ??
    (result.walletRequired
      ? "Connect wallet to view wallet-scoped sessions."
      : result.sampleFallback
        ? "Sample traces loaded because this wallet has no recorded sessions yet."
        : "Wallet-scoped sessions loaded from the server-side session store.");
  const response: SessionsApiResponse = {
    sessions: storageFailed
      ? []
      : Array.isArray(result.sessions)
        ? result.sessions.map(toSessionListItem)
        : [],
    source: storageFailed
      ? getSupabaseStorageStatus().configured
        ? "supabase"
        : "local-json"
      : getSessionSource(result.sampleFallback),
    ownerWallet: result.ownerWallet ?? null,
    isWalletScoped: Boolean(result.ownerWallet),
    realCount: result.realCount,
    sampleFallback: storageFailed ? false : result.sampleFallback,
    walletRequired: Boolean(result.walletRequired),
    stats: storageFailed
      ? { total: 0, walrusStored: 0, suiAnchored: 0, fullyVerified: 0 }
      : result.stats ?? { total: 0, walrusStored: 0, suiAnchored: 0, fullyVerified: 0 },
    message:
      message,
    ...(storageFailed ? { error: result.warning ?? "Storage unavailable" } : {}),
  };
  return NextResponse.json(response);
}
