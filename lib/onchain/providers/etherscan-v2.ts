import "server-only";

import { createHashFromString, stableStringify } from "@/lib/hash";
import { fetchWithTimeout, readResponseTextWithLimit } from "@/lib/http/safe-request";
import type {
  EtherscanProviderStatusSnapshot,
  EvmChainConfig,
  OnchainProviderEvidence,
} from "@/lib/onchain/types";

const DEFAULT_ETHERSCAN_V2_BASE_URL = "https://api.etherscan.io/v2/api";
const ETHERSCAN_TIMEOUT_MS = 10_000;
const ETHERSCAN_RESPONSE_LIMIT = 256 * 1024;

export interface EtherscanV2Config {
  apiKey: string;
  apiKeyPresent: boolean;
  baseUrl: string;
  baseUrlHost: string;
  configured: boolean;
}

interface EtherscanV2Envelope {
  status?: string;
  message?: string;
  result?: unknown;
}

export interface EtherscanV2CallResult {
  actionName: string;
  status: "completed" | "failed" | "skipped";
  summary: string;
  result?: unknown;
  evidence: OnchainProviderEvidence;
}

function safeUrlHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "not configured";
  }
}

function safeSnippet(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  if (/<(?:!doctype|html|head|body|script)\b/i.test(normalized)) {
    return "HTML response omitted.";
  }
  return normalized.replace(/<[^>]+>/g, "").slice(0, 240) || undefined;
}

function safeProviderMessage(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.replace(/\s+/g, " ").trim().slice(0, 240);
  }
  return "Etherscan V2 returned an unsuccessful response.";
}

function inputHash(value: unknown) {
  return createHashFromString(stableStringify(value));
}

function outputHash(value: unknown) {
  return createHashFromString(stableStringify(value));
}

function makeEvidence({
  actionName,
  chain,
  result,
  resultUsedInReport,
  startedAt,
  status,
  summary,
  target,
  error,
}: {
  actionName: string;
  chain: EvmChainConfig;
  result?: unknown;
  resultUsedInReport: boolean;
  startedAt: string;
  status: OnchainProviderEvidence["status"];
  summary: string;
  target?: string | null;
  error?: OnchainProviderEvidence["error"];
}): OnchainProviderEvidence {
  const completedAt = new Date().toISOString();
  const payload = {
    provider: "Etherscan V2",
    actionName,
    chainId: chain.chainId,
    network: chain.key,
    target: target ?? null,
  };
  return {
    provider: "Etherscan V2",
    actionName,
    chainId: chain.chainId,
    network: chain.key,
    ...(target ? { target } : {}),
    status,
    summary,
    startedAt,
    completedAt,
    inputHash: inputHash(payload),
    ...(result !== undefined ? { outputHash: outputHash(result) } : {}),
    resultUsedInReport,
    ...(error ? { error } : {}),
  };
}

function isSuccessfulEnvelope(envelope: EtherscanV2Envelope) {
  if (envelope.status === "1") return true;
  if (envelope.message?.toUpperCase() === "OK") return true;
  return false;
}

function isUsableNoRecordEnvelope(actionName: string, envelope: EtherscanV2Envelope) {
  return actionName === "account.txlist"
    && Array.isArray(envelope.result)
    && /no transactions found/i.test(envelope.message ?? "");
}

export function getEtherscanV2Config(): EtherscanV2Config {
  const apiKey = process.env.ETHERSCAN_API_KEY?.trim() ?? "";
  const baseUrl = process.env.ETHERSCAN_V2_BASE_URL?.trim()
    || process.env.ETHERSCAN_BASE_URL?.trim()
    || DEFAULT_ETHERSCAN_V2_BASE_URL;
  return {
    apiKey,
    apiKeyPresent: Boolean(apiKey),
    baseUrl,
    baseUrlHost: safeUrlHost(baseUrl),
    configured: Boolean(apiKey && baseUrl),
  };
}

export function getEtherscanV2Status(): EtherscanProviderStatusSnapshot {
  const config = getEtherscanV2Config();
  return {
    configured: config.configured,
    status: config.apiKeyPresent ? "configured" : "missing_api_key",
    provider: "Etherscan V2",
    apiKeyPresent: config.apiKeyPresent,
    baseUrlHost: config.baseUrlHost,
    checkedAt: new Date().toISOString(),
    message: config.apiKeyPresent
      ? "Etherscan V2 is configured for EVM wallet and transaction enrichment."
      : "Etherscan V2 API key is missing. EVM reports will be preliminary.",
  };
}

