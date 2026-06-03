import "server-only";

import { analyzeSuiTarget } from "@/lib/onchain/sui-analyzer";
import { isValidTransactionDigest } from "@/lib/sui-client-helpers";
import type {
  OnchainAnalyzeRequest,
  OnchainDataSource,
  OnchainDetectedTarget,
  OnchainTargetType,
  SuiOnchainReport,
} from "@/lib/onchain/types";

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

function normalize0x(value: string) {
  return value.toLowerCase();
}

function getContext(text: string, token: string) {
  const index = text.indexOf(token);
  if (index === -1) return text;
  return text.slice(Math.max(0, index - 72), Math.min(text.length, index + token.length + 72));
}

function detectSuiNetwork(text: string, requestedNetwork?: string) {
  const networkText = requestedNetwork ? `${requestedNetwork}\n${text}` : text;
  if (/\bdevnet\b/i.test(networkText)) return "devnet";
  if (/\btestnet\b/i.test(networkText)) return "testnet";
  return "mainnet";
}

function classifySuiTarget(context: string): OnchainTargetType {
  if (/\b(package|module|move package)\b/i.test(context)) return "sui_package";
  if (/\b(object|coin|nft|cap|registry|proof)\b/i.test(context)) return "sui_object";
  if (/\b(transaction|tx|digest)\b/i.test(context)) return "sui_transaction";
  return "sui_wallet";
}

export function detectOnchainTarget(input: OnchainAnalyzeRequest): OnchainDetectedTarget {
  const title = input.title?.trim() ?? "";
  const prompt = input.prompt?.trim() ?? "";
  const target = input.target?.trim() ?? "";
  const text = [title, prompt, target, typeof input.evidence === "string" ? input.evidence : ""]
    .filter(Boolean)
    .join("\n");
  const tokens = uniqueValues(text.match(/0x[a-fA-F0-9]{64}|[1-9A-HJ-NP-Za-km-z]{32,88}/g) ?? []);
  const assumptions: string[] = [];
  const signals: string[] = [];

  const explicitSuiDigest = tokens.find((token) => !token.startsWith("0x") && isValidTransactionDigest(token));
  if (explicitSuiDigest) {
    signals.push("Detected Sui transaction digest format.");
    return {
      family: "sui",
      chain: "Sui",
      network: detectSuiNetwork(text, input.network),
      targetType: "sui_transaction",
      target: explicitSuiDigest,
      confidence: "high",
      assumptions,
      signals,
    };
  }

  const hex64 = tokens.find((token) => /^0x[a-fA-F0-9]{64}$/.test(token));
  if (hex64) {
    const context = getContext(text, hex64);
    signals.push("Detected 32-byte Sui address/object/package style identifier.");
    return {
      family: "sui",
      chain: "Sui",
      network: detectSuiNetwork(text, input.network),
      targetType: classifySuiTarget(context),
      target: normalize0x(hex64),
      confidence: "high",
      assumptions,
      signals,
    };
  }

  const unsupportedAddress = text.match(/\b0x[a-fA-F0-9]{40}\b/)?.[0];
  if (unsupportedAddress) {
    assumptions.push("A non-Sui 20-byte address was supplied, but this build only analyzes Sui targets.");
    signals.push("Unsupported non-Sui address format detected.");
  }

  return {
    family: "unknown",
    chain: "Unknown",
    network: input.network?.trim() || "mainnet",
    targetType: "unknown",
    target: unsupportedAddress ? normalize0x(unsupportedAddress) : null,
    confidence: "low",
    assumptions: assumptions.length > 0 ? assumptions : ["No Sui wallet, object, package, or transaction digest was detected."],
    signals,
  };
}

function buildUnknownReport(detected: OnchainDetectedTarget): SuiOnchainReport {
  const dataSources: OnchainDataSource[] = [
    {
      name: "Sui Onchain Analyzer",
      status: "skipped",
      configured: true,
      used: false,
      message: "No Sui target was available for public RPC lookup.",
    },
  ];
  return {
    header: {
      agent: "Sui Onchain Analyzer",
      detectedChain: "Sui Mainnet",
      targetType: "unknown",
      target: detected.target,
      confidence: "low",
      timestamp: new Date().toISOString(),
      enrichmentStatus: "preliminary",
      dataSourcesUsed: [],
    },
    detected,
    dataSources,
    executiveSummary:
      "Prepared a Sui analysis boundary. No Sui wallet, object, package, or transaction digest was detected, so no chain activity was read or inferred.",
    targetProfile: ["Target: Not supplied", "Target type: unknown", "Active scope: Sui only"],
    activityAnalysis: ["No live Sui RPC read was performed because the target identifier is missing or unsupported."],
    riskSignals: [
      {
        title: "No suspicious behavior inferred",
        detail: "There is no Sui target to analyze. No wallet activity, balance, or transaction claim is made.",
        severity: "info",
        evidence: "Analyzer detection result",
      },
    ],
    evidenceStatus: dataSources.map((source) => `${source.name}: ${source.status} - ${source.message}`),
    limitations: [
      "Provide a Sui wallet address, Sui transaction digest, Sui object ID, or Sui package ID.",
      "Non-Sui identifiers are outside the active Agent BlackBox Sui proof workflow.",
    ],
    recommendedNextActions: [
      "Paste a Sui wallet, transaction digest, object ID, or package ID into the task prompt.",
      "Store the completed trace on Walrus and anchor the proof on Sui before sharing verification externally.",
    ],
    proofMetadata: {
      proofSystem: "Agent BlackBox trace hash and result hash",
      storageLayer: "Walrus Mainnet trace storage",
      anchorLayer: "Sui Mainnet proof anchor",
      rpcVerification: "Tatum Sui Mainnet RPC for proof reads",
      notes: ["No chain enrichment was performed without a Sui target."],
    },
    explorerLinks: [],
    balanceLookupStatus: "skipped",
    balanceLookupMessage: "No Sui wallet target was supplied.",
  };
}

export async function analyzeOnchainInput(input: OnchainAnalyzeRequest): Promise<SuiOnchainReport> {
  const detected = detectOnchainTarget(input);
  if (detected.family === "sui") {
    return analyzeSuiTarget(detected);
  }
  return buildUnknownReport(detected);
}
