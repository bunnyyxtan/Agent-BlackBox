import "server-only";

import { createHashFromString, stableStringify } from "@/lib/hash";
import {
  discoverTatumMcpTools,
  getTatumMcpStatus,
  resolveTatumMcpToolName,
  runTatumMcpToolCalls,
  type RunMcpToolCallParams,
  type TatumMcpToolName,
} from "@/lib/mcp/tatum-mcp";
import { EVM_CHAIN_REGISTRY } from "@/lib/onchain/chain-registry";
import type {
  EvmChainKey,
  MultichainOnchainReport,
  OnchainDataSource,
  OnchainDetectedTarget,
  OnchainExplorerLink,
  OnchainFinding,
  OnchainMcpStatusSnapshot,
  OnchainMcpToolEvidence,
} from "@/lib/onchain/types";

const TATUM_NETWORKS: Record<EvmChainKey, string> = {
  ethereum: "ethereum-mainnet",
  base: "base-mainnet",
  arbitrum: "arbitrum-mainnet",
  optimism: "optimism-mainnet",
  polygon: "polygon-mainnet",
  bsc: "bsc-mainnet",
  avalanche: "avalanche-mainnet",
  linea: "linea-mainnet",
};

function buildExplorerLinks(detected: OnchainDetectedTarget): OnchainExplorerLink[] {
  const chain = EVM_CHAIN_REGISTRY[(detected.network || "ethereum") as EvmChainKey] ?? EVM_CHAIN_REGISTRY.ethereum;
  if (!detected.target) return [];
  if (detected.targetType === "evm_transaction") {
    return [{ label: `${chain.name} transaction`, url: `${chain.explorerBaseUrl}/tx/${detected.target}` }];
  }
  return [{ label: `${chain.name} address`, url: `${chain.explorerBaseUrl}/address/${detected.target}` }];
}

function isOptionalMaliciousMcpCall(call: Pick<OnchainMcpToolEvidence, "toolName">) {
  return call.toolName === "check_malicious_address" || call.toolName === "check_malicous_address";
}

function isUsefulCompletedMcpCall(call: OnchainMcpToolEvidence) {
  return call.status === "completed" && !isOptionalMaliciousMcpCall(call);
}

function statusForMcp(calls: OnchainMcpToolEvidence[]) {
  const usefulCompleted = calls.some(isUsefulCompletedMcpCall);
  const failedRequired = calls.some((call) => call.status === "failed" && !isOptionalMaliciousMcpCall(call));
  const failedOptional = calls.some((call) => call.status === "failed" && isOptionalMaliciousMcpCall(call));
  if (usefulCompleted && (failedRequired || failedOptional)) return "partial" as const;
  if (usefulCompleted) return "used" as const;
  if (failedRequired) return "failed" as const;
  return "skipped" as const;
}

function buildDataSource(calls: OnchainMcpToolEvidence[], mcpStatus: OnchainMcpStatusSnapshot): OnchainDataSource {
  const status = statusForMcp(calls);
  const configured = mcpStatus.status === "configured";
  return {
    name: "Tatum MCP",
    status,
    configured: mcpStatus.configured || configured,
    used: status === "used" || status === "partial",
    message:
      status === "used"
        ? "EVM analysis was enriched through Tatum MCP blockchain tools."
        : status === "partial"
          ? "Tatum MCP returned partial live EVM data. Failed tool calls are recorded in Tool Evidence."
          : configured
            ? "Live EVM enrichment could not run through Tatum MCP. This report is preliminary."
            : "Tatum MCP is not configured for live EVM enrichment. This report is preliminary.",
  };
}

function buildMcpEvidenceStatus(calls: OnchainMcpToolEvidence[]) {
  if (calls.length === 0) return ["Tatum MCP: skipped - no EVM target was supplied."];
  return calls.map((call) => {
    const parts = [
      `Tool: ${call.provider}`,
      `Action: ${call.toolName}`,
      call.network ? `Network: ${call.network}` : "",
      call.target ? `Target: ${call.target}` : "",
      `Status: ${call.status}`,
      `Result: ${call.summary}`,
    ].filter(Boolean);
    return parts.join(" | ");
  });
}

