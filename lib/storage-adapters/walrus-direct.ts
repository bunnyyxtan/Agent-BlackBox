import "server-only";

import { createHashFromString, createTraceHash } from "@/lib/hash";
import { fetchWithTimeout, readResponseTextWithLimit } from "@/lib/http/safe-request";
import type {
  StorageAdapter,
  StorageStatusResult,
  StoreTraceBundleOptions,
  TraceBundle,
} from "@/lib/storage-adapters/types";
import {
  getWalrusConfiguration,
  getWalrusReadUrl,
  getWalrusStoreUrl,
  parseWalrusBlobIds,
  readWalrusBlob,
  verifyWalrusBlobHash,
  WalrusHttpError,
} from "@/lib/walrus";
import { serializeTraceBundle } from "@/lib/trace-bundle";
import type { StorageReference } from "@/types/blackbox";

const globalForWalrusStorage = globalThis as typeof globalThis & {
  agentBlackBoxWalrusRefs?: Map<string, StorageReference>;
};

const walrusRefs = globalForWalrusStorage.agentBlackBoxWalrusRefs ?? new Map<string, StorageReference>();
globalForWalrusStorage.agentBlackBoxWalrusRefs = walrusRefs;

function expiryDate(createdAt: string, storageEpochs: number) {
  const { network } = getWalrusConfiguration();
  const epochDays = network === "mainnet" ? 14 : 1;
  return new Date(new Date(createdAt).getTime() + storageEpochs * epochDays * 24 * 60 * 60 * 1000).toISOString();
}

function isJsonContentType(contentType: string) {
  const normalized = contentType.toLowerCase();
  return normalized.includes("application/json") || normalized.includes("+json");
}

function responseSnippet(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function createStoredReference(
  traceBundle: TraceBundle,
  options: StoreTraceBundleOptions,
  response: Record<string, unknown>,
): StorageReference {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const seed = traceBundle.trace.traceHash;
  const { blobId, objectId, endEpoch } = parseWalrusBlobIds(response);
  if (!blobId) {
    throw new WalrusHttpError("Walrus publisher response did not include a blob ID.", 502, "invalid_publisher_response");
  }
  return {
    uploadJobId: `walrus-http-upload-${createHashFromString(`${seed}:${blobId}:upload`).slice(0, 18)}`,
    fileName: options.fileName ?? `${traceBundle.trace.sessionId}-trace.json`,
    fileType: "application/json",
    fileSize: new TextEncoder().encode(serializeTraceBundle(traceBundle)).byteLength,
    storageProvider: "walrus_direct",
    uploadAdapter: "walrus_http_publisher",
    storageStatus: "stored",
    storageEpochs: options.storageEpochs,
    storageEndEpoch: endEpoch,
    expiryDate: expiryDate(createdAt, options.storageEpochs),
    blobId,
    blobObjectId: objectId,
    directReadUrl: getWalrusReadUrl(blobId),
    hashMatched: null,
    noRenewal: options.storageMode === "permanent",
    createdAt,
    updatedAt: createdAt,
  };
}

export const walrusDirectStorageAdapter: StorageAdapter = {
  id: "walrus_direct",

  async storeTraceBundle(traceBundle, options) {
    const expectedTraceHash = createTraceHash(traceBundle.trace);
    if (expectedTraceHash !== traceBundle.trace.traceHash) {
      throw new WalrusHttpError("Trace bundle hash changed before Walrus upload.", 422, "trace_hash_mismatch");
    }
    let response: Response;
    try {
      response = await fetchWithTimeout(getWalrusStoreUrl(options.storageEpochs, options.storageMode), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: serializeTraceBundle(traceBundle),
        cache: "no-store",
      }, 10_000);
    } catch (error) {
      throw new WalrusHttpError(
        `Walrus upload failed: ${error instanceof Error ? error.message : "unknown error"}`,
        502,
        "upload_failed",
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    const text = await readResponseTextWithLimit(response, 512 * 1024);
    if (!response.ok) {
      throw new WalrusHttpError(`Walrus upload failed with status ${response.status}.`, 502, "upload_failed");
    }
    if (!isJsonContentType(contentType)) {
      throw new WalrusHttpError(
        `Walrus publisher returned a non-JSON response. Content-Type: ${
          contentType || "not reported"
        }. Snippet: ${responseSnippet(text) || "empty"}`,
        502,
        "invalid_publisher_response",
      );
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new WalrusHttpError("Walrus publisher returned invalid JSON.", 502, "invalid_publisher_response");
    }
    const storage = createStoredReference(traceBundle, options, payload);
    walrusRefs.set(storage.blobId, storage);
    return storage;
  },

  async getStoredTrace(blobId) {
    const result = await readWalrusBlob(blobId);
    return {
      blobId,
      storageProvider: "walrus_direct",
      directReadUrl: result.readUrl,
      available: result.available,
      payload: result.payload,
      readStatus: result.readStatus,
      checkedAt: result.checkedAt,
      error: result.error,
    };
  },

  async verifyStoredTrace(blobId, expectedTraceHash) {
    const result = await verifyWalrusBlobHash(blobId, expectedTraceHash);
    return {
      blobId,
      storageProvider: "walrus_direct",
      expectedTraceHash,
      actualTraceHash: result.actualTraceHash,
      hashMatched: result.hashMatched,
      checked: result.checked,
      readStatus: result.readStatus,
      checkedAt: result.checkedAt,
      source: result.source,
      error: result.error,
    };
  },

  async getStorageStatus(storageRef): Promise<StorageStatusResult> {
    const stored =
      typeof storageRef === "string"
        ? Array.from(walrusRefs.values()).find((ref) => ref.uploadJobId === storageRef || ref.blobId === storageRef)
        : walrusRefs.get(storageRef.blobId) ?? storageRef;
    if (stored) {
      return {
        uploadJobId: stored.uploadJobId,
        blobId: stored.blobId,
        storageProvider: "walrus_direct",
        uploadAdapter: stored.uploadAdapter,
        storageStatus: stored.storageStatus,
        warning: stored.warning,
      };
    }
    return {
      uploadJobId: typeof storageRef === "string" ? storageRef : storageRef.uploadJobId,
      blobId: typeof storageRef === "string" ? "" : storageRef.blobId,
      storageProvider: "walrus_direct",
      uploadAdapter: "walrus_http_publisher",
      storageStatus: getWalrusConfiguration().configured ? "unavailable" : "not_configured",
    };
  },
};

export function hydrateWalrusStorageReference(storage: StorageReference) {
  if (storage.storageProvider === "walrus_direct") walrusRefs.set(storage.blobId, storage);
}
