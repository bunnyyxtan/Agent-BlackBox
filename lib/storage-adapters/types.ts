import type {
  AgentTrace,
  StorageMode,
  StorageProvider,
  StorageReference,
  StorageStatus,
  StorageUploadAdapter,
  WalrusReadStatus,
  InputFile,
  TraceTimelineItem,
} from "@/types/blackbox";
import type { AgentRuntimeOutput } from "@/lib/agents/types";

export interface TraceBundle {
  version: string;
  sessionId: string;
  agentMode: string;
  taskTitle: string;
  taskPrompt: string;
  inputFiles: InputFile[];
  agentOutput: string | AgentRuntimeOutput;
  timeline: TraceTimelineItem[];
  inputHash: string;
  resultHash: string;
  traceHash: string;
  storageNetwork: string;
  createdAt: string;
  ownerWalletAddress: string | null;
  trace: AgentTrace;
}

export interface StoreTraceBundleOptions {
  storageEpochs: number;
  storageMode: StorageMode;
  fileName?: string;
  createdAt?: string;
}

export type StorageLookup = string | StorageReference;

export interface StoredTraceResult {
  blobId: string;
  storageProvider: StorageProvider;
  directReadUrl: string;
  available: boolean;
  payload: TraceBundle | null;
  readStatus: WalrusReadStatus;
  checkedAt: string;
  error?: string;
}

export interface StoredTraceVerificationResult {
  blobId: string;
  storageProvider: StorageProvider;
  expectedTraceHash: string;
  actualTraceHash: string | null;
  hashMatched: boolean;
  checked: boolean;
  readStatus: WalrusReadStatus;
  checkedAt: string;
  source: StorageProvider;
  error?: string;
}

export interface StorageStatusResult {
  uploadJobId: string;
  blobId: string;
  storageProvider: StorageProvider;
  uploadAdapter: StorageUploadAdapter;
  storageStatus: StorageStatus;
  warning?: string;
}

export interface StorageAdapter {
  id: StorageProvider;
  storeTraceBundle(
    traceBundle: TraceBundle,
    options: StoreTraceBundleOptions,
  ): Promise<StorageReference>;
  getStoredTrace(blobId: string): Promise<StoredTraceResult>;
  verifyStoredTrace(
    blobId: string,
    expectedTraceHash: string,
  ): Promise<StoredTraceVerificationResult>;
  getStorageStatus(storageRef: StorageLookup): Promise<StorageStatusResult>;
  listStorageRefs?(): Promise<StorageReference[]>;
  cancelRenewal?(uploadJobId: string, instantDelete?: boolean): Promise<StorageStatusResult>;
  deleteStoredTrace?(uploadJobId: string): Promise<StorageStatusResult>;
}