function buildToolUnavailableMcpCall({
  availableTools,
  detected,
  optional = false,
  summary,
  tatumNetwork,
  toolName,
}: {
  availableTools?: string[];
  detected: OnchainDetectedTarget;
  optional?: boolean;
  summary?: string;
  tatumNetwork: string;
  toolName: TatumMcpToolName;
}): OnchainMcpToolEvidence {
  const timestamp = new Date().toISOString();
  const message = summary ?? `Tatum MCP tool not found: ${toolName}`;
  const inputPayload = {
    provider: "Tatum MCP",
    toolName,
    network: tatumNetwork,
    target: detected.target,
    optional,
    availableTools: availableTools ?? [],
  };
  return {
    provider: "Tatum MCP",
    packageName: "@tatumio/blockchain-mcp",
    toolName,
    network: tatumNetwork,
    ...(detected.target ? { target: detected.target } : {}),
    status: optional ? "skipped" : "failed",
    summary: message,
    startedAt: timestamp,
    completedAt: timestamp,
    inputHash: createHashFromString(stableStringify(inputPayload)),
    resultUsedInReport: false,
    error: {
      code: "TATUM_MCP_TOOL_NOT_FOUND",
      message,
      status: "tool_not_found",
      details: `Available Tatum MCP tools: ${availableTools && availableTools.length > 0 ? availableTools.join(", ") : "none discovered"}`,
    },
  };
}

function buildDiscoveryFailureMcpCall(
  detected: OnchainDetectedTarget,
  tatumNetwork: string,
  error: NonNullable<Awaited<ReturnType<typeof discoverTatumMcpTools>>["error"]>,
): OnchainMcpToolEvidence {
  const timestamp = new Date().toISOString();
  const inputPayload = {
    provider: "Tatum MCP",
    toolName: "listTools",
    network: tatumNetwork,
    target: detected.target,
    reason: error.code,
  };
  return {
    provider: "Tatum MCP",
    packageName: "@tatumio/blockchain-mcp",
    toolName: "listTools",
    network: tatumNetwork,
    ...(detected.target ? { target: detected.target } : {}),
    status: "failed",
    summary: error.message,
    startedAt: timestamp,
    completedAt: timestamp,
    inputHash: createHashFromString(stableStringify(inputPayload)),
    resultUsedInReport: false,
    error,
  };
}

function buildRiskSignals(detected: OnchainDetectedTarget, calls: OnchainMcpToolEvidence[]): OnchainFinding[] {
  const completedCalls = calls.filter((call) => call.status === "completed");
  const signals: OnchainFinding[] = [
    {
      title: "No suspicious activity claim made",
      detail:
        completedCalls.length > 0
          ? "The analyzer records available Tatum MCP evidence but does not flag suspicious behavior unless returned data clearly supports it."
          : "Live EVM enrichment did not return usable chain history, so no suspicious activity claim is made.",
      severity: "info",
      evidence: completedCalls.length > 0 ? "Tatum MCP tool evidence" : "Preliminary EVM report",
    },
  ];

  if (detected.assumptions.length > 0) {
    signals.push({
      title: "Chain assumption recorded",
      detail: detected.assumptions.join(" "),
      severity: "low",
      evidence: "Chain auto-detection",
    });
  }

  return signals;
}

async function collectTatumMcpEvidence(
  detected: OnchainDetectedTarget,
  tatumNetwork: string,
  availableTools: string[],
): Promise<OnchainMcpToolEvidence[]> {
  if (!detected.target) return [];

  if (detected.targetType === "evm_transaction") {
    const toolName = resolveTatumMcpToolName("gateway_execute_rpc", availableTools);
    if (!toolName) {
      return [
        buildToolUnavailableMcpCall({
          availableTools,
          detected,
          tatumNetwork,
          toolName: "gateway_execute_rpc",
        }),
      ];
    }
    return runTatumMcpToolCalls([
      {
        toolName,
        network: tatumNetwork,
        target: detected.target,
        args: {
          chain: tatumNetwork,
          method: "eth_getTransactionByHash",
          params: [detected.target],
        },
      },
    ]);
  }

  const baseArgs = {
    network: tatumNetwork,
    target: detected.target,
  };
  const calls: OnchainMcpToolEvidence[] = [];
  const portfolioTool = resolveTatumMcpToolName("get_wallet_portfolio", availableTools);
  const toolCallRequests: RunMcpToolCallParams[] = [];
  if (portfolioTool) {
    toolCallRequests.push({
          toolName: portfolioTool,
          ...baseArgs,
          args: {
            chain: tatumNetwork,
            addresses: detected.target,
            tokenTypes: "native",
            pageSize: "10",
          },
        });
  } else {
    calls.push(buildToolUnavailableMcpCall({
          availableTools,
          detected,
          tatumNetwork,
          toolName: "get_wallet_portfolio",
        }));
  }

  const historyTool = resolveTatumMcpToolName("get_transaction_history", availableTools);
  if (historyTool) {
    toolCallRequests.push({
          toolName: historyTool,
          ...baseArgs,
          args: {
            chain: tatumNetwork,
            addresses: detected.target,
            pageSize: "10",
            sort: "DESC",
          },
        });
  } else {
    calls.push(buildToolUnavailableMcpCall({
          availableTools,
          detected,
          tatumNetwork,
          toolName: "get_transaction_history",
        }));
  }

  const maliciousTool = resolveTatumMcpToolName("check_malicous_address", availableTools);
  if (maliciousTool) {
    toolCallRequests.push({
          toolName: maliciousTool,
          ...baseArgs,
          args: {
            address: detected.target,
          },
        });
  } else {
    calls.push(buildToolUnavailableMcpCall({
          availableTools,
          detected,
          optional: true,
          summary: "Optional Tatum MCP malicious-address tool not available.",
          tatumNetwork,
          toolName: "check_malicous_address",
        }));
  }
  if (toolCallRequests.length > 0) {
    calls.push(...await runTatumMcpToolCalls(toolCallRequests));
  }
  return calls;
}

