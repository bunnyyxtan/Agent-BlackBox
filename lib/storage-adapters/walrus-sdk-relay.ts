import "server-only";

import { createHashFromString, createTraceHash } from "@/lib/hash";
import { fetchWithTimeout, readResponseTextWithLimit } from "@/lib/http/safe-request";
import type {
  StorageAdapter,
  StorageLookup,
  StorageStatusResult,
  StoredTraceVerificationResult,
  TraceBundle,
} from "@/lib/storage-adapters/types";
import { encodeTraceBundle, serializeTraceBundle } from "@/lib/trace-bundle";
import {
  getWalrusConfiguration,
  getWalrusReadUrl,
  readWalrusBlob,
  WalrusHttpError,
} from "@/lib/walrus";
import type { StorageMode, StorageReference } from "@/types/blackbox";

const globalForWalrusRelayStorage = globalThis as typeof globalThis & {
  agentBlackBoxWalrusRelayRefs?: Map<string, StorageReference>;
};

const relayRefs = globalForWalrusRelayStorage.agentBlackBoxWalrusRelayRefs ?? new Map<string, StorageReference>();
globalForWalrusRelayStorage.agentBlackBoxWalrusRelayRefs = relayRefs;

function expiryDate(createdAt: string, storageEpochs: number) {
  const { network } = getWalrusConfiguration();
  const epochDays = network === "mainnet" ? 14 : 1;
  return new Date(new Date(createdAt).getTime() + storageEpochs * epochDays * 24 * 60 * 60 * 1000).toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseTipRequirement(tipConfig: unknown) {
  if (tipConfig === "no_tip") return "no_tip";
  if (asRecord(tipConfig)?.no_tip !== undefined) return "no_tip";
  if (asRecord(tipConfig)?.send_tip !== undefined) return "send_tip";
  return "unknown";
}

function isJsonContentType(contentType: string) {
  const normalized = contentType.toLowerCase();
  return normalized.includes("application/json") || normalized.includes("+json");
}

function responseSnippet(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (/<(?:!doctype|html|head|body|script)\b/i.test(normalized)) {
    return "HTML response omitted.";
  }
  return normalized.replace(/<[^>]+>/g, "").slice(0, 180);
}

function safeUrlHost(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value).host;
  } catch {
    return undefined;
  }
}

export function prepareTraceBundle(traceBundle: TraceBundle) {
  const serialized = serializeTraceBundle(traceBundle);
  return {
    serialized,
    bytes: encodeTraceBundle(traceBundle),
    contentType: "application/json",
    traceHash: createTraceHash(traceBundle.trace),
  };
}

