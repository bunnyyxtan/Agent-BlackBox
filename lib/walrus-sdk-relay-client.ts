"use client";

import { createHashFromString } from "@/lib/hash";
import { toDAppKitNetwork } from "@/lib/sui-client-helpers";
import { encodeTraceBundle } from "@/lib/trace-bundle";
import type { TraceBundle } from "@/lib/storage-adapters/types";
import type { StorageMode, StorageReference } from "@/types/blackbox";

type UploadProgressStep =
  | "preparing"
  | "opening_wallet"
  | "uploading"
  | "certifying"
  | "reading_back"
  | "saving";

interface WalletTransactionResult {
  $kind?: string;
  Transaction?: {
    digest?: string;
  };
  FailedTransaction?: {
    status?: {
      error?: {
        message?: string;
      };
    };
  };
}

interface StoreTraceBundleWithWalletOptions {
  traceBundle: TraceBundle;
  ownerAddress: string;
  storageEpochs: number;
  storageMode: StorageMode;
  network: string;
  relayUrl: string;
  aggregatorUrl: string;
  tipConfig?: unknown;
  feeEstimate?: string;
  signAndExecuteTransaction: (input: { transaction: unknown }) => Promise<WalletTransactionResult>;
  onProgress?: (step: UploadProgressStep, message: string) => void;
}

export class WalrusSdkRelayClientError extends Error {
  name = "WalrusSdkRelayClientError";

  constructor(
    message: string,
    public readonly code: string,
    public readonly actionName: string,
    public readonly statusCode?: number,
    public readonly contentType?: string,
    public readonly responseSnippet?: string,
  ) {
    super(message);
  }
}

const SUI_GRPC_URLS = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
} as const;

function safeSnippet(value: unknown) {
  if (typeof value !== "string") return undefined;
  return value.replace(/\s+/g, " ").trim().slice(0, 240) || undefined;
}

function getRecord(value: unknown) {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function getNestedRecord(value: unknown, key: string) {
  const record = getRecord(value);
  return getRecord(record?.[key]);
}

function extractStatusCode(error: unknown) {
  const record = getRecord(error);
  const response = getNestedRecord(error, "response");
  const status = record?.status ?? record?.statusCode ?? response?.status ?? response?.statusCode;
  return typeof status === "number" ? status : undefined;
}

function extractContentType(error: unknown) {
  const record = getRecord(error);
  const response = getNestedRecord(error, "response");
  const direct = record?.contentType ?? response?.contentType;
  if (typeof direct === "string") return direct;
  const headers = response?.headers;
  if (headers && typeof (headers as Headers).get === "function") {
    return (headers as Headers).get("content-type") ?? undefined;
  }
  return undefined;
}

function extractResponseSnippet(error: unknown) {
  const record = getRecord(error);
  const response = getNestedRecord(error, "response");
  return (
    safeSnippet(record?.snippet) ??
    safeSnippet(record?.responseSnippet) ??
    safeSnippet(record?.body) ??
    safeSnippet(response?.body) ??
    safeSnippet(response?.data)
  );
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error.");
  return message.replace(/\s+/g, " ").trim().slice(0, 240);
}

async function runWalrusStep<T>(
  actionName: string,
  code: string,
  operation: () => Promise<T> | T,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof WalrusSdkRelayClientError) throw error;
    const message = `${actionName} failed: ${safeErrorMessage(error)}`;
    throw new WalrusSdkRelayClientError(
      message,
      code,
      actionName,
      extractStatusCode(error),
      extractContentType(error),
      extractResponseSnippet(error),
    );
  }
}

function requireTransactionDigest(result: WalletTransactionResult, label: string) {
  if (result.$kind === "Transaction" && result.Transaction?.digest) return result.Transaction.digest;
  if (result.$kind === "FailedTransaction") {
    throw new Error(`${label} failed: ${result.FailedTransaction?.status?.error?.message ?? "wallet transaction failed"}`);
  }
  throw new Error(`${label} did not return a Sui transaction digest.`);
}

async function createRelayClient(networkValue: string, relayUrl: string) {
  const [{ walrus }, { SuiGrpcClient }] = await Promise.all([
    import("@mysten/walrus"),
    import("@mysten/sui/grpc"),
  ]);
  const network = toDAppKitNetwork(networkValue);
  return new SuiGrpcClient({
    network,
    baseUrl: SUI_GRPC_URLS[network],
  }).$extend(
    walrus({
      uploadRelay: {
        host: relayUrl,
        sendTip: {
          max: 1_000_000_000,
        },
      },
    }),
  );
}