async function callEtherscanV2(
  actionName: string,
  chain: EvmChainConfig,
  params: Record<string, string>,
) {
  const config = getEtherscanV2Config();
  if (!config.configured) {
    throw new Error("Etherscan V2 API key is missing.");
  }
  const url = new URL(config.baseUrl);
  url.searchParams.set("chainid", String(chain.chainId));
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("apikey", config.apiKey);

  const response = await fetchWithTimeout(url, { cache: "no-store" }, ETHERSCAN_TIMEOUT_MS);
  const contentType = response.headers.get("content-type") ?? "";
  const text = await readResponseTextWithLimit(response, ETHERSCAN_RESPONSE_LIMIT);
  if (!response.ok) {
    throw new Error(`Etherscan V2 ${actionName} returned HTTP ${response.status}.`);
  }
  if (!contentType.toLowerCase().includes("json") && text.trim()) {
    throw new Error(`Etherscan V2 ${actionName} returned a non-JSON response: ${safeSnippet(text) ?? "empty"}`);
  }
  try {
    return JSON.parse(text) as EtherscanV2Envelope;
  } catch {
    throw new Error(`Etherscan V2 ${actionName} returned invalid JSON.`);
  }
}

async function runEtherscanAction({
  actionName,
  chain,
  params,
  summarize,
  target,
}: {
  actionName: string;
  chain: EvmChainConfig;
  params: Record<string, string>;
  summarize: (result: unknown) => string;
  target?: string | null;
}): Promise<EtherscanV2CallResult> {
  const startedAt = new Date().toISOString();
  try {
    const envelope = await callEtherscanV2(actionName, chain, params);
    if (!isSuccessfulEnvelope(envelope) && !isUsableNoRecordEnvelope(actionName, envelope)) {
      const message = safeProviderMessage(envelope.result ?? envelope.message);
      return {
        actionName,
        status: "failed",
        summary: message,
        result: envelope.result,
        evidence: makeEvidence({
          actionName,
          chain,
          result: envelope.result,
          resultUsedInReport: false,
          startedAt,
          status: "failed",
          summary: message,
          target,
          error: {
            code: "ETHERSCAN_V2_ACTION_FAILED",
            message,
            status: envelope.status ?? envelope.message,
          },
        }),
      };
    }
    const summary = summarize(envelope.result);
    return {
      actionName,
      status: "completed",
      summary,
      result: envelope.result,
      evidence: makeEvidence({
        actionName,
        chain,
        result: envelope.result,
        resultUsedInReport: true,
        startedAt,
        status: "completed",
        summary,
        target,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Etherscan V2 action failed.";
    return {
      actionName,
      status: "failed",
      summary: message,
      evidence: makeEvidence({
        actionName,
        chain,
        resultUsedInReport: false,
        startedAt,
        status: "failed",
        summary: message,
        target,
        error: {
          code: "ETHERSCAN_V2_UNAVAILABLE",
          message,
        },
      }),
    };
  }
}

function summarizeBalance(result: unknown) {
  if (typeof result !== "string") return "Native balance was returned by Etherscan V2.";
  const wei = BigInt(result || "0");
  const whole = wei / BigInt("1000000000000000000");
  const fraction = (wei % BigInt("1000000000000000000")).toString().padStart(18, "0").slice(0, 6);
  return `Native balance: ${whole.toString()}.${fraction} ETH-equivalent units.`;
}

function summarizeTransactions(result: unknown) {
  if (!Array.isArray(result)) return "Transaction history returned by Etherscan V2.";
  return `Recent transaction history returned ${result.length} record(s).`;
}

function summarizeTransactionStatus(result: unknown) {
  if (typeof result !== "object" || result === null) return "Transaction status returned by Etherscan V2.";
  const status = (result as { status?: unknown }).status;
  if (status === "1") return "Transaction execution status: successful.";
  if (status === "0") return "Transaction execution status: failed.";
  return "Transaction execution status returned by Etherscan V2.";
}

export async function getEtherscanWalletEvidence(chain: EvmChainConfig, address: string) {
  return Promise.all([
    runEtherscanAction({
      actionName: "account.balance",
      chain,
      params: {
        module: "account",
        action: "balance",
        address,
        tag: "latest",
      },
      summarize: summarizeBalance,
      target: address,
    }),
    runEtherscanAction({
      actionName: "account.txlist",
      chain,
      params: {
        module: "account",
        action: "txlist",
        address,
        startblock: "0",
        endblock: "99999999",
        page: "1",
        offset: "10",
        sort: "desc",
      },
      summarize: summarizeTransactions,
      target: address,
    }),
  ]);
}

export async function getEtherscanTransactionEvidence(chain: EvmChainConfig, txHash: string) {
  return [
    await runEtherscanAction({
      actionName: "transaction.gettxreceiptstatus",
      chain,
      params: {
        module: "transaction",
        action: "gettxreceiptstatus",
        txhash: txHash,
      },
      summarize: summarizeTransactionStatus,
      target: txHash,
    }),
  ];
}
