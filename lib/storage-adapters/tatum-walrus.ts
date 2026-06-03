import "server-only";

import { walrusDirectStorageAdapter } from "@/lib/storage-adapters/walrus-direct";
import type { StorageAdapter, StorageStatusResult } from "@/lib/storage-adapters/types";
import { WalrusHttpError } from "@/lib/walrus";

function managedWalrusUnavailable() {
  return new WalrusHttpError(
    "Tatum-managed Walrus upload is not active in this build. Use the Walrus SDK Upload Relay.",
    501,
    "tatum_walrus_inactive",
  );
}

// Optional managed adapter kept behind an explicit provider selection. The default
// production path is the official Walrus SDK Upload Relay.
export const tatumManagedWalrusStorageAdapter: StorageAdapter = {
  id: "tatum_walrus",

  async storeTraceBundle() {
    throw managedWalrusUnavailable();
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
      storageStatus: "not_configured",
    };
  },

  async listStorageRefs() {
    return [];
  },

  async cancelRenewal() {
    throw managedWalrusUnavailable();
  },

  async deleteStoredTrace() {
    throw managedWalrusUnavailable();
  },
};
