import "server-only";

import { EVM_CHAIN_REGISTRY } from "@/lib/onchain/chain-registry";
import {
  getEtherscanTransactionEvidence,
  getEtherscanV2Status,
  getEtherscanWalletEvidence,
} from "@/lib/onchain/providers/etherscan-v2";
import type {
  EvmChainKey,
  MultichainOnchainReport,
  OnchainDataSource,
  OnchainDetectedTarget,
  OnchainExplorerLink,
  OnchainFinding,
  OnchainProviderEvidence,
} from "@/lib/onchain/types";

function buildExplorerLinks(detected: OnchainDetectedTarget): OnchainExplorerLink[] {
  const chain = EVM_CHAIN_REGISTRY[(detected.network || "ethereum") as EvmChainKey] ?? EVM_CHAIN_REGISTRY.ethereum;
  if (!detected.target) return [];
  if (detected.targetType === "evm_transaction") {
    return [{ label: `${chain.name} transaction`, url: `${chain.explorerBaseUrl}/tx/${detected.target}` }];
  }
  return [{ label: `${chain.name} address`, url: `${chain.explorerBaseUrl}/address/${detected.target}` }];
}

function buildDataSource(evidence: OnchainProviderEvidence[], configured: boolean): OnchainDataSource {
  const completed = evidence.filter((item) => item.status === "completed");
  const failed = evidence.filter((item) => item.status === "failed");
  const status =
    completed.length > 0 && failed.length > 0
      ? "partial"
      : completed.length > 0
        ? "used"
        : configured
          ? "failed"
          : "not_configured";

  return {
    name: "Etherscan V2",
    status,
    configured,
    used: status === "used" || status === "partial",
    message:
      status === "used"
        ? "EVM analysis was enriched with live Etherscan V2 data."
        : status === "partial"
          ? "Etherscan V2 returned partial live EVM data. Missing sections are noted without inventing activity."
          : configured
            ? "Live EVM enrichment could not be completed with Etherscan V2. This report is preliminary."
            : "Etherscan V2 is not configured. This report is preliminary.",
  };
}

function buildEvidenceStatus(evidence: OnchainProviderEvidence[]) {
  if (evidence.length === 0) {
    return ["Etherscan V2: skipped - no EVM target was supplied."];
  }
  return evidence.map((item) => {
    const parts = [
      `Provider: ${item.provider}`,
      `Action: ${item.actionName}`,
      item.network ? `Network: ${item.network}` : "",
      item.chainId ? `Chain ID: ${item.chainId}` : "",
      item.target ? `Target: ${item.target}` : "",
      `Status: ${item.status}`,
      `Result: ${item.summary}`,
    ].filter(Boolean);
    return parts.join(" | ");
  });
}

