import { NextResponse } from "next/server";

import { getSessionEvidenceStatus } from "@/lib/constants";
import { getTatumMcpStatus } from "@/lib/mcp/tatum-mcp";
import { getNetworkConfig } from "@/lib/network-config";
import { listSessions } from "@/lib/session-service";
import { getUploadRelayTipConfig } from "@/lib/storage-adapters/walrus-sdk-relay";
import { getSuiProofRegistryConfig } from "@/lib/sui-proof";
import { checkTatumSuiRpcReachability, getTatumSuiRpcConfig } from "@/lib/tatum-rpc";
import { getWalrusConfiguration, getWalrusNetworkLabel } from "@/lib/walrus";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export const runtime = "nodejs";

export async function GET() {
  const [sessions, tatumReachability, relayStatus, tatumMcp] = await Promise.all([
    listSessions(),
    checkTatumSuiRpcReachability(),
    getUploadRelayTipConfig(),
    getTatumMcpStatus(),
  ]);
  const latest = sessions[0];
  const walrus = getWalrusConfiguration();
  const proof = getSuiProofRegistryConfig();
  const network = getNetworkConfig();
  const tatum = getTatumSuiRpcConfig();
  const result = {
    agentRuntimeKeyPresent: Boolean(process.env.OPENAI_API_KEY?.trim()),
    tatumKeyPresent: tatum.apiKeyConfigured,
    tatumRpcConfigured: tatum.configured,
    tatumRpcReachable: tatumReachability.reachable,
    tatumRpcMessage: tatumReachability.message,
    tatumMcpStatus: tatumMcp.status,
    tatumMcpMessage: tatumMcp.message,
    tatumMcpApiKeyPresent: tatumMcp.apiKeyPresent,
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
          ? "Sample Trace"
          : "Prepared"
      : "No sessions yet",
  };
  const response: PlaceholderApiResponse<typeof result> = {
    ok: true,
    phase: "phase-2e",
    message: "Readiness status loaded without exposing secrets.",
    data: result,
  };
  return NextResponse.json(response);
}
