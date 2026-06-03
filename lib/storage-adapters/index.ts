import "server-only";

import { localStorageAdapter } from "@/lib/storage-adapters/local";
import { tatumManagedWalrusStorageAdapter } from "@/lib/storage-adapters/tatum-walrus";
import type { StorageAdapter, StoreTraceBundleOptions, TraceBundle } from "@/lib/storage-adapters/types";
import { walrusDirectStorageAdapter } from "@/lib/storage-adapters/walrus-direct";
import { walrusSdkRelayStorageAdapter } from "@/lib/storage-adapters/walrus-sdk-relay";
import { getWalrusConfiguration, WalrusHttpError } from "@/lib/walrus";
import type { StorageProvider } from "@/types/blackbox";

const adapters: Record<StorageProvider, StorageAdapter> = {
  local: localStorageAdapter,
  walrus_direct: walrusDirectStorageAdapter,
  walrus_sdk_relay: walrusSdkRelayStorageAdapter,
  tatum_walrus: tatumManagedWalrusStorageAdapter,
};

export function getStorageAdapter(provider?: string): StorageAdapter {
  const selected =
    [
      provider,
      process.env.STORAGE_PROVIDER,
      process.env.STORAGE_ADAPTER,
      process.env.NEXT_PUBLIC_STORAGE_PROVIDER,
    ]
      .map((value) => value?.trim())
      .find(Boolean) ?? "walrus_sdk_relay";
  if (selected === "walrus_http_publisher") return adapters.walrus_direct;
  if (selected && selected in adapters) return adapters[selected as StorageProvider];
  return adapters.walrus_sdk_relay;
}

export function getConfiguredStorageProvider(): StorageProvider {
  return getStorageAdapter().id;
}

export function isWalrusStrictUpload() {
  return process.env.WALRUS_STRICT_UPLOAD?.toLowerCase() !== "false";
}

export async function storeTraceBundleWithFallback(
  traceBundle: TraceBundle,
  options: StoreTraceBundleOptions,
  provider?: string,
) {
  const adapter = getStorageAdapter(provider);
  if (adapter.id !== "walrus_direct") {
    return adapter.storeTraceBundle(traceBundle, options);
  }

  const configuration = getWalrusConfiguration();
  if (!configuration.configured) {
    const networkLabel = configuration.network === "testnet" ? "Walrus Testnet" : "Walrus Mainnet";
    const message = !configuration.publisherUrl
      ? `${networkLabel} publisher is not configured.`
      : `${networkLabel} aggregator is not configured.`;
    if (isWalrusStrictUpload()) throw new WalrusHttpError(message, 503, "walrus_not_configured");
    const fallback = await localStorageAdapter.storeTraceBundle(traceBundle, options);
    return {
      ...fallback,
      requestedStorageProvider: "walrus_direct" as const,
      warning: `${message} Local fallback used.`,
    };
  }

  try {
    return await adapter.storeTraceBundle(traceBundle, options);
  } catch (error) {
    if (isWalrusStrictUpload()) throw error;
    const fallback = await localStorageAdapter.storeTraceBundle(traceBundle, options);
    return {
      ...fallback,
      requestedStorageProvider: "walrus_direct" as const,
      warning: `Walrus upload failed: ${error instanceof Error ? error.message : "unknown error"}. Local fallback used.`,
    };
  }
}

export type {
  StorageAdapter,
  StorageLookup,
  StorageStatusResult,
  StoredTraceResult,
  StoredTraceVerificationResult,
  StoreTraceBundleOptions,
  TraceBundle,
} from "@/lib/storage-adapters/types";