function buildSkippedMcpCall(
  detected: OnchainDetectedTarget,
  tatumNetwork: string,
  mcpStatus: OnchainMcpStatusSnapshot,
): OnchainMcpToolEvidence {
  const toolName = detected.targetType === "evm_transaction" ? "gateway_execute_rpc" : "get_wallet_portfolio";
  const timestamp = new Date().toISOString();
  const message = mcpStatus.status === "missing_api_key"
    ? "Tatum MCP is enabled, but the Tatum API key is missing. This report is preliminary."
    : mcpStatus.status === "disabled"
      ? "Tatum MCP is disabled. This report is preliminary."
      : "Tatum MCP package or runtime is unavailable. This report is preliminary.";
  const inputPayload = {
    provider: "Tatum MCP",
    toolName,
    network: tatumNetwork,
    target: detected.target,
    reason: mcpStatus.status,
  };
  return {
    provider: "Tatum MCP",
    packageName: "@tatumio/blockchain-mcp",
    toolName,
    network: tatumNetwork,
    ...(detected.target ? { target: detected.target } : {}),
    status: "skipped",
    summary: message,
    startedAt: timestamp,
    completedAt: timestamp,
    inputHash: createHashFromString(stableStringify(inputPayload)),
    resultUsedInReport: false,
    error: {
      code: "TATUM_MCP_UNAVAILABLE",
      message,
      status: mcpStatus.status,
      ...(mcpStatus.details ? { details: mcpStatus.details } : {}),
    },
  };
}

