import "server-only";

import { createHashFromString, createTraceHash } from "@/lib/hash";
import type {
  StorageLookup,
  StorageAdapter,
  StorageStatusResult,
  StoredTraceResult,
  StoredTraceVerificationResult,
  StoreTraceBundleOptions,
  TraceBundle,
} from "@/lib/storage-adapters/types";
import type { StorageReference } from "@/types/blackbox";

interface LocalStoredTrace {
  storage: StorageReference;
  traceBundle: TraceBundle;
}

const globalForLocalStorage = globalThis as typeof globalThis & {
  agentBlackBoxLocalBlobs?: Map<string, LocalStoredTrace>;
};

const localBlobs = globalForLocalStorage.agentBlackBoxLocalBlobs ?? new Map<string, LocalStoredTrace>();
globalForLocalStorage.agentBlackBoxLocalBlobs = localBlobs;

function createId(prefix: string, seed: string, length = 30) {
  return `${prefix}${createHashFromString(seed).slice(0, length)}`;
}

function expiryDate(createdAt: string, storageEpochs: number) {
  return new Date(
    new Date(createdAt).getTime() + storageEpochs * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function findStoredTrace(storageRef: StorageLookup) {
  if (typeof storageRef !== "string") {
    return localBlobs.get(storageRef.blobId);
  }

  return (
    localBlobs.get(storageRef) ??
    Array.from(localBlobs.values()).find(({ storage }) => storage.uploadJobId === storageRef)
  );
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

export function hydrateLocalStoredTrace(storage: StorageReference, traceBundle: TraceBundle) {
  if (storage.storageProvider === "local" && storage.storageStatus !== "deleted") {
    localBlobs.set(storage.blobId, { storage, traceBundle });
  }
}

export const localStorageAdapter: StorageAdapter = {
  id: "local",

  async storeTraceBundle(traceBundle: TraceBundle, options: StoreTraceBundleOptions) {
    const createdAt = options.createdAt ?? new Date().toISOString();
    const traceHash = createTraceHash(traceBundle.trace);
    const blobId = createId("local-blob-", traceHash);
    const storage: StorageReference = {
      uploadJobId: createId("local-upload-", `${traceHash}:upload`, 18),
      fileName: options.fileName ?? `${traceBundle.trace.sessionId}-trace.json`,
      fileType: "application/json",
      fileSize: JSON.stringify(traceBundle).length,
      storageProvider: "local",
      uploadAdapter: "local",
      storageStatus: "local_only",
      storageEpochs: options.storageEpochs,
      expiryDate: expiryDate(createdAt, options.storageEpochs),
      blobId,
      blobObjectId: createId("local-object-", `${traceHash}:object`),
      directReadUrl: `/api/storage/read/${blobId}`,
      hashMatched: traceHash === traceBundle.trace.traceHash,
      noRenewal: options.storageMode === "permanent",
      warning: "This trace is stored through the development local adapter only.",
      createdAt,
      updatedAt: createdAt,
    };

    localBlobs.set(blobId, { storage, traceBundle });
    return storage;
  },

  async getStoredTrace(blobId: string): Promise<StoredTraceResult> {
    const stored = localBlobs.get(blobId);
    return {
      blobId,
      storageProvider: "local",
      directReadUrl: `/api/storage/read/${blobId}`,
      available: Boolean(stored),
      payload: stored?.traceBundle ?? null,
      readStatus: stored ? "available" : "unavailable",
      checkedAt: new Date().toISOString(),
      error: stored ? undefined : "Local trace bundle not found.",
    };
  },

  async verifyStoredTrace(
    blobId: string,
    expectedTraceHash: string,
  ): Promise<StoredTraceVerificationResult> {
    const stored = localBlobs.get(blobId);
    const actualTraceHash = stored ? createTraceHash(stored.traceBundle.trace) : null;
    return {
      blobId,
      storageProvider: "local",
      expectedTraceHash,
      actualTraceHash,
      hashMatched: actualTraceHash === expectedTraceHash,
      checked: Boolean(stored),
      readStatus: stored ? "available" : "unavailable",
      checkedAt: new Date().toISOString(),
      source: "local",
      error: stored ? undefined : "Local trace bundle not found.",
    };
  },

  async getStorageStatus(storageRef: StorageLookup) {
    const stored = findStoredTrace(storageRef);
    if (stored) return toStatusResult(stored.storage);

    const uploadJobId = typeof storageRef === "string" ? storageRef : storageRef.uploadJobId;
    const blobId = typeof storageRef === "string" ? "" : storageRef.blobId;
    return {
      uploadJobId,
      blobId,
      storageProvider: "local",
      uploadAdapter: "local",
      storageStatus: "local_only",
      warning: "Local trace bundle not found in the active development process.",
    };
  },

  async listStorageRefs() {
    return Array.from(localBlobs.values()).map(({ storage }) => storage);
  },

  async cancelRenewal(uploadJobId: string) {
    const stored = findStoredTrace(uploadJobId);
    if (!stored) return this.getStorageStatus(uploadJobId);

    stored.storage.noRenewal = true;
    stored.storage.storageStatus = "cancelled";
    stored.storage.updatedAt = new Date().toISOString();
    return toStatusResult(stored.storage);
  },

  async deleteStoredTrace(uploadJobId: string) {
    const stored = findStoredTrace(uploadJobId);
    if (!stored) return this.getStorageStatus(uploadJobId);

    stored.storage.storageStatus = "deleted";
    stored.storage.updatedAt = new Date().toISOString();
    localBlobs.delete(stored.storage.blobId);
    return toStatusResult(stored.storage);
  },
};
