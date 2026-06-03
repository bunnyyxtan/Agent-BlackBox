import "server-only";

import { createTraceHash } from "@/lib/hash";
import type { TraceBundle } from "@/lib/storage-adapters/types";
import { serializeTraceBundle } from "@/lib/trace-bundle";
import type { StorageMode, WalrusReadStatus } from "@/types/blackbox";

const MAINNET_AGGREGATOR_URL = "https://aggregator.walrus-mainnet.walrus.space";
const MAINNET_UPLOAD_RELAY_URL = "https://upload-relay.mainnet.walrus.space";

export class WalrusHttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 503,
    public readonly code = "walrus_http_error",
  ) {
    super(message);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function trimUrl(value?: string) {
  return value?.trim().replace(/\/$/, "") ?? "";
}

function firstSnippet(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

export function getWalrusConfiguration() {
  const network = process.env.WALRUS_NETWORK?.trim().toLowerCase() || "mainnet";
  const provider =
    process.env.STORAGE_PROVIDER?.trim() ||
    process.env.STORAGE_ADAPTER?.trim() ||
    process.env.NEXT_PUBLIC_STORAGE_PROVIDER?.trim() ||
    "walrus_sdk_relay";
  const publisherUrl = trimUrl(process.env.WALRUS_PUBLISHER_URL);
  const relayUrl =
    trimUrl(process.env.WALRUS_UPLOAD_RELAY_URL) ||
    (network === "mainnet" ? MAINNET_UPLOAD_RELAY_URL : "");
  const aggregatorUrl =
    trimUrl(process.env.WALRUS_AGGREGATOR_URL) ||
    (network === "mainnet" ? MAINNET_AGGREGATOR_URL : "");
  return {
    network,
    provider,
    publisherUrl,
    relayUrl,
    aggregatorUrl,
    configured:
      provider === "walrus_sdk_relay"
        ? Boolean(relayUrl && aggregatorUrl)
        : Boolean(publisherUrl && aggregatorUrl),
    relayConfigured: Boolean(relayUrl && aggregatorUrl),
    publisherConfigured: Boolean(publisherUrl && aggregatorUrl),
  };
}

export function getWalrusNetworkLabel(network = getWalrusConfiguration().network) {
  return network === "testnet" ? "Walrus Testnet" : "Walrus Mainnet";
}

export function getWalrusStoreUrl(storageEpochs: number, storageMode: StorageMode) {
  const { network, publisherUrl } = getWalrusConfiguration();
  if (!publisherUrl) {
    throw new WalrusHttpError(
      `${getWalrusNetworkLabel(network)} publisher is not configured.`,
      503,
      "publisher_not_configured",
    );
  }
  const url = new URL(`${publisherUrl}/v1/blobs`);
  url.searchParams.set("epochs", String(storageEpochs));
  url.searchParams.set(storageMode === "permanent" ? "permanent" : "deletable", "true");
  return url.toString();
}

export function getWalrusReadUrl(blobId: string) {
  const { aggregatorUrl } = getWalrusConfiguration();
  return aggregatorUrl ? `${aggregatorUrl}/v1/blobs/${encodeURIComponent(blobId)}` : "";
}

export async function readWalrusBlob(blobId: string) {
  const readUrl = getWalrusReadUrl(blobId);
  const checkedAt = new Date().toISOString();
  if (!readUrl) {
    return {
      blobId,
      readUrl,
      available: false,
      payload: null,
      readStatus: "not_configured" as WalrusReadStatus,
      checkedAt,
      error: "Walrus aggregator not configured.",
    };
  }

  try {
    const response = await fetch(readUrl, { cache: "no-store" });
    if (!response.ok) {
      return {
        blobId,
        readUrl,
        available: false,
        payload: null,
        readStatus: "unavailable" as WalrusReadStatus,
        checkedAt,
        error:
          response.status === 404
            ? "Walrus blob not found."
            : `Walrus aggregator read failed with status ${response.status}.`,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    try {
      const payload = JSON.parse(text) as TraceBundle;
      if (!payload?.trace) throw new Error("traceBundle.trace is missing.");
      return {
        blobId,
        readUrl,
        available: true,
        payload,
        readStatus: "available" as WalrusReadStatus,
        checkedAt,
      };
    } catch {
      return {
        blobId,
        readUrl,
        available: false,
        payload: null,
        readStatus: "invalid_json" as WalrusReadStatus,
        checkedAt,
        error: `Walrus blob contains invalid trace-bundle JSON. Content-Type: ${
          contentType || "not reported"
        }. Snippet: ${firstSnippet(text) || "empty"}`,
      };
    }
  } catch (error) {
    return {
      blobId,
      readUrl,
      available: false,
      payload: null,
      readStatus: "unavailable" as WalrusReadStatus,
      checkedAt,
      error: `Walrus aggregator read failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

export async function verifyWalrusBlobHash(blobId: string, expectedHash: string) {
  const read = await readWalrusBlob(blobId);
  const actualTraceHash = read.payload ? createTraceHash(read.payload.trace) : null;
  return {
    blobId,
    expectedHash,
    actualTraceHash,
    hashMatched: actualTraceHash === expectedHash,
    checked: Boolean(read.payload),
    readStatus: read.readStatus,
    checkedAt: read.checkedAt,
    source: "walrus_direct" as const,
    error: read.error,
  };
}

export function parseWalrusBlobIds(storageResponse: Record<string, unknown>) {
  const result = asRecord(storageResponse.blobStoreResult) ?? storageResponse;
  const newlyCreated = asRecord(result.newlyCreated);
  const blobObject = asRecord(newlyCreated?.blobObject);
  const storage = asRecord(blobObject?.storage);
  const alreadyCertified = asRecord(result.alreadyCertified);
  return {
    blobId: String(blobObject?.blobId ?? alreadyCertified?.blobId ?? result.blobId ?? ""),
    objectId: String(blobObject?.id ?? result.blobObjectId ?? result.objectId ?? ""),
    endEpoch: toNumber(storage?.endEpoch ?? alreadyCertified?.endEpoch),
    raw: storageResponse,
  };
}
