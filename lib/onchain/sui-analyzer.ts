import "server-only";

import { getSuiRpcSummary, type SuiRawBalance } from "@/lib/onchain/providers/sui-rpc";
import { buildSuiExplorerUrl, type SuiExplorerLinkType } from "@/lib/sui-explorer";
import type {
  OnchainDataSource,
  OnchainDetectedTarget,
  OnchainExplorerLink,
  OnchainFinding,
  SuiOnchainReport,
  SuiTokenBalance,
} from "@/lib/onchain/types";

const SUI_COIN_TYPE = "0x2::sui::SUI";
const DEFAULT_SUI_RPC_URL = "https://fullnode.mainnet.sui.io:443";

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

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function inferSymbol(coinType: string, metadata: unknown) {
  if (coinType === SUI_COIN_TYPE) return "SUI";
  if (isRecord(metadata) && typeof metadata.symbol === "string" && metadata.symbol.trim()) {
    return metadata.symbol.trim();
  }
  if (/::wal::wal$/i.test(coinType)) return "WAL";
  return coinType.split("::").pop() || "TOKEN";
}

function inferDecimals(coinType: string, metadata: unknown) {
  if (coinType === SUI_COIN_TYPE) return 9;
  if (/::wal::wal$/i.test(coinType)) return 9;
  return isRecord(metadata) ? readNumber(metadata.decimals, 0) : 0;
}

function inferName(symbol: string, metadata: unknown) {
  if (isRecord(metadata) && typeof metadata.name === "string" && metadata.name.trim()) {
    return metadata.name.trim();
  }
  return symbol;
}

function formatBalance(raw: string, decimals: number) {
  try {
    const value = BigInt(raw);
    if (decimals <= 0) return value.toString();
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = value / divisor;
    const fraction = value % divisor;
    const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
    return fractionText ? `${whole.toString()}.${fractionText}` : whole.toString();
  } catch {
    return raw;
  }
}

function buildTokenBalances(
  balances: SuiRawBalance[] | undefined,
  metadataByCoinType: Record<string, unknown> | undefined,
): SuiTokenBalance[] {
  return (balances ?? []).map((item) => {
    const metadata = metadataByCoinType?.[item.coinType];
    const symbol = inferSymbol(item.coinType, metadata);
    const decimals = inferDecimals(item.coinType, metadata);
    return {
      coinType: item.coinType,
      rawTotalBalance: item.totalBalance,
      decimals,
      symbol,
      name: inferName(symbol, metadata),
      formattedBalance: formatBalance(item.totalBalance, decimals),
    };
  }).sort((left, right) => {
    if (left.symbol === "SUI") return -1;
    if (right.symbol === "SUI") return 1;
    if (left.symbol === "WAL") return -1;
    if (right.symbol === "WAL") return 1;
    return left.symbol.localeCompare(right.symbol);
  });
}

function summarizeBalances(tokenBalances: SuiTokenBalance[]) {
  if (tokenBalances.length === 0) return "No token balances were returned by Sui RPC at analysis time.";
  return tokenBalances
    .map((balance) => `${balance.formattedBalance} ${balance.symbol}`)
    .join(", ");
}

function formatNetworkLabel(network: string) {
  if (/mainnet/i.test(network)) return "Mainnet";
  if (/testnet/i.test(network)) return "Testnet";
  if (/devnet/i.test(network)) return "Devnet";
  return network;
}

function formatTargetLabel(targetType: string) {
  const labels: Record<string, string> = {
    sui_wallet: "Sui wallet",
    sui_transaction: "Sui transaction",
    sui_object: "Sui object",
    sui_package: "Sui package",
  };
  return labels[targetType] ?? targetType.replace(/_/g, " ");
}

function buildRiskSignals({
  transactionDetails,
  liveSections,
  tokenBalances,
}: {
  transactionDetails: unknown[] | undefined;
  liveSections: string[];
  tokenBalances: SuiTokenBalance[];
}): OnchainFinding[] {
  const details = transactionDetails ?? [];
  const failedTransactions = details.filter((item) => readEffectsStatus(item) === "failure");
  const findings: OnchainFinding[] = [];

  if (tokenBalances.length > 0) {
    findings.push({
      title: "Token holdings returned by Sui RPC",
      detail: `Live Sui RPC returned token balances for this wallet: ${summarizeBalances(tokenBalances)}.`,
      severity: "info",
      evidence: "suix_getAllBalances / sui_getCoinMetadata",
    });
  }

  if (failedTransactions.length > 0) {
    const digest = readTransactionDigest(failedTransactions[0]) ?? "unknown digest";
    findings.push({
      title: "Failed transaction observed",
      detail: `Available public RPC data includes ${failedTransactions.length} failed transaction(s). Review the first observed digest for context: ${digest}.`,
      severity: "medium",
      evidence: `Sui public RPC transaction digest ${digest}`,
    });
  } else if (details.length > 0) {
    findings.push({
      title: "No suspicious activity detected in available RPC data",
      detail: "No suspicious activity detected in available RPC data.",
      severity: "info",
      evidence: liveSections.length > 0 ? liveSections.join(", ") : "Sui public RPC",
    });
  } else {
    findings.push({
      title: "Limited transaction history from public RPC",
      detail: "Insufficient transaction history available from public RPC for a high-confidence suspicious activity assessment.",
      severity: "info",
      evidence: "Sui public RPC query result",
    });
  }

  return findings;
}

