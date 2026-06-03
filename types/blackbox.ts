import type { AgentRuntimeOutput } from "@/lib/agents/types";

export type AgentMode =
  | "research"
  | "risk_review"
  | "delivery_proof"
  | "onchain_monitor";

export type VerificationStatus = "verified" | "pending" | "tampered" | "failed";

export type StorageStatus =
  | "prepared"
  | "queued"
  | "pending"
  | "stored"
  | "failed"
  | "local_only"
  | "not_configured"
  | "unavailable"
  | "certified"
  | "expired"
  | "cancelled"
  | "deleted";

export type StorageMode = "deletable" | "permanent";

export type StorageProvider = "local" | "walrus_direct" | "walrus_sdk_relay" | "tatum_walrus";

export type StorageUploadAdapter = StorageProvider | "walrus_http_publisher" | "walrus_mainnet_upload_relay";

export type SuiNetwork = "sui-testnet" | "sui-mainnet";

export type WalrusReadStatus = "available" | "unavailable" | "not_configured" | "invalid_json" | "unknown";

export type TimelineStatus = "complete" | "prepared" | "failed";

export type ProofStatus =
  | "prepared"
  | "anchored_pending_object"
  | "anchored"
  | "verified"
  | "failed";

export type ProofMode = "local" | "onchain";

export type TatumRpcVerificationStatus =
  | "local_phase1"
  | "not_configured"
  | "pending"
  | "transaction_found"
  | "passed"
  | "failed";

export interface TraceTimelineItem {
  id: string;
  label: string;
  description: string;
  status: TimelineStatus;
  timestamp: string;
  metadata?: Record<string, string>;
}

export interface ToolCall {
  id: string;
  name: string;
  description: string;
  inputHash: string;
  outputHash: string;
  status: "complete" | "failed";
  timestamp: string;
}

export interface InputFile {
  id: string;
  name: string;
  type: string;
  size: number;
  localPreviewUrl?: string;
  contentHash: string;
  uploadJobId?: string;
  walrusBlobId?: string;
}

export interface AgentTrace {
  sessionId: string;
  userIntent: string;
  agentPlan: string[];
  toolCalls: ToolCall[];
  structuredOutput?: AgentRuntimeOutput;
  finalOutput: string;
  inputHash: string;
  traceHash: string;
  resultHash: string;
  timeline: TraceTimelineItem[];
  createdAt: string;
}

export interface StorageReference {
  uploadJobId: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  storageProvider: StorageProvider;
  requestedStorageProvider?: StorageProvider;
  uploadAdapter: StorageUploadAdapter;
  storageStatus: StorageStatus;
  storageEpochs: number;
  storageEndEpoch?: number;
  expiryDate: string;
  blobId: string;
  blobObjectId: string;
  directReadUrl: string;
  hashMatched: boolean | null;
  noRenewal: boolean;
  warning?: string;
  storageNetwork?: string;
  relayUrl?: string;
  aggregatorUrl?: string;
  feeEstimate?: string;
  tipConfig?: unknown;
  checkedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalrusVerification {
  blobId: string;
  objectId: string;
  readStatus: WalrusReadStatus;
  availabilityStatus: WalrusReadStatus;
  directReadUrl: string;
  hashMatched: boolean;
  checkedAt: string;
  source?: StorageProvider;
  walrusNetwork?: string;
  expectedTraceHash?: string;
  actualTraceHash?: string | null;
  error?: string;
}

export interface ProofMetadata {
  suiObjectId: string;
  transactionDigest: string;
  owner: string | null;
  network: SuiNetwork;
  packageId: string;
  moduleName: string;
  createFunction: string;
  eventType?: string;
  traceHash: string;
  resultHash: string;
  uploadJobId: string;
  uploadAdapter: StorageUploadAdapter;
  storageProvider: StorageProvider;
  storageNetwork?: string;
  blobId: string;
  blobObjectId: string;
  proofMode: ProofMode;
  status: ProofStatus;
  anchoredAt?: string;
  createdAt: string;
}

export interface ExpectedProofFields {
  sessionId: string;
  owner: string;
  traceHash: string;
  resultHash: string;
  inputHash: string;
  blobId: string;
  storageNetwork: string;
}

export interface ProofFieldComparisons {
  sessionId: boolean | null;
  owner: boolean | null;
  traceHash: boolean | null;
  resultHash: boolean | null;
  inputHash: boolean | null;
  blobId: boolean | null;
  storageNetwork: boolean | null;
}

export interface TatumRpcVerification {
  status: TatumRpcVerificationStatus;
  configured: boolean;
  onchain: boolean;
  checkedAt: string;
  objectFound: boolean | null;
  transactionFound: boolean | null;
  eventFound: boolean | null;
  message: string;
  error?: string;
  fieldComparisons?: ProofFieldComparisons;
  eventFieldComparisons?: ProofFieldComparisons;
  mismatchReasons?: string[];
}

export interface VerificationResult {
  storagePrepared: boolean;
  walrusBlobAvailable: boolean;
  directWalrusReadPassed: boolean;
  suiProofFound: boolean;
  tatumRpcPassed: boolean;
  hashMatched: boolean;
  tamperDetected: boolean;
  checkedAt: string;
}

export interface AgentSession {
  id: string;
  rerunOf?: string;
  title: string;
  prompt: string;
  agentMode: AgentMode;
  ownerAddress: string | null;
  createdAt: string;
  updatedAt: string;
  status: VerificationStatus;
  inputFiles: InputFile[];
  trace: AgentTrace;
  storage: StorageReference;
  storageMode: StorageMode;
  storageEpochs: number;
  walrusVerification: WalrusVerification;
  proof: ProofMetadata;
  tatumRpc: TatumRpcVerification;
  verification: VerificationResult;
}

export interface CreateSessionInput {
  id?: string;
  rerunOf?: string;
  title: string;
  prompt: string;
  agentMode: AgentMode;
  files?: Array<Pick<InputFile, "name" | "type" | "size">>;
  storageMode?: StorageMode;
  storageEpochs?: number;
  ownerAddress?: string | null;
  createdAt?: string;
}

export interface CreateAgentSessionRequest {
  rerunOf?: string;
  agentMode: AgentMode;
  taskTitle: string;
  taskPrompt: string;
  inputFiles?: Array<Pick<InputFile, "name" | "type" | "size">>;
  storageDuration?: string | number;
  storageMode?: StorageMode;
  walletAddress?: string | null;
  network?: string;
}

export interface SessionRerunPrefill {
  sourceSessionId: string;
  title: string;
  prompt: string;
  agentMode: AgentMode;
  storageMode: StorageMode;
  storageEpochs: number;
  inputFiles: Array<Pick<InputFile, "name" | "type" | "size">>;
}

export interface LocalVerificationReport {
  session: AgentSession;
  verification: VerificationResult;
  tatumRpc: TatumRpcVerification;
  localReadback: {
    storageProvider: StorageProvider;
    uploadAdapter: StorageUploadAdapter;
    blobId: string;
    available: boolean;
    checked: boolean;
  };
  hashes: {
    sealedTraceHash: string;
    recomputedTraceHash: string;
    sealedResultHash: string;
    recomputedResultHash: string;
    match: boolean;
  };
}

export interface TamperSimulationResult {
  sessionId: string;
  originalResultHash: string;
  tamperedResultHash: string;
  originalTraceHash: string;
  tamperedTraceHash: string;
  match: false;
  tampered: true;
  reason: string;
}

export interface ApiSuccessResponse<T> {
  ok: true;
  message: string;
  data: T;
}