function buildRiskSignals(detected: OnchainDetectedTarget, evidence: OnchainProviderEvidence[]): OnchainFinding[] {
  const completed = evidence.filter((item) => item.status === "completed");
  const signals: OnchainFinding[] = [
    {
      title: "No suspicious activity detected in available provider data",
      detail:
        completed.length > 0
          ? "Etherscan V2 returned usable data. The analyzer does not flag suspicious behavior unless returned records clearly support it."
          : "Live EVM enrichment did not return usable chain history, so no suspicious activity claim is made.",
      severity: "info",
      evidence: completed.length > 0 ? "Etherscan V2 provider evidence" : "Preliminary EVM report",
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

async function collectEtherscanEvidence(detected: OnchainDetectedTarget) {
  const chain = EVM_CHAIN_REGISTRY[(detected.network || "ethereum") as EvmChainKey] ?? EVM_CHAIN_REGISTRY.ethereum;
  if (!detected.target) return [];
  if (detected.targetType === "evm_transaction") {
    return getEtherscanTransactionEvidence(chain, detected.target);
  }
  return getEtherscanWalletEvidence(chain, detected.target);
}

export async function analyzeEvmTarget(detected: OnchainDetectedTarget): Promise<MultichainOnchainReport> {
  const chain = EVM_CHAIN_REGISTRY[(detected.network || "ethereum") as EvmChainKey] ?? EVM_CHAIN_REGISTRY.ethereum;
  const etherscanStatus = getEtherscanV2Status();
  const callResults = etherscanStatus.configured ? await collectEtherscanEvidence(detected) : [];
  const providerEvidence = callResults.map((item) => item.evidence);
  const completed = providerEvidence.filter((item) => item.status === "completed");
  const failed = providerEvidence.filter((item) => item.status === "failed");
  const enrichmentStatus =
    completed.length > 0 && failed.length > 0
      ? "partial"
      : completed.length > 0
        ? "live"
        : "preliminary";
  const dataSource = buildDataSource(providerEvidence, etherscanStatus.configured);
  const dataSources = [dataSource];
  const targetLabel = detected.targetType.replace(/_/g, " ");
  const providerLabel = completed.length > 0
    ? "Etherscan V2"
    : "Etherscan V2 attempted";
  const preliminaryMessage = "Live EVM enrichment could not be completed with Etherscan V2. This report is preliminary.";

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
        ? `Analyzed ${targetLabel} on ${chain.name}. EVM analysis was enriched with Etherscan V2 data.`
        : enrichmentStatus === "partial"
          ? `Analyzed ${targetLabel} on ${chain.name}. Etherscan V2 returned partial live data; unavailable sections are recorded without inventing activity.`
          : preliminaryMessage,
    targetProfile: [
      `Target: ${detected.target ?? "Not supplied"}`,
      `Target type: ${detected.targetType}`,
      `Chain: ${chain.name} (chain ID ${chain.chainId})`,
      `Provider: ${providerLabel}`,
      `Provider host: ${etherscanStatus.baseUrlHost}`,
    ],
    activityAnalysis: [
      completed.length > 0
        ? `Etherscan V2 calls completed: ${completed.length}.`
        : `Live ${chain.name} wallet enrichment could not be completed, so no activity claim is made.`,
      detected.targetType === "evm_transaction"
        ? "The supplied 32-byte hash was treated as an EVM transaction hash because EVM transaction context was present."
        : "Address-level analysis was used for this EVM target.",
      ...completed.map((item) => `${item.actionName}: ${item.summary}`),
      ...(failed.length > 0 && completed.length > 0
        ? [`Etherscan V2 sections incomplete: ${failed.map((item) => item.actionName).join(", ")}.`]
        : []),
    ],
    riskSignals: buildRiskSignals(detected, providerEvidence),
    evidenceStatus: [
      ...buildEvidenceStatus(providerEvidence),
      `Explorer link count: ${buildExplorerLinks(detected).length}`,
    ],
    limitations: [
      ...(completed.length > 0
        ? ["Etherscan V2 results are summarized as provider evidence; no suspicious activity is invented beyond returned data."]
        : [`${preliminaryMessage} No balances, transaction history, or suspicious activity are claimed without returned provider data.`]),
      "Mention the intended EVM chain when the same address exists across multiple chains.",
    ],
    recommendedNextActions: [
      completed.length > 0
        ? "Review the linked explorer record and compare Etherscan V2 output with any user-supplied evidence."
        : "Check the Etherscan V2 provider configuration, then rerun the analyzer.",
      "Seal the resulting report in Agent BlackBox and verify the trace through the Walrus/Sui proof flow.",
    ],
    proofMetadata: {
      proofSystem: "Agent BlackBox trace hash and result hash",
      storageLayer: "Walrus Mainnet trace storage",
      anchorLayer: "Sui Mainnet proof anchor",
      rpcVerification: "Tatum Sui Mainnet RPC for proof reads",
      notes: [
        "EVM analysis is enrichment evidence inside the BlackBox trace.",
        "Sui public RPC remains the Sui analyzer path; Etherscan V2 is used only for EVM enrichment.",
        "Walrus/Sui remain the canonical storage and proof layers for the session.",
      ],
    },
    explorerLinks: buildExplorerLinks(detected),
    etherscanStatus,
    providerEvidence,
  };
}
