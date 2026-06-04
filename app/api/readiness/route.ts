import { NextResponse } from "next/server";

import { getSessionEvidenceStatus } from "@/lib/constants";
import { getNetworkConfig } from "@/lib/network-config";
import { guardApiRequest } from "@/lib/security/api-guard";
import { getSessionStorageDiagnostics, listSessionsSafe } from "@/lib/session-service";
import { getUploadRelayTipConfig } from "@/lib/storage-adapters/walrus-sdk-relay";
import { getSuiProofRegistryConfig } from "@/lib/sui-proof";
import { checkTatumSuiRpcReachability, getTatumSuiRpcConfig } from "@/lib/tatum-rpc";
import { getWalrusConfiguration, getWalrusNetworkLabel } from "@/lib/walrus";
import type { ApiSuccessResponse } from "@/types/blackbox";

export const runtime = "nodejs";

function formatTatumRpcStatus(
  tatum: ReturnType<typeof getTatumSuiRpcConfig>,
  reachability: Awaited<ReturnType<typeof checkTatumSuiRpcReachability>>,
) {
  if (!tatum.apiKeyConfigured) return "Missing API Key";
  if (tatum.rpcNetworkMismatch) return "Mismatch";
  if (!tatum.rpcUrlConfigured) return "Not Configured";
  return reachability.reachable ? "Ready" : "Unavailable";
}

function fallbackTatumReachability(message = "Tatum Sui RPC readiness check could not run.") {
  return {
    configured: false,
    reachable: false,
    checkedAt: new Date().toISOString(),
    message,
  };
}

function safeHost(value: string) {
  if (!value) return undefined;
  try {
    return new URL(value).host;
  } catch {
    return "Invalid URL";
  }
}

function fallbackRelayStatus(message = "Walrus upload relay readiness check could not run.") {
  const walrus = getWalrusConfiguration();
  return {
    configured: walrus.relayConfigured,
    reachable: false,
    network: walrus.network,
    relayUrl: walrus.relayUrl,
    relayHost: safeHost(walrus.relayUrl),
    tipRequirement: "unknown" as const,
    tipConfig: null,
    checkedAt: new Date().toISOString(),
    error: message,
  };
}

export async function GET(request: Request) {
  const guard = await guardApiRequest(request, { profile: "read" });
  if (guard) return guard;

  const [sessionResult, storageDiagnostics, tatumReachability, relayStatus] = await Promise.all([
    listSessionsSafe(),
    getSessionStorageDiagnostics(),
    checkTatumSuiRpcReachability().catch((error) =>
      fallbackTatumReachability(error instanceof Error ? error.message : undefined),
    ),
    getUploadRelayTipConfig().catch((error) =>
      fallbackRelayStatus(error instanceof Error ? error.message : undefined),
    ),
  ]);
  const { sessions } = sessionResult;
  const latest = sessions[0];
  const walrus = getWalrusConfiguration();
  const proof = getSuiProofRegistryConfig();
  const network = getNetworkConfig();
  const tatum = getTatumSuiRpcConfig();
  const result = {
    agentRuntimeKeyPresent: Boolean(process.env.OPENAI_API_KEY?.trim()),
    tatumKeyPresent: tatum.apiKeyConfigured,
    tatumRpcConfigured: tatum.configured,
    tatumRpcStatus: formatTatumRpcStatus(tatum, tatumReachability),
    tatumRpcHost: tatum.rpcHost,
    tatumRpcNetwork: network.displayNetwork,
    tatumRpcReachable: tatumReachability.reachable,
    tatumRpcCheckedAt: tatumReachability.checkedAt,
    tatumRpcMessage: tatumReachability.message,
    walrusRelayConfigured: walrus.relayConfigured,
    walrusRelayReachable: relayStatus.reachable,
    walrusRelayTipRequirement: relayStatus.tipRequirement,
    walrusAggregatorConfigured: Boolean(walrus.aggregatorUrl),
    suiPackageConfigured: proof.configured,
    currentNetwork: network.network.replace("sui-", ""),
    walrusNetwork: getWalrusNetworkLabel(walrus.network),
    lastAgentRunStatus: latest ? getSessionEvidenceStatus(latest) : "No sessions yet",
    lastWalrusBlobHashStatus: latest
      ? latest.verification.directWalrusReadPassed && latest.storage.hashMatched
        ? "Walrus Verified"
        : latest.storage.storageProvider === "local"
          ? "Local Trace"
          : "Prepared"
      : "No sessions yet",
    sessionStoreWarning: sessionResult.warning,
    sessionStorageBackend: storageDiagnostics.backend,
    sessionStorageDurable: storageDiagnostics.durable,
    supabaseUrlPresent: storageDiagnostics.supabaseUrlPresent,
    supabaseServiceRolePresent: storageDiagnostics.supabaseServiceRolePresent,
    supabaseTableReachable: storageDiagnostics.tableReachable,
    sessionStorageCheckedAt: storageDiagnostics.lastCheck,
    sessionStorageError: storageDiagnostics.lastError,
  };
  const response: ApiSuccessResponse<typeof result> = {
    ok: true,
    message: "Readiness status loaded without exposing secrets.",
    data: result,
  };
  return NextResponse.json(response);
}