export async function storeTraceBundleWithWallet({
  traceBundle,
  ownerAddress,
  storageEpochs,
  storageMode,
  network,
  relayUrl,
  aggregatorUrl,
  tipConfig,
  feeEstimate,
  signAndExecuteTransaction,
  onProgress,
}: StoreTraceBundleWithWalletOptions): Promise<StorageReference> {
  onProgress?.("preparing", "Preparing trace");
  const blob = await runWalrusStep(
    "Trace bundle encoding",
    "trace_bundle_encoding_failed",
    () => encodeTraceBundle(traceBundle),
  );
  const client = await runWalrusStep(
    "Walrus SDK client initialization",
    "walrus_client_init_failed",
    () => createRelayClient(network, relayUrl),
  );
  const flow = await runWalrusStep(
    "Walrus write-blob flow creation",
    "walrus_flow_create_failed",
    () => client.walrus.writeBlobFlow({ blob }),
  );
  const encoded = await runWalrusStep(
    "Walrus blob encoding",
    "walrus_blob_encode_failed",
    () => flow.encode(),
  );

  onProgress?.("opening_wallet", "Opening wallet");
  const registerTransaction = await runWalrusStep(
    "Walrus registration transaction build",
    "walrus_registration_build_failed",
    () => flow.register({
      epochs: storageEpochs,
      owner: ownerAddress,
      deletable: storageMode === "deletable",
      attributes: {
        app: "Agent BlackBox",
        version: traceBundle.version,
        sessionId: traceBundle.sessionId,
        traceHash: traceBundle.traceHash,
      },
    }),
  );
  const registerDigest = await runWalrusStep(
    "Walrus storage registration wallet transaction",
    "walrus_registration_sign_failed",
    async () => requireTransactionDigest(
      await signAndExecuteTransaction({ transaction: registerTransaction }),
      "Walrus storage registration",
    ),
  );

  onProgress?.("uploading", "Uploading via Walrus relay");
  const uploaded = await runWalrusStep(
    "Walrus relay upload request",
    "walrus_relay_upload_failed",
    () => flow.upload({
      digest: registerDigest,
      deletable: storageMode === "deletable",
    }),
  );

  onProgress?.("certifying", "Certifying blob");
  const certifyTransaction = await runWalrusStep(
    "Walrus certification transaction build",
    "walrus_certification_build_failed",
    () => flow.certify(),
  );
  const certifyDigest = await runWalrusStep(
    "Walrus blob certification wallet transaction",
    "walrus_certification_sign_failed",
    async () => requireTransactionDigest(
      await signAndExecuteTransaction({ transaction: certifyTransaction }),
      "Walrus blob certification",
    ),
  );
  const certified = await runWalrusStep(
    "Walrus certified blob lookup",
    "walrus_blob_lookup_failed",
    () => flow.getBlob(),
  ).catch(() => null);

  onProgress?.("reading_back", "Reading blob back");
  const blobId = uploaded.blobId || encoded.blobId;
  const blobObjectId = uploaded.blobObjectId || certified?.blobObject?.id || "";
  const checkedAt = new Date().toISOString();
  return {
    uploadJobId: `walrus-relay-upload-${createHashFromString(`${traceBundle.traceHash}:${blobId}:relay`).slice(0, 18)}`,
    fileName: `${traceBundle.sessionId}-trace.json`,
    fileType: "application/json",
    fileSize: blob.byteLength,
    storageProvider: "walrus_sdk_relay",
    uploadAdapter: "walrus_mainnet_upload_relay",
    storageStatus: "pending",
    storageEpochs,
    storageEndEpoch:
      typeof certified?.blobObject?.storage?.end_epoch === "number"
        ? certified.blobObject.storage.end_epoch
        : undefined,
    expiryDate: new Date(Date.now() + storageEpochs * 14 * 24 * 60 * 60 * 1000).toISOString(),
    blobId,
    blobObjectId,
    directReadUrl: `${aggregatorUrl.replace(/\/$/, "")}/v1/blobs/${encodeURIComponent(blobId)}`,
    hashMatched: null,
    noRenewal: storageMode === "permanent",
    storageNetwork: "walrus-mainnet",
    relayUrl,
    aggregatorUrl,
    feeEstimate,
    tipConfig,
    checkedAt,
    createdAt: traceBundle.createdAt,
    updatedAt: checkedAt,
    warning: `Walrus registration tx: ${registerDigest}. Certification tx: ${certifyDigest}.`,
  };
}
