import "server-only";

import { EVM_CHAIN_REGISTRY } from "@/lib/onchain/chain-registry";
import { analyzeEvmTarget } from "@/lib/onchain/evm-analyzer";
import { analyzeSuiTarget } from "@/lib/onchain/sui-analyzer";
import { isValidTransactionDigest } from "@/lib/sui-client-helpers";
import type {
  EvmChainKey,
  MultichainOnchainReport,
  OnchainAnalyzeRequest,
  OnchainDataSource,
  OnchainDetectedTarget,
  OnchainTargetType,
} from "@/lib/onchain/types";

const EVM_CHAIN_ALIASES: Array<[RegExp, EvmChainKey]> = [
  [/\b(ethereum|eth mainnet|mainnet eth)\b/i, "ethereum"],
  [/\bbase\b/i, "base"],
  [/\b(arbitrum|arb|arb one)\b/i, "arbitrum"],
  [/\b(optimism|op mainnet)\b/i, "optimism"],
  [/\b(polygon|matic)\b/i, "polygon"],
  [/\b(bsc|bnb smart chain|binance smart chain)\b/i, "bsc"],
  [/\b(avalanche|avax|c-chain)\b/i, "avalanche"],
  [/\blinea\b/i, "linea"],
];

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

function detectEvmChain(text: string, requestedNetwork?: string): EvmChainKey | null {
  const networkText = requestedNetwork ? `${requestedNetwork}\n${text}` : text;
  return EVM_CHAIN_ALIASES.find(([pattern]) => pattern.test(networkText))?.[1] ?? null;
}

function detectSuiNetwork(text: string, requestedNetwork?: string) {
  const networkText = requestedNetwork ? `${requestedNetwork}\n${text}` : text;
  if (/\bdevnet\b/i.test(networkText)) return "devnet";
  if (/\btestnet\b/i.test(networkText)) return "testnet";
  return "mainnet";
}

function hasSuiContext(text: string, requestedNetwork?: string) {
  return /\bsui\b|\bwalrus\b|\bobject\b|\bpackage\b|\bmove\b/i.test(`${requestedNetwork ?? ""}\n${text}`);
}

function hasEvmContext(text: string, requestedNetwork?: string) {
  return Boolean(detectEvmChain(text, requestedNetwork)) || /\bevm\b|\bcontract\b|\berc[- ]?20\b|\berc[- ]?721\b/i.test(text);
}

function classifySuiTarget(context: string): OnchainTargetType {
  if (/\b(package|module|contract)\b/i.test(context)) return "sui_package";
  if (/\b(object|coin|nft|cap|registry|proof)\b/i.test(context)) return "sui_object";
  if (/\b(transaction|tx|digest)\b/i.test(context)) return "sui_transaction";
  return "sui_wallet";
}

function classifyEvmAddress(context: string): OnchainTargetType {
  if (/\b(contract|token|erc[- ]?20|erc[- ]?721|erc[- ]?1155)\b/i.test(context)) {
    return "evm_contract";
  }
  return "evm_wallet";
}

