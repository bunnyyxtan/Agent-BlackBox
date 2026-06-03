import "server-only";

import type { OnchainDataSource } from "@/lib/onchain/types";
import { fetchProviderJson } from "@/lib/onchain/providers/http";

interface JsonRpcEnvelope<T = unknown> {
  result?: T;
  error?: {
    code?: number | string;
    message?: string;
    data?: unknown;
  };
}

interface SuiRpcCall<T = unknown> {
  ok: boolean;
  result?: T;
  message: string;
}

export interface SuiRpcSummary {
  balance?: unknown;
  allBalances?: unknown;
  ownedObjects?: unknown;
  transactionBlocks?: unknown[];
  transactionDetails?: unknown[];
  objectData?: unknown;
  source: OnchainDataSource;
  successfulReadCount: number;
  attemptedMethods: string[];
}

const DEFAULT_SUI_RPC_URL = "https://fullnode.mainnet.sui.io:443";

function getSuiRpcConfig() {
  const suiRpcUrl = process.env.SUI_RPC_URL?.trim();
  const rpcUrl = suiRpcUrl || DEFAULT_SUI_RPC_URL;
  return {
    rpcUrl,
    configured: true,
    sourceName: suiRpcUrl ? "Sui RPC" : "Sui Public RPC",
  };
}

function buildSource(status: OnchainDataSource["status"], message: string, used = false): OnchainDataSource {
  const config = getSuiRpcConfig();
  return {
    name: config.sourceName,
    status,
    configured: config.configured,
    used,
    message,
  };
}

async function callSuiRpc<T = unknown>(method: string, params: unknown[]): Promise<SuiRpcCall<T>> {
  const config = getSuiRpcConfig();
  const response = await fetchProviderJson<JsonRpcEnvelope<T>>(config.rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok || !response.data) {
    return {
      ok: false,
      result: undefined,
      message: response.message ?? `${config.sourceName} request failed.`,
    };
  }
  if (response.data.error) {
    return {
      ok: false,
      result: undefined,
      message: response.data.error.message ?? `${config.sourceName} returned an RPC error.`,
    };
  }
  return {
    ok: true,
    result: response.data.result,
    message: `${config.sourceName} request completed.`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTransactionDigest(item: unknown) {
  if (!isRecord(item)) return null;
  if (typeof item.digest === "string") return item.digest;
  if (isRecord(item.data) && typeof item.data.digest === "string") return item.data.digest;
  return null;
}

function readPageData(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.data)) return [];
  return value.data;
}

async function fetchTransactionDetails(digests: string[]) {
  const details = await Promise.all(
    digests.slice(0, 5).map((digest) =>
      callSuiRpc("sui_getTransactionBlock", [
        digest,
        {
          showInput: true,
          showEffects: true,
          showEvents: true,
          showBalanceChanges: true,
          showObjectChanges: true,
        },
      ]),
    ),
  );
  return details;
}

function buildSummary({
  attemptedMethods,
  results,
  payload,
}: {
  attemptedMethods: string[];
  results: Array<SuiRpcCall<unknown>>;
  payload: Omit<SuiRpcSummary, "source" | "successfulReadCount" | "attemptedMethods">;
}): SuiRpcSummary {
  const successfulReadCount = results.filter((item) => item.ok).length;
  return {
    ...payload,
    source: buildSource(
      successfulReadCount > 0 ? "used" : "failed",
      successfulReadCount > 0
        ? `${getSuiRpcConfig().sourceName} returned ${successfulReadCount} public RPC data section(s).`
        : results.map((item) => item.message).filter(Boolean).join(" ") ||
          "Sui public RPC did not return usable data.",
      successfulReadCount > 0,
    ),
    successfulReadCount,
    attemptedMethods,
  };
}

export async function getSuiRpcSummary({
  target,
  targetType,
}: {
  target: string | null;
  targetType: string;
}): Promise<SuiRpcSummary> {
  if (!target) {
    return {
      source: buildSource("skipped", "No Sui target was supplied."),
      successfulReadCount: 0,
      attemptedMethods: [],
    };
  }

  if (targetType === "sui_wallet") {
    const attemptedMethods = [
      "suix_getBalance",
      "suix_getAllBalances",
      "suix_getOwnedObjects",
      "suix_queryTransactionBlocks",
      "sui_getTransactionBlock",
    ];
    const [balance, allBalances, ownedObjects, transactionBlocks] = await Promise.all([
      callSuiRpc("suix_getBalance", [target]),
      callSuiRpc("suix_getAllBalances", [target]),
      callSuiRpc("suix_getOwnedObjects", [
        target,
        { options: { showType: true, showOwner: true, showContent: false } },
        null,
        10,
      ]),
      callSuiRpc("suix_queryTransactionBlocks", [
        {
          filter: {
            FromOrToAddress: {
              addr: target,
            },
          },
          options: {
            showInput: true,
            showEffects: true,
            showEvents: true,
            showBalanceChanges: true,
            showObjectChanges: true,
          },
        },
        null,
        10,
        true,
      ]),
    ]);
    const transactionDigests = readPageData(transactionBlocks.result)
      .map(readTransactionDigest)
      .filter((digest): digest is string => Boolean(digest));
    const transactionDetails = await fetchTransactionDetails(transactionDigests);
    return buildSummary({
      attemptedMethods,
      results: [balance, allBalances, ownedObjects, transactionBlocks, ...transactionDetails],
      payload: {
        balance: balance.ok ? balance.result : undefined,
        allBalances: allBalances.ok ? allBalances.result : undefined,
        ownedObjects: ownedObjects.ok ? ownedObjects.result : undefined,
        transactionBlocks: transactionBlocks.ok ? readPageData(transactionBlocks.result) : undefined,
        transactionDetails: transactionDetails.flatMap((item) => (item.ok && item.result ? [item.result] : [])),
      },
    });
  }

  if (targetType === "sui_transaction") {
    const attemptedMethods = ["sui_getTransactionBlock"];
    const transactionBlock = await callSuiRpc("sui_getTransactionBlock", [
      target,
      {
        showInput: true,
        showEffects: true,
        showEvents: true,
        showBalanceChanges: true,
        showObjectChanges: true,
      },
    ]);
    return buildSummary({
      attemptedMethods,
      results: [transactionBlock],
      payload: {
        transactionDetails: transactionBlock.ok && transactionBlock.result ? [transactionBlock.result] : undefined,
      },
    });
  }

  if (targetType === "sui_object" || targetType === "sui_package") {
    const attemptedMethods = ["sui_getObject"];
    const objectData = await callSuiRpc("sui_getObject", [
      target,
      { showType: true, showOwner: true, showContent: true, showDisplay: true },
    ]);
    return buildSummary({
      attemptedMethods,
      results: [objectData],
      payload: {
        objectData: objectData.ok ? objectData.result : undefined,
      },
    });
  }

  return {
    source: buildSource("skipped", "No Sui RPC method matched the detected target type."),
    successfulReadCount: 0,
    attemptedMethods: [],
  };
}