export async function getUploadRelayTipConfig() {
  const { network, relayUrl } = getWalrusConfiguration();
  const checkedAt = new Date().toISOString();
  const relayHost = safeUrlHost(relayUrl);
  if (!relayUrl) {
    return {
      configured: false,
      reachable: false,
      network,
      relayUrl,
      relayHost,
      tipRequirement: "unknown" as const,
      tipConfig: null,
      checkedAt,
      error: "Walrus upload relay is not configured.",
    };
  }

  try {
    const response = await fetchWithTimeout(`${relayUrl}/v1/tip-config`, { cache: "no-store" }, 8_000);
    const contentType = response.headers.get("content-type") ?? "";
    const text = await readResponseTextWithLimit(response, 64 * 1024);
    let tipConfig: unknown = null;
    if (isJsonContentType(contentType) && text.trim()) {
      try {
        tipConfig = JSON.parse(text) as unknown;
      } catch {
        return {
          configured: true,
          reachable: false,
          network,
          relayUrl,
          relayHost,
          tipRequirement: "unknown" as const,
          tipConfig: null,
          checkedAt,
          statusCode: response.status,
          contentType,
          responseSnippet: responseSnippet(text),
          error: "Walrus upload relay returned invalid JSON from /v1/tip-config.",
        };
      }
    } else if (text.trim()) {
      return {
        configured: true,
        reachable: false,
        network,
        relayUrl,
        relayHost,
        tipRequirement: "unknown" as const,
        tipConfig: null,
        checkedAt,
        statusCode: response.status,
        contentType,
        responseSnippet: responseSnippet(text),
        error: `Walrus upload relay returned a non-JSON response from /v1/tip-config. Content-Type: ${
          contentType || "not reported"
        }. Snippet: ${responseSnippet(text) || "empty"}`,
      };
    }
    if (!response.ok) {
      return {
        configured: true,
        reachable: false,
        network,
        relayUrl,
        relayHost,
        tipRequirement: "unknown" as const,
        tipConfig,
        checkedAt,
        statusCode: response.status,
        contentType,
        responseSnippet: responseSnippet(text),
        error: `Walrus upload relay returned HTTP ${response.status}.`,
      };
    }

    return {
      configured: true,
      reachable: true,
      network,
      relayUrl,
      relayHost,
      tipRequirement: parseTipRequirement(tipConfig),
      tipConfig,
      checkedAt,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      network,
      relayUrl,
      relayHost,
      tipRequirement: "unknown" as const,
      tipConfig: null,
      checkedAt,
      error: `Walrus upload relay is unreachable: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

export function createWalrusSdkRelayStorageReference({
  traceBundle,
  storageEpochs,
  storageMode,
  blobId,
  blobObjectId = "",
  uploadJobId,
  relayUrl,
  aggregatorUrl,
  tipConfig,
  feeEstimate,
  createdAt,
}: {
  traceBundle: TraceBundle;
  storageEpochs: number;
  storageMode: StorageMode;
  blobId: string;
  blobObjectId?: string;
  uploadJobId?: string;
  relayUrl: string;
  aggregatorUrl: string;
  tipConfig?: unknown;
  feeEstimate?: string;
  createdAt?: string;
}): StorageReference {
  const checkedAt = new Date().toISOString();
  const created = createdAt ?? checkedAt;
  return {
    uploadJobId:
      uploadJobId ??
      `walrus-relay-upload-${createHashFromString(`${traceBundle.trace.traceHash}:${blobId}:relay`).slice(0, 18)}`,
    fileName: `${traceBundle.trace.sessionId}-trace.json`,
    fileType: "application/json",
    fileSize: encodeTraceBundle(traceBundle).byteLength,
    storageProvider: "walrus_sdk_relay",
    uploadAdapter: "walrus_mainnet_upload_relay",
    storageStatus: "stored",
    storageEpochs,
    expiryDate: expiryDate(created, storageEpochs),
    blobId,
    blobObjectId,
    directReadUrl: getWalrusReadUrl(blobId),
    hashMatched: null,
    noRenewal: storageMode === "permanent",
    storageNetwork: "walrus-mainnet",
    relayUrl,
    aggregatorUrl,
    tipConfig,
    feeEstimate,
    checkedAt,
    createdAt: created,
    updatedAt: checkedAt,
  };
}

function toStatusResult(storage: StorageReference): StorageStatusResult {
  return {
    uploadJobId: storage.uploadJobId,
    blobId: storage.blobId,
    storageProvider: storage.storageProvider,
    uploadAdapter: storage.uploadAdapter,
    storageStatus: storage.storageStatus,
    warning: storage.warning,
  };
}

function findStoredTrace(storageRef: StorageLookup) {
  if (typeof storageRef !== "string") return relayRefs.get(storageRef.blobId) ?? storageRef;
  return (
    relayRefs.get(storageRef) ??
    Array.from(relayRefs.values()).find((ref) => ref.uploadJobId === storageRef || ref.blobId === storageRef)
  );
}

export function hydrateWalrusSdkRelayStorageReference(storage: StorageReference) {
  if (storage.storageProvider === "walrus_sdk_relay") relayRefs.set(storage.blobId, storage);
}

export const walrusSdkRelayStorageAdapter: StorageAdapter = {
  id: "walrus_sdk_relay",

  async storeTraceBundle() {
    throw new WalrusHttpError(
      "Walrus SDK Relay storage requires the connected wallet upload flow.",
      409,
      "wallet_upload_required",
    );
  },

  async getStoredTrace(blobId) {
    const result = await readWalrusBlob(blobId);
    return {
      blobId,
      storageProvider: "walrus_sdk_relay",
      directReadUrl: result.readUrl,
      available: result.available,
      payload: result.payload,
      readStatus: result.readStatus,
      checkedAt: result.checkedAt,
      error: result.error,
    };
  },

  async verifyStoredTrace(blobId, expectedTraceHash): Promise<StoredTraceVerificationResult> {
    const read = await readWalrusBlob(blobId);
    const actualTraceHash = read.payload ? createTraceHash(read.payload.trace) : null;
    return {
      blobId,
      storageProvider: "walrus_sdk_relay",
      expectedTraceHash,
      actualTraceHash,
      hashMatched: actualTraceHash === expectedTraceHash,
      checked: Boolean(read.payload),
      readStatus: read.readStatus,
      checkedAt: read.checkedAt,
      source: "walrus_sdk_relay",
      error: read.error,
    };
  },

  async getStorageStatus(storageRef) {
    const stored = findStoredTrace(storageRef);
    if (stored) return toStatusResult(stored);

    return {
      uploadJobId: typeof storageRef === "string" ? storageRef : storageRef.uploadJobId,
      blobId: typeof storageRef === "string" ? "" : storageRef.blobId,
      storageProvider: "walrus_sdk_relay",
      uploadAdapter: "walrus_mainnet_upload_relay",
      storageStatus: getWalrusConfiguration().relayConfigured ? "pending" : "not_configured",
      warning: "Walrus SDK Relay storage reference is not available in the active session store.",
    };
  },
};