export function detectOnchainTarget(input: OnchainAnalyzeRequest): OnchainDetectedTarget {
  const title = input.title?.trim() ?? "";
  const prompt = input.prompt?.trim() ?? "";
  const target = input.target?.trim() ?? "";
  const text = [title, prompt, target, typeof input.evidence === "string" ? input.evidence : ""]
    .filter(Boolean)
    .join("\n");
  const tokens = uniqueValues(text.match(/0x[a-fA-F0-9]{64}|0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,88}/g) ?? []);
  const evmChainKey = detectEvmChain(text, input.network);
  const suiContext = hasSuiContext(text, input.network);
  const evmContext = hasEvmContext(text, input.network);
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

  const evmAddress = tokens.find((token) => /^0x[a-fA-F0-9]{40}$/.test(token));
  if (evmAddress) {
    const chainKey = evmChainKey ?? "ethereum";
    if (!evmChainKey) {
      assumptions.push("No EVM chain was mentioned, so Ethereum Mainnet was assumed for the 20-byte EVM address.");
    }
    const context = getContext(text, evmAddress);
    signals.push("Detected 20-byte EVM address format.");
    return {
      family: "evm",
      chain: EVM_CHAIN_REGISTRY[chainKey].name,
      chainId: EVM_CHAIN_REGISTRY[chainKey].chainId,
      network: chainKey,
      targetType: classifyEvmAddress(context),
      target: normalize0x(evmAddress),
      confidence: evmChainKey ? "high" : "medium",
      assumptions,
      signals,
    };
  }

  const hex64 = tokens.find((token) => /^0x[a-fA-F0-9]{64}$/.test(token));
  if (hex64) {
    const context = getContext(text, hex64);
    if (suiContext) {
      signals.push("Detected 32-byte Sui address/object/package style identifier with Sui context.");
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
    if (evmContext && /\b(transaction|tx|hash)\b/i.test(context)) {
      const chainKey = evmChainKey ?? "ethereum";
      if (!evmChainKey) {
        assumptions.push("No EVM chain was mentioned, so Ethereum Mainnet was assumed for the 32-byte transaction hash.");
      }
      signals.push("Detected 32-byte EVM transaction hash with EVM transaction context.");
      return {
        family: "evm",
        chain: EVM_CHAIN_REGISTRY[chainKey].name,
        chainId: EVM_CHAIN_REGISTRY[chainKey].chainId,
        network: chainKey,
        targetType: "evm_transaction",
        target: normalize0x(hex64),
        confidence: evmChainKey ? "high" : "medium",
        assumptions,
        signals,
      };
    }
    assumptions.push(
      "The 32-byte 0x identifier is ambiguous. It was treated as a Sui identifier because Sui is the primary Agent BlackBox analysis target.",
    );
    signals.push("Detected ambiguous 32-byte 0x identifier.");
    return {
      family: "sui",
      chain: "Sui",
      network: detectSuiNetwork(text, input.network),
      targetType: classifySuiTarget(context),
      target: normalize0x(hex64),
      confidence: "medium",
      assumptions,
      signals,
    };
  }

  return {
    family: "unknown",
    chain: "Unknown",
    network: input.network?.trim() || "unknown",
    targetType: "unknown",
    target: null,
    confidence: "low",
    assumptions: ["No Sui or EVM target identifier was detected."],
    signals,
  };
}

function buildUnknownReport(detected: OnchainDetectedTarget): MultichainOnchainReport {
  const dataSources: OnchainDataSource[] = [
    {
      name: "Onchain Analyzer Router",
      status: "skipped",
      configured: true,
      used: false,
      message: "No Sui or EVM target was available for provider routing.",
    },
  ];
  return {
    header: {
      agent: "Multichain Onchain Analyzer",
      detectedChain: "Unknown",
      targetType: "unknown",
      target: null,
      confidence: "low",
      timestamp: new Date().toISOString(),
      enrichmentStatus: "preliminary",
      dataSourcesUsed: [],
    },
    detected,
    dataSources,
    executiveSummary:
      "Prepared a preliminary onchain analysis boundary. No Sui or EVM target identifier was detected, so no chain activity was read or inferred.",
    targetProfile: ["Target: Not supplied", "Target type: unknown", "Detected chain: unknown"],
    activityAnalysis: ["No live chain activity was read because the target identifier is missing."],
    riskSignals: [
      {
        title: "No suspicious behavior inferred",
        detail: "There is no onchain target to analyze.",
        severity: "info",
        evidence: "Analyzer detection result",
      },
    ],
    evidenceStatus: dataSources.map((source) => `${source.name}: ${source.status} - ${source.message}`),
    limitations: [
      "Provide a Sui address, Sui transaction digest, Sui object/package ID, EVM address, EVM transaction hash, or EVM contract address.",
    ],
    recommendedNextActions: [
      "Paste a wallet address, transaction hash/digest, object ID, package ID, or contract address into the task prompt.",
      "Mention the intended chain when the identifier may be ambiguous.",
    ],
    proofMetadata: {
      proofSystem: "Agent BlackBox trace hash and result hash",
      storageLayer: "Walrus Mainnet trace storage",
      anchorLayer: "Sui Mainnet proof anchor",
      rpcVerification: "Tatum Sui Mainnet RPC for proof reads",
      notes: ["No chain enrichment was performed without a target."],
    },
    explorerLinks: [],
  };
}

export async function analyzeOnchainInput(input: OnchainAnalyzeRequest): Promise<MultichainOnchainReport> {
  const detected = detectOnchainTarget(input);
  if (detected.family === "sui") {
    return analyzeSuiTarget(detected);
  }
  if (detected.family === "evm") {
    return analyzeEvmTarget(detected);
  }
  return buildUnknownReport(detected);
}
