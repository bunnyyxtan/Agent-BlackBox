import "server-only";

import { createHashFromString } from "@/lib/hash";
import { walrusDirectStorageAdapter } from "@/lib/storage-adapters/walrus-direct";
import type {
  StorageAdapter,
  StorageStatusResult,
  StoreTraceBundleOptions,
  TraceBundle,
} from "@/lib/storage-adapters/types";
import { getWalrusReadUrl } from "@/lib/walrus";
import type { StorageReference } from "@/types/blackbox";

function createPreparedReference(
  traceBundle: TraceBundle,
  options: StoreTraceBundleOptions,
): StorageReference {
  const createdAt = new Date().toISOString();
  const seed = traceBundle.trace.traceHash;
  const blobId = `walrus-blob-pending-${createHashFromString(seed).slice(0, 18)}`;
  return {
    uploadJobId: `tatum-walrus-upload-${createHashFromString(`${seed}:upload`).slice(0, 18)}`,
    fileName: options.fileName ?? `${traceBundle.trace.sessionId}-trace.json`,
    fileType: "application/json",
    fileSize: JSON.stringify(traceBundle).length,
    storageProvider: "tatum_walrus",
    uploadAdapter: "tatum_walrus",
    storageStatus: "prepared",
    storageEpochs: options.storageEpochs,
    expiryDate: "",
    blobId,
    blobObjectId: "walrus-object-pending",
    directReadUrl: getWalrusReadUrl(blobId),
    hashMatched: false,
    noRenewal: options.storageMode === "permanent",
    createdAt,
    updatedAt: createdAt,
  };
}

// Optional managed adapter. Walrus remains the storage layer and direct blob
// verification remains authoritative even when this upload path is selected.
export const tatumManagedWalrusStorageAdapter: StorageAdapter = {
  id: "tatum_walrus",

  async storeTraceBundle(traceBundle, options) {
    // Phase 2: call Tatum's Walrus-powered storage API with server-side credentials.
    return createPreparedReference(traceBundle, options);
  },

  async getStoredTrace(blobId) {
    return walrusDirectStorageAdapter.getStoredTrace(blobId);
  },

  async verifyStoredTrace(blobId, expectedTraceHash) {
    return walrusDirectStorageAdapter.verifyStoredTrace(blobId, expectedTraceHash);
  },

  async getStorageStatus(storageRef): Promise<StorageStatusResult> {
    return {
      uploadJobId: typeof storageRef === "string" ? storageRef : storageRef.uploadJobId,
      blobId: typeof storageRef === "string" ? "" : storageRef.blobId,
      storageProvider: "tatum_walrus",
      uploadAdapter: "tatum_walrus",
      storageStatus: "pending",
    };
  },

  async listStorageRefs() {
    // Phase 2: list managed Walrus uploads through Tatum's adapter API.
    return [];
  },

  async cancelRenewal(uploadJobId) {
    // Phase 2: submit managed renewal cancellation through the optional adapter.
    return {
      uploadJobId,
      blobId: "",
      storageProvider: "tatum_walrus",
      uploadAdapter: "tatum_walrus",
      storageStatus: "cancelled",
    };
  },

  async deleteStoredTrace(uploadJobId) {
    // Phase 2: execute the managed delete flow through the optional adapter.
    return {
      uploadJobId,
      blobId: "",
      storageProvider: "tatum_walrus",
      uploadAdapter: "tatum_walrus",
      storageStatus: "pending",
    };
  },
};