export async function analyzeEvmTarget(detected: OnchainDetectedTarget): Promise<MultichainOnchainReport> {
  const chain = EVM_CHAIN_REGISTRY[(detected.network || "ethereum") as EvmChainKey] ?? EVM_CHAIN_REGISTRY.ethereum;
  const tatumNetwork = TATUM_NETWORKS[chain.key] ?? "ethereum-mainnet";
  const baseMcpStatus = await getTatumMcpStatus();
  const discovery = baseMcpStatus.status === "configured" ? await discoverTatumMcpTools() : undefined;
  const mcpStatus: OnchainMcpStatusSnapshot = discovery
    ? {
        ...baseMcpStatus,
        availableTools: discovery.availableTools,
        ...(discovery.error
          ? {
              details: discovery.error.details ?? discovery.error.message,
            }
          : {}),
      }
    : baseMcpStatus;
  const mcpToolCalls = mcpStatus.status === "configured"
    ? discovery?.error
      ? [buildDiscoveryFailureMcpCall(detected, tatumNetwork, discovery.error)]
      : await collectTatumMcpEvidence(detected, tatumNetwork, discovery?.availableTools ?? [])
    : detected.target
      ? [buildSkippedMcpCall(detected, tatumNetwork, mcpStatus)]
      : [];
  const completedCalls = mcpToolCalls.filter((call) => call.status === "completed");
  const failedCalls = mcpToolCalls.filter((call) => call.status === "failed");
  const usefulCompletedCalls = completedCalls.filter((call) => !isOptionalMaliciousMcpCall(call));
  const enrichmentStatus = usefulCompletedCalls.length > 0 && failedCalls.length > 0
    ? "partial"
    : usefulCompletedCalls.length > 0
      ? "live"
      : "preliminary";
  const dataSources = [buildDataSource(mcpToolCalls, mcpStatus)];
  const providerLabel = usefulCompletedCalls.length > 0 ? "Tatum MCP" : "Tatum MCP unavailable";
  const targetLabel = detected.targetType.replace(/_/g, " ");
  const evidenceStatus = [
    ...buildMcpEvidenceStatus(mcpToolCalls),
    `Explorer link count: ${buildExplorerLinks(detected).length}`,
  ];
  const preliminaryMessage = `Live ${chain.name} enrichment could not run through Tatum MCP. This report is preliminary.`;

  return {
    header: {
      agent: "Multichain Onchain Analyzer",
      detectedChain: chain.name,
      targetType: detected.targetType,
      target: detected.target,
      confidence: detected.confidence,
      timestamp: new Date().toISOString(),
      enrichmentStatus,
      dataSourcesUsed: [providerLabel],
    },
    detected: {
      ...detected,
      chain: chain.name,
      chainId: chain.chainId,
      network: chain.key,
    },
    dataSources,
    executiveSummary:
      enrichmentStatus === "live"
        ? `Analyzed ${targetLabel} on ${chain.name}. EVM analysis was enriched through Tatum MCP blockchain tools.`
        : enrichmentStatus === "partial"
          ? `Analyzed ${targetLabel} on ${chain.name}. Tatum MCP returned partial live data; unavailable tool calls are recorded without inventing activity.`
          : preliminaryMessage,
    targetProfile: [
      `Target: ${detected.target ?? "Not supplied"}`,
      `Target type: ${detected.targetType}`,
      `Chain: ${chain.name} (chain ID ${chain.chainId})`,
      `Tatum MCP network: ${tatumNetwork}`,
      usefulCompletedCalls.length > 0
        ? "Provider: Tatum MCP"
        : "Provider: Tatum MCP unavailable for this run",
    ],
    activityAnalysis: [
      usefulCompletedCalls.length > 0
        ? `Tatum MCP tool calls completed: ${completedCalls.length}.`
        : `Live ${chain.name} wallet enrichment could not be completed, so no activity claim is made.`,
      detected.targetType === "evm_transaction"
        ? "The supplied 32-byte hash was treated as an EVM transaction hash because EVM transaction context was present."
        : "Address-level analysis was used for this EVM target.",
      ...completedCalls.map((call) => `${call.toolName}: ${call.summary}`),
      ...(failedCalls.length > 0 && usefulCompletedCalls.length > 0
        ? [`Tatum MCP tool calls incomplete: ${failedCalls.map((call) => call.toolName).join(", ")}.`]
        : []),
    ],
    riskSignals: buildRiskSignals(detected, mcpToolCalls),
    evidenceStatus,
    limitations: [
      ...(usefulCompletedCalls.length > 0
        ? ["Tatum MCP results are summarized as evidence; no suspicious activity is invented beyond returned tool data."]
        : [`${preliminaryMessage} No balances, transaction history, or suspicious activity are claimed without returned MCP data.`]),
      "Mention the intended EVM chain when the same address exists across multiple chains.",
    ],
    recommendedNextActions: [
      usefulCompletedCalls.length > 0
        ? "Review the linked explorer record and compare Tatum MCP output with any user-supplied evidence."
        : "Review Developer diagnostics for the last sanitized Tatum MCP runtime/tool error, then rerun the analyzer.",
      "Seal the resulting report in Agent BlackBox and verify the trace through the Walrus/Sui proof flow.",
    ],
    proofMetadata: {
      proofSystem: "Agent BlackBox trace hash and result hash",
      storageLayer: "Walrus Mainnet trace storage",
      anchorLayer: "Sui Mainnet proof anchor",
      rpcVerification: "Tatum Sui Mainnet RPC for proof reads",
      notes: [
        "EVM analysis is enrichment evidence inside the BlackBox trace.",
        "Sui public RPC remains the Sui analyzer path; Tatum MCP is used only for EVM and multichain enrichment.",
        "Walrus/Sui remain the canonical storage and proof layers for the session.",
      ],
    },
    explorerLinks: buildExplorerLinks(detected),
    mcpStatus,
    mcpToolCalls,
  };
}
