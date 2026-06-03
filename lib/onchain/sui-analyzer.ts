import "server-only";

import { getSuiRpcSummary } from "@/lib/onchain/providers/sui-rpc";
import { buildSuiExplorerUrl, type SuiExplorerLinkType } from "@/lib/sui-explorer";
import type {
  MultichainOnchainReport,
  OnchainDataSource,
  OnchainDetectedTarget,
  OnchainExplorerLink,
  OnchainFinding,
} from "@/lib/onchain/types";

function sourceNames(dataSources: OnchainDataSource[]) {
  return dataSources.filter((source) => source.used).map((source) => source.name);
}

function buildExplorerLinks(detected: OnchainDetectedTarget): OnchainExplorerLink[] {
  if (!detected.target) return [];
  const type: SuiExplorerLinkType =
    detected.targetType === "sui_transaction"
      ? "transaction"
      : detected.targetType === "sui_wallet"
        ? "address"
        : detected.targetType === "sui_package"
          ? "package"
          : "object";
  const url = buildSuiExplorerUrl(type, detected.target, detected.network);
  if (!url) return [];
  return [{ label: `Sui ${type}`, url }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countPageItems(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (isRecord(value) && Array.isArray(value.data)) return value.data.length;
  return 0;
}

function summarizeUnknown(value: unknown, fallback: string) {
  if (value === undefined || value === null) return fallback;
  if (Array.isArray(value)) return `${value.length} item(s) returned.`;
  if (isRecord(value) && Array.isArray(value.data)) return `${value.data.length} item(s) returned.`;
  if (typeof value === "object") return "Provider returned structured data.";
  return String(value);
}

function readTransactionDigest(value: unknown) {
  if (!isRecord(value)) return null;
  if (typeof value.digest === "string") return value.digest;
  if (isRecord(value.data) && typeof value.data.digest === "string") return value.data.digest;
  return null;
}

function readEffectsStatus(value: unknown) {
  if (!isRecord(value) || !isRecord(value.effects) || !isRecord(value.effects.status)) return null;
  const status = value.effects.status;
  if (typeof status.status === "string") return status.status;
  return null;
}

function readChangeCounts(value: unknown) {
  if (!isRecord(value)) return { balanceChanges: 0, objectChanges: 0, events: 0 };
  return {
    balanceChanges: Array.isArray(value.balanceChanges) ? value.balanceChanges.length : 0,
    objectChanges: Array.isArray(value.objectChanges) ? value.objectChanges.length : 0,
    events: Array.isArray(value.events) ? value.events.length : 0,
  };
}

function buildRiskSignals(transactionDetails: unknown[] | undefined, liveSections: string[]): OnchainFinding[] {
  const details = transactionDetails ?? [];
  const failedTransactions = details.filter((item) => readEffectsStatus(item) === "failure");
  if (failedTransactions.length > 0) {
    const digest = readTransactionDigest(failedTransactions[0]) ?? "unknown digest";
    return [
      {
        title: "Failed transaction observed",
        detail: `Available public RPC data includes ${failedTransactions.length} failed transaction(s). Review the first observed digest for context: ${digest}.`,
        severity: "medium",
        evidence: `Sui public RPC transaction digest ${digest}`,
      },
    ];
  }

  if (details.length > 0) {
    return [
      {
        title: "No suspicious activity detected in available RPC data",
        detail: "No suspicious activity detected in available RPC data.",
        severity: "info",
        evidence: liveSections.length > 0 ? liveSections.join(", ") : "Sui public RPC",
      },
    ];
  }

  return [
    {
      title: "Insufficient transaction history",
      detail: "Insufficient transaction history available from public RPC for a high-confidence suspicious activity assessment.",
      severity: "info",
      evidence: "Sui public RPC query result",
    },
  ];
}

export async function analyzeSuiTarget(detected: OnchainDetectedTarget): Promise<MultichainOnchainReport> {
  const rpcSummary = await getSuiRpcSummary({
    target: detected.target,
    targetType: detected.targetType,
  });
  const dataSources = [rpcSummary.source];
  const liveSections = sourceNames(dataSources);
  const enrichmentStatus = liveSections.length > 0 ? "live" : "failed";
  const targetLabel = detected.targetType.replace(/_/g, " ");
  const transactionDetails = rpcSummary.transactionDetails ?? [];
  const riskSignals = buildRiskSignals(transactionDetails, liveSections);
  const firstChangeCounts = readChangeCounts(transactionDetails[0]);
  const recentTransactionCount = rpcSummary.transactionBlocks?.length ?? transactionDetails.length;

  if (detected.assumptions.length > 0) {
    riskSignals.push({
      title: "Assumption recorded",
      detail: detected.assumptions.join(" "),
      severity: "low",
      evidence: "Chain auto-detection",
    });
  }

  const publicRpcLimit =
    "This report uses available Sui public RPC data only. Deep indexed history is not configured.";
  const insufficientHistory =
    recentTransactionCount === 0
      ? "Insufficient transaction history available from public RPC for a high-confidence suspicious activity assessment."
      : "";
  const limitations = [
    publicRpcLimit,
    ...(insufficientHistory ? [insufficientHistory] : []),
    ...(rpcSummary.balance ? [] : ["Primary SUI balance was not available from public RPC."]),
    ...(rpcSummary.allBalances ? [] : ["All-balance summary was not available from public RPC."]),
    ...(rpcSummary.ownedObjects ? [] : ["Owned objects were not available from public RPC."]),
    ...(rpcSummary.objectData ? [] : detected.targetType === "sui_object" || detected.targetType === "sui_package" ? ["Object/package details were not available from public RPC."] : []),
  ];

  return {
    header: {
      agent: "Multichain Onchain Analyzer",
      detectedChain: `Sui ${detected.network}`,
      targetType: detected.targetType,
      target: detected.target,
      confidence: detected.confidence,
      timestamp: new Date().toISOString(),
      enrichmentStatus,
      dataSourcesUsed: liveSections,
    },
    detected: {
      ...detected,
      chain: "Sui",
      network: detected.network,
    },
    dataSources,
    executiveSummary:
      liveSections.length > 0
        ? `Analyzed ${targetLabel} on Sui ${detected.network} using official Sui public JSON-RPC.`
        : `Prepared a Sui-first report for ${targetLabel}, but public RPC did not return usable live data for this target.`,
    targetProfile: [
      `Target: ${detected.target ?? "Not supplied"}`,
      `Target type: ${detected.targetType}`,
      `Network: Sui ${detected.network}`,
      `Primary SUI balance: ${summarizeUnknown(rpcSummary.balance, "Not available")}`,
      `All balances: ${summarizeUnknown(rpcSummary.allBalances, "Not available")}`,
      `Owned objects: ${summarizeUnknown(rpcSummary.ownedObjects, "Not available")}`,
      `Provider: official Sui public JSON-RPC (${process.env.SUI_RPC_URL?.trim() || "https://fullnode.mainnet.sui.io:443"})`,
    ],
    activityAnalysis: [
      `Recent transaction blocks returned: ${recentTransactionCount}.`,
      `Transaction details read: ${transactionDetails.length}.`,
      `Owned object records returned: ${countPageItems(rpcSummary.ownedObjects)}.`,
      `First transaction change summary: ${firstChangeCounts.balanceChanges} balance change(s), ${firstChangeCounts.objectChanges} object change(s), ${firstChangeCounts.events} event(s).`,
      rpcSummary.objectData
        ? "Object/package data was returned by the official Sui public RPC."
        : "No object/package details were read for this target.",
      "Sui/Walrus remains the primary proof path: the report is sealed into a BlackBox trace, stored on Walrus, and anchored on Sui.",
    ],
    riskSignals,
    evidenceStatus: [
      ...dataSources.map((source) => `${source.name}: ${source.status} - ${source.message}`),
      `RPC methods attempted: ${rpcSummary.attemptedMethods.join(", ") || "none"}`,
      `Explorer link count: ${buildExplorerLinks(detected).length}`,
    ],
    limitations,
    recommendedNextActions: [
      "Review any listed transaction digests in the Sui explorer before making an operational decision.",
      recentTransactionCount === 0
        ? "Provide a transaction digest or object/package ID for deeper public-RPC detail."
        : "Compare the public RPC result with the user-supplied evidence and explorer record.",
      "Store the trace on Walrus Mainnet and anchor proof metadata on Sui Mainnet before external verification.",
    ],
    proofMetadata: {
      proofSystem: "Agent BlackBox trace hash and result hash",
      storageLayer: "Walrus Mainnet trace storage",
      anchorLayer: "Sui Mainnet proof anchor",
      rpcVerification: "Tatum Sui Mainnet RPC for proof reads",
      notes: [
        "Sui analysis in this version uses official Sui JSON-RPC only.",
        "No gRPC, paid Sui provider, Sui indexer, SuiVision, Suiscan, or BlockVision key is required.",
        "Analyzer enrichment never replaces deterministic trace hashing or proof verification.",
      ],
    },
    explorerLinks: buildExplorerLinks(detected),
  };
}