export async function analyzeSuiTarget(detected: OnchainDetectedTarget): Promise<SuiOnchainReport> {
  const rpcSummary = await getSuiRpcSummary({
    target: detected.target,
    targetType: detected.targetType,
  });
  const dataSources = [rpcSummary.source];
  const liveSections = sourceNames(dataSources);
  const tokenBalances = buildTokenBalances(rpcSummary.coinBalances, rpcSummary.coinMetadata);
  const balanceLookupStatus = rpcSummary.balanceLookupStatus ?? (detected.targetType === "sui_wallet" ? "failed" : "skipped");
  const enrichmentStatus = liveSections.length > 0
    ? balanceLookupStatus === "failed"
      ? "partial"
      : "live"
    : "failed";
  const targetLabel = formatTargetLabel(detected.targetType);
  const networkLabel = formatNetworkLabel(detected.network);
  const transactionDetails = rpcSummary.transactionDetails ?? [];
  const riskSignals = buildRiskSignals({ transactionDetails, liveSections, tokenBalances });
  const firstChangeCounts = readChangeCounts(transactionDetails[0]);
  const recentTransactionCount = rpcSummary.transactionBlocks?.length ?? transactionDetails.length;

  if (detected.assumptions.length > 0) {
    riskSignals.push({
      title: "Assumption recorded",
      detail: detected.assumptions.join(" "),
      severity: "low",
      evidence: "Sui target detection",
    });
  }

  const balanceLimit =
    balanceLookupStatus === "completed"
      ? ""
      : balanceLookupStatus === "empty"
        ? "No token balances were returned by Sui RPC at analysis time."
        : balanceLookupStatus === "failed"
          ? "Sui balance lookup failed. This report is preliminary for wallet holdings."
          : "";
  const publicRpcLimit =
    "This report uses available Sui public RPC data only. Deep indexed history is not configured.";
  const insufficientHistory =
    recentTransactionCount === 0
      ? "Insufficient transaction history available from public RPC for a high-confidence suspicious activity assessment."
      : "";
  const limitations = [
    publicRpcLimit,
    ...(balanceLimit ? [balanceLimit] : []),
    ...(insufficientHistory ? [insufficientHistory] : []),
    ...(rpcSummary.ownedObjects ? [] : detected.targetType === "sui_wallet" ? ["Owned objects were not available from public RPC."] : []),
    ...(rpcSummary.objectData ? [] : detected.targetType === "sui_object" || detected.targetType === "sui_package" ? ["Object/package details were not available from public RPC."] : []),
  ];

  const balanceSummary = summarizeBalances(tokenBalances);
  const rpcUrl = process.env.SUI_RPC_URL?.trim() || DEFAULT_SUI_RPC_URL;

  return {
    header: {
      agent: "Sui Onchain Analyzer",
      detectedChain: `Sui ${networkLabel}`,
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
        ? `Analyzed ${targetLabel} on Sui ${networkLabel} using Sui JSON-RPC. ${detected.targetType === "sui_wallet" ? `Wallet holdings: ${balanceSummary}` : "Target details were read where available."}`
        : `Prepared a Sui report for ${targetLabel}, but public RPC did not return usable live data for this target.`,
    targetProfile: [
      `Target: ${detected.target ?? "Not supplied"}`,
      `Target type: ${detected.targetType}`,
      `Network: Sui ${networkLabel}`,
      `Provider: Sui JSON-RPC (${rpcUrl})`,
      detected.targetType === "sui_wallet"
        ? `Token holdings: ${balanceSummary}`
        : `Object/package details: ${rpcSummary.objectData ? "returned" : "not requested or unavailable"}`,
      `Owned objects: ${countPageItems(rpcSummary.ownedObjects)} record(s) returned.`,
    ],
    activityAnalysis: [
      detected.targetType === "sui_wallet"
        ? `Balance lookup status: ${balanceLookupStatus}. ${rpcSummary.balanceLookupMessage ?? balanceSummary}`
        : "Balance lookup was skipped because the target is not a wallet.",
      `Recent transaction blocks returned: ${recentTransactionCount}.`,
      `Transaction details read: ${transactionDetails.length}.`,
      `First transaction change summary: ${firstChangeCounts.balanceChanges} balance change(s), ${firstChangeCounts.objectChanges} object change(s), ${firstChangeCounts.events} event(s).`,
      rpcSummary.objectData
        ? "Object/package data was returned by Sui public RPC."
        : "No object/package details were read for this target.",
      "Sui/Walrus remains the proof path: the report is sealed into a BlackBox trace, stored on Walrus, and anchored on Sui.",
    ],
    riskSignals,
    evidenceStatus: [
      "Sui wallet detected",
      detected.targetType === "sui_wallet"
        ? `Sui balance lookup ${balanceLookupStatus}`
        : "Sui balance lookup skipped for non-wallet target",
      tokenBalances.length > 0
        ? `Coin metadata lookup completed for ${tokenBalances.length} token(s).`
        : "Coin metadata lookup did not return token records.",
      ...dataSources.map((source) => `${source.name}: ${source.status} - ${source.message}`),
      `RPC methods attempted: ${rpcSummary.attemptedMethods.join(", ") || "none"}`,
      `Explorer link count: ${buildExplorerLinks(detected).length}`,
      "Report finalized",
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
        "Sui analysis uses JSON-RPC only.",
        "No non-Sui provider path is part of this Sui-native analyzer.",
        "Analyzer enrichment never replaces deterministic trace hashing or proof verification.",
      ],
    },
    explorerLinks: buildExplorerLinks(detected),
    tokenBalances,
    balanceLookupStatus,
    balanceLookupMessage: rpcSummary.balanceLookupMessage,
  };
}
