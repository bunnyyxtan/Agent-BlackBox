import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  isValidSuiAddress,
  isValidSuiObjectId,
  isValidTransactionDigest,
  normalizeSuiAddress,
  normalizeSuiObjectId,
} from "@/lib/sui-client-helpers";

import { runAgentRuntime } from "@/lib/agents/agent-runtime";
import type { AgentRuntimeOutput } from "@/lib/agents/types";
import { createLocalAgentSession } from "@/lib/agent-trace";
import { createHashFromString, createResultHash, createTraceHash } from "@/lib/hash";
import { getNetworkConfig, normalizeSuiNetwork } from "@/lib/network-config";
import { seedSessionInputs } from "@/lib/session-store";
import { getStorageAdapter, storeTraceBundleWithFallback } from "@/lib/storage-adapters";
import { hydrateLocalStoredTrace } from "@/lib/storage-adapters/local";
import { hydrateWalrusStorageReference } from "@/lib/storage-adapters/walrus-direct";
import { hydrateWalrusSdkRelayStorageReference } from "@/lib/storage-adapters/walrus-sdk-relay";
import { getSuiProofRegistryConfig } from "@/lib/sui-proof";
import {
  buildLocalPhase1TatumRpcVerification,
  verifyProofMetadata,
} from "@/lib/tatum-rpc";
import { createTraceBundleFromSession } from "@/lib/trace-bundle";
import type {
  AgentMode,
  AgentSession,
  CreateAgentSessionRequest,
  CreateSessionInput,
  LocalVerificationReport,
  StorageMode,
  StorageReference,
  TamperSimulationResult,
  VerificationResult,
} from "@/types/blackbox";

const SESSION_STORE_DIR =
  process.env.AGENT_BLACKBOX_SESSION_STORE_DIR?.trim() ||
  (process.env.VERCEL === "1"
    ? path.join(process.env.TMPDIR || process.env.TEMP || "/tmp", "agent-blackbox")
    : path.join(process.cwd(), ".data"));
const STORE_PATH = path.join(SESSION_STORE_DIR, "sessions.json");
const SUPPORTED_AGENT_MODES = new Set<AgentMode>([
  "research",
  "risk_review",
  "onchain_monitor",
  "delivery_proof",
]);
const SUPPORTED_STORAGE_MODES = new Set<StorageMode>(["deletable", "permanent"]);
const RETIRED_SEED_SESSION_IDS = new Set(["abx-research-market"]);

interface SessionStoreFile {
  version: 1;
  sessions: AgentSession[];
}

export interface SafeSessionListResult {
  sessions: AgentSession[];
  warning: string | null;
}

interface NormalizedSessionInput extends CreateSessionInput {
  title: string;
  prompt: string;
  agentMode: AgentMode;
  storageMode: StorageMode;
  storageEpochs: number;
  ownerAddress: string;
  network: ReturnType<typeof normalizeSuiNetwork>;
}

export interface ProofAnchorInput {
  transactionDigest: string;
  proofObjectId?: string;
  packageId: string;
  network: string;
  owner: string;
}

export class SessionValidationError extends Error {}

export interface FinalizeStorageInput {
  uploadJobId?: string;
  blobId?: string;
  blobObjectId?: string;
  objectId?: string;
  storageEpochs?: number;
  storageMode?: StorageMode;
  storageEndEpoch?: number;
  relayUrl?: string;
  aggregatorUrl?: string;
  feeEstimate?: string;
  tipConfig?: unknown;
  warning?: string;
}

function hydrateProofMetadata(session: AgentSession) {
  const registry = getSuiProofRegistryConfig();
  session.proof.moduleName ??= registry.moduleName;
  session.proof.createFunction ??= registry.createFunction;
  session.proof.storageProvider ??= session.storage.storageProvider;
  session.proof.owner ??= session.ownerAddress;
  session.proof.proofMode ??= isValidTransactionDigest(session.proof.transactionDigest)
    ? "onchain"
    : "local";
  if (session.proof.proofMode === "local" && !isValidTransactionDigest(session.proof.transactionDigest)) {
    session.proof.network = getNetworkConfig().network;
  }
  if (
    (session.proof.status as string) === "onchain_pending" ||
    (session.proof.status === "anchored_pending_object" && !isValidSuiObjectId(session.proof.suiObjectId))
  ) {
    session.proof.status = "prepared";
  }
  if (!isValidSuiObjectId(session.proof.packageId) && registry.configured) {
    session.proof.packageId = registry.packageId;
  }
  if (!session.proof.eventType && isValidSuiObjectId(session.proof.packageId)) {
    session.proof.eventType =
      `${session.proof.packageId}::${session.proof.moduleName}::AgentSessionProofCreated`;
  }
}

function hydrateLocalAdapter(sessions: AgentSession[]) {
  sessions.forEach((session) => {
    hydrateLocalStoredTrace(session.storage, createTraceBundleFromSession(session));
    hydrateWalrusStorageReference(session.storage);
    hydrateWalrusSdkRelayStorageReference(session.storage);
    hydrateProofMetadata(session);
    session.tatumRpc ??= buildLocalPhase1TatumRpcVerification();
  });
}

async function writeStore(sessions: AgentSession[]) {
  // Local JSON storage is for controlled evaluation only. It is not durable or serverless-safe;
  // production should replace this boundary with a database or durable KV store.
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  const payload: SessionStoreFile = { version: 1, sessions };
  const tempPath = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tempPath, STORE_PATH);
}

async function buildStoredSession(
  input: CreateSessionInput,
  network?: string,
  useConfiguredAdapter = false,
  structuredOutput?: AgentRuntimeOutput,
) {
  const session = createLocalAgentSession(input, structuredOutput);
  const storage = await (useConfiguredAdapter ? storeTraceBundleWithFallback : getStorageAdapter("local").storeTraceBundle)(
    createTraceBundleFromSession(session),
    {
      storageEpochs: session.storageEpochs,
      storageMode: session.storageMode,
      fileName: `${session.id}-trace.json`,
      createdAt: session.createdAt,
    },
  );
  const storageAdapter = getStorageAdapter(storage.storageProvider);
  const storageVerification = await storageAdapter.verifyStoredTrace(
    storage.blobId,
    session.trace.traceHash,
  );
  const checkedAt = new Date().toISOString();
  const hashMatched = storageVerification.hashMatched;
  const directWalrus = storage.storageProvider === "walrus_direct" || storage.storageProvider === "walrus_sdk_relay";
  const verificationFailed = storageVerification.checked && !hashMatched;

  return {
    ...session,
    updatedAt: checkedAt,
    status: verificationFailed ? "failed" : "pending",
    storage: { ...storage, hashMatched },
    walrusVerification: {
      ...session.walrusVerification,
      blobId: storage.blobId,
      objectId: storage.blobObjectId,
      directReadUrl: storage.directReadUrl,
      readStatus: directWalrus ? storageVerification.readStatus : "unknown",
      availabilityStatus: directWalrus ? storageVerification.readStatus : "unknown",
      hashMatched: directWalrus && hashMatched,
      checkedAt: storageVerification.checkedAt,
      source: storageVerification.source,
      expectedTraceHash: storageVerification.expectedTraceHash,
      actualTraceHash: storageVerification.actualTraceHash,
      error: directWalrus ? storageVerification.error : storage.warning,
    },
    proof: {
      ...session.proof,
      network: normalizeSuiNetwork(network),
      uploadJobId: storage.uploadJobId,
      uploadAdapter: storage.uploadAdapter,
      storageProvider: storage.storageProvider,
      storageNetwork: storage.storageNetwork,
      blobId: storage.blobId,
      blobObjectId: storage.blobObjectId,
    },
    tatumRpc: buildLocalPhase1TatumRpcVerification(),
    verification: {
      ...session.verification,
      storagePrepared: true,
      walrusBlobAvailable: directWalrus && storageVerification.readStatus === "available",
      directWalrusReadPassed: directWalrus && storageVerification.checked && hashMatched,
      hashMatched,
      tamperDetected: verificationFailed,
      checkedAt,
    },
  } satisfies AgentSession;
}

let initializationPromise: Promise<AgentSession[]> | null = null;
let storeMutationQueue: Promise<void> = Promise.resolve();

function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

function shouldWriteSeedSessions() {
  return process.env.AGENT_BLACKBOX_SEED_SESSIONS === "true" && !isVercelRuntime();
}

function getServerlessSessionStoreWarning() {
  if (!isVercelRuntime()) return null;
  return "This deployment is using local JSON session storage, which is not durable on Vercel. The page will stay available, but production sessions need durable storage.";
}

function formatSessionStoreWarning(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as NodeJS.ErrnoException).code)
      : "";
  if (code === "ENOENT") {
    return "No local session archive was found. Showing an empty session list.";
  }
  if (code === "EACCES" || code === "EROFS" || code === "EPERM") {
    return "Local session storage is not writable in this deployment. Showing an empty session list.";
  }
  if (error instanceof SyntaxError) {
    return "The local session archive could not be parsed. Showing an empty session list.";
  }
  return "Local session storage is unavailable. Showing an empty session list.";
}

async function withStoreMutation<T>(operation: () => Promise<T>) {
  const previous = storeMutationQueue;
  let release!: () => void;
  storeMutationQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function initializeStore() {
  const sessions: AgentSession[] = [];
  for (const input of seedSessionInputs) {
    sessions.push(await buildStoredSession(input, getNetworkConfig().network));
  }
  await writeStore(sessions);
  return sessions;
}

async function ensureSeedSessionCoverage(sessions: AgentSession[]) {
  const network = getNetworkConfig().network;
  const nextSessions = sessions.filter((session) => !RETIRED_SEED_SESSION_IDS.has(session.id));
  let changed = nextSessions.length !== sessions.length;

  for (const input of seedSessionInputs) {
    if (!input.id) continue;
    const index = nextSessions.findIndex((session) => session.id === input.id);
    if (index === -1) {
      nextSessions.push(await buildStoredSession(input, network));
      changed = true;
      continue;
    }
    const existing = nextSessions[index];
    if (existing.title !== input.title || existing.agentMode !== input.agentMode) {
      nextSessions[index] = await buildStoredSession(input, network);
      changed = true;
    }
  }

  if (!changed) return sessions;
  await writeStore(nextSessions);
  return nextSessions;
}

async function readStore() {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const payload = JSON.parse(raw) as SessionStoreFile;
    const storedSessions = (payload.sessions ?? []).filter(
      (session) => !RETIRED_SEED_SESSION_IDS.has(session.id),
    );
    const sessions = shouldWriteSeedSessions()
      ? await ensureSeedSessionCoverage(storedSessions)
      : storedSessions;
    hydrateLocalAdapter(sessions);
    return sessions;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (!shouldWriteSeedSessions()) return [];
    initializationPromise ??= initializeStore();
    const sessions = await initializationPromise;
    hydrateLocalAdapter(sessions);
    return sessions;
  }
}

function parseStorageEpochs(value?: string | number) {
  const configured = value ?? process.env.WALRUS_STORAGE_EPOCHS ?? "1";
  const normalized = typeof configured === "number" ? String(configured) : configured.trim();
  const match = normalized.match(/^(\d+)(?:-epochs?)?$/);
  const epochs = match ? Number(match[1]) : Number.NaN;
  if (!Number.isInteger(epochs) || epochs < 1 || epochs > 53) {
    throw new SessionValidationError("storageDuration must be between 1 and 53 epochs.");
  }
  return epochs;
}

function normalizeCreateInput(input: CreateAgentSessionRequest): NormalizedSessionInput {
  const title = typeof input.taskTitle === "string" ? input.taskTitle.trim() : "";
  const prompt = typeof input.taskPrompt === "string" ? input.taskPrompt.trim() : "";
  if (!title) throw new SessionValidationError("taskTitle is required.");
  if (!prompt) throw new SessionValidationError("taskPrompt is required.");
  if (!SUPPORTED_AGENT_MODES.has(input.agentMode)) {
    throw new SessionValidationError("agentMode is not supported.");
  }

  const storageMode = input.storageMode ?? "deletable";
  if (!SUPPORTED_STORAGE_MODES.has(storageMode)) {
    throw new SessionValidationError("storageMode must be deletable or permanent.");
  }

  const walletAddress = typeof input.walletAddress === "string" ? input.walletAddress.trim() : "";
  if (!walletAddress) {
    throw new SessionValidationError("walletAddress is required.");
  }
  if (!isValidSuiAddress(walletAddress)) {
    throw new SessionValidationError("walletAddress must be a valid Sui address.");
  }

  const requestedNetwork = input.network ?? getNetworkConfig().network;
  if (!["testnet", "sui-testnet", "mainnet", "sui-mainnet"].includes(requestedNetwork)) {
    throw new SessionValidationError("network must be sui-testnet or sui-mainnet.");
  }

  return {
    rerunOf: typeof input.rerunOf === "string" && input.rerunOf.trim() ? input.rerunOf.trim().slice(0, 96) : undefined,
    title,
    prompt,
    agentMode: input.agentMode,
    files: input.inputFiles ?? [],
    storageMode,
    storageEpochs: parseStorageEpochs(input.storageDuration),
    ownerAddress: normalizeSuiAddress(walletAddress),
    network: normalizeSuiNetwork(requestedNetwork),
  };
}

async function persistSession(session: AgentSession) {
  return withStoreMutation(async () => {
    const sessions = await readStore();
    await writeStore([session, ...sessions.filter((item) => item.id !== session.id)]);
    return session;
  });
}

export async function createSession(input: CreateAgentSessionRequest) {
  const normalized = normalizeCreateInput(input);
  const createdAt = new Date().toISOString();
  const idSeed = `${normalized.title}:${normalized.prompt}:${createdAt}`;
  const id = `abx-${Date.now().toString(36)}-${createHashFromString(idSeed).slice(0, 8)}`;
  const structuredOutput = await runAgentRuntime({
    sessionId: id,
    agentMode: normalized.agentMode,
    taskTitle: normalized.title,
    taskPrompt: normalized.prompt,
    inputFiles: normalized.files ?? [],
    ownerAddress: normalized.ownerAddress,
    network: normalized.network,
    storageMode: normalized.storageMode,
    storageEpochs: normalized.storageEpochs,
    createdAt,
  });
  const session = await buildStoredSession({ ...normalized, id, createdAt }, normalized.network, true, structuredOutput);
  return persistSession(session);
}

export async function prepareSessionDraft(input: CreateAgentSessionRequest) {
  const normalized = normalizeCreateInput(input);
  const createdAt = new Date().toISOString();
  const idSeed = `${normalized.title}:${normalized.prompt}:${createdAt}`;
  const id = `abx-${Date.now().toString(36)}-${createHashFromString(idSeed).slice(0, 8)}`;
  const structuredOutput = await runAgentRuntime({
    sessionId: id,
    agentMode: normalized.agentMode,
    taskTitle: normalized.title,
    taskPrompt: normalized.prompt,
    inputFiles: normalized.files ?? [],
    ownerAddress: normalized.ownerAddress,
    network: normalized.network,
    storageMode: normalized.storageMode,
    storageEpochs: normalized.storageEpochs,
    createdAt,
  });
  const session = createLocalAgentSession({ ...normalized, id, createdAt }, structuredOutput);
  const network = normalized.network;
  const draft: AgentSession = {
    ...session,
    status: "pending",
    storage: {
      ...session.storage,
      storageProvider: "walrus_sdk_relay",
      requestedStorageProvider: "walrus_sdk_relay",
      uploadAdapter: "walrus_mainnet_upload_relay",
      storageStatus: "pending",
      hashMatched: null,
      storageNetwork: "walrus-mainnet",
      warning: "Walrus Mainnet SDK Relay upload is awaiting connected wallet approval.",
    },
    walrusVerification: {
      ...session.walrusVerification,
      readStatus: "unknown",
      availabilityStatus: "unknown",
      hashMatched: false,
      walrusNetwork: "mainnet",
    },
    proof: {
      ...session.proof,
      network,
      storageProvider: "walrus_sdk_relay",
      storageNetwork: "walrus-mainnet",
      uploadAdapter: "walrus_mainnet_upload_relay",
      status: "prepared",
    },
    verification: {
      ...session.verification,
      walrusBlobAvailable: false,
      directWalrusReadPassed: false,
      hashMatched: false,
    },
  };

  const persistedDraft = await persistSession(draft);

  return {
    session: persistedDraft,
    agentResult: structuredOutput,
    traceBundle: createTraceBundleFromSession(persistedDraft),
  };
}

function readStorageString(value: unknown, field: string, required = true) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new SessionValidationError(`${field} is required.`);
    return "";
  }
  if (typeof value !== "string") {
    throw new SessionValidationError(`${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized && required) throw new SessionValidationError(`${field} is required.`);
  if (normalized.length > 512) throw new SessionValidationError(`${field} is too long.`);
  return normalized;
}

export async function finalizeSessionStorage(id: string, input: FinalizeStorageInput) {
  const session = await getSessionById(id);
  if (!session) return undefined;
  if (!session.ownerAddress || !isValidSuiAddress(session.ownerAddress)) {
    throw new SessionValidationError("A valid session owner wallet is required.");
  }
  if (createTraceHash(session.trace) !== session.trace.traceHash) {
    throw new SessionValidationError("Session trace hash does not match the sealed trace.");
  }
  if (session.proof.proofMode === "onchain" || isValidTransactionDigest(session.proof.transactionDigest)) {
    throw new SessionValidationError("Storage cannot be finalized after proof anchoring has started.");
  }
  if (session.storage.storageProvider !== "walrus_sdk_relay") {
    throw new SessionValidationError("Session is not awaiting Walrus SDK Relay finalization.");
  }
  if (!["prepared", "pending", "queued"].includes(session.storage.storageStatus)) {
    throw new SessionValidationError("Session is not in a finalizable storage state.");
  }

  const uploadJobId = readStorageString(input.uploadJobId, "uploadJobId");
  const blobId = readStorageString(input.blobId, "blobId");
  const blobObjectId = readStorageString(input.blobObjectId || input.objectId, "blobObjectId", false);
  if (input.storageEpochs !== undefined && input.storageEpochs !== session.storageEpochs) {
    throw new SessionValidationError("storageEpochs must match the prepared session.");
  }
  if (input.storageMode !== undefined && input.storageMode !== session.storageMode) {
    throw new SessionValidationError("storageMode must match the prepared session.");
  }

  const adapter = getStorageAdapter("walrus_sdk_relay");
  const storageVerification = await adapter.verifyStoredTrace(blobId, session.trace.traceHash);
  if (!storageVerification.checked) {
    throw new SessionValidationError(storageVerification.error ?? "Walrus Mainnet blob could not be read from the aggregator.");
  }
  if (!storageVerification.hashMatched) {
    throw new SessionValidationError("Walrus Mainnet blob hash mismatch.");
  }

  const checkedAt = new Date().toISOString();
  const finalizedStorage: StorageReference = {
    ...session.storage,
    uploadJobId,
    blobId,
    blobObjectId,
    directReadUrl: `/api/storage/read/${blobId}`,
    hashMatched: true,
    storageStatus: "stored",
    storageNetwork: "walrus-mainnet",
    storageEpochs: session.storageEpochs,
    storageEndEpoch: input.storageEndEpoch,
    relayUrl: readStorageString(input.relayUrl, "relayUrl", false) || session.storage.relayUrl,
    aggregatorUrl: readStorageString(input.aggregatorUrl, "aggregatorUrl", false) || session.storage.aggregatorUrl,
    feeEstimate: readStorageString(input.feeEstimate, "feeEstimate", false) || session.storage.feeEstimate,
    tipConfig: input.tipConfig ?? session.storage.tipConfig,
    warning:
      typeof input.warning === "string"
        ? input.warning.replace(/\s+/g, " ").trim().slice(0, 500)
        : session.storage.warning,
    checkedAt: storageVerification.checkedAt,
    updatedAt: checkedAt,
  };
  hydrateWalrusSdkRelayStorageReference(finalizedStorage);

  const finalizedSession: AgentSession = {
    ...session,
    status: "pending",
    updatedAt: checkedAt,
    storage: finalizedStorage,
    walrusVerification: {
      ...session.walrusVerification,
      blobId: finalizedStorage.blobId,
      objectId: finalizedStorage.blobObjectId,
      directReadUrl: finalizedStorage.directReadUrl,
      readStatus: storageVerification.readStatus,
      availabilityStatus: storageVerification.readStatus,
      hashMatched: true,
      checkedAt: storageVerification.checkedAt,
      source: "walrus_sdk_relay",
      walrusNetwork: "mainnet",
      expectedTraceHash: storageVerification.expectedTraceHash,
      actualTraceHash: storageVerification.actualTraceHash,
      error: storageVerification.error,
    },
    proof: {
      ...session.proof,
      uploadJobId: finalizedStorage.uploadJobId,
      uploadAdapter: finalizedStorage.uploadAdapter,
      storageProvider: "walrus_sdk_relay",
      storageNetwork: "walrus-mainnet",
      blobId: finalizedStorage.blobId,
      blobObjectId: finalizedStorage.blobObjectId,
    },
    verification: {
      ...session.verification,
      storagePrepared: true,
      walrusBlobAvailable: true,
      directWalrusReadPassed: true,
      hashMatched: true,
      tamperDetected: false,
      checkedAt,
    },
  };

  return persistSession(finalizedSession);
}

export async function listSessions() {
  const sessions = await readStore();
  return [...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listSessionsSafe(): Promise<SafeSessionListResult> {
  try {
    const sessions = await listSessions();
    return {
      sessions,
      warning: getServerlessSessionStoreWarning(),
    };
  } catch (error) {
    return {
      sessions: [],
      warning: formatSessionStoreWarning(error),
    };
  }
}

export async function getSessionById(id: string) {
  const sessions = await readStore();
  return sessions.find((session) => session.id === id);
}

export async function getSessionByIdSafe(id: string) {
  try {
    return await getSessionById(id);
  } catch {
    return undefined;
  }
}

function shortReference(value: string | null | undefined, head = 12, tail = 8) {
  if (!value) return "";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function redactSessionSummary(session: AgentSession) {
  return {
    id: session.id,
    title: session.title,
    agentMode: session.agentMode,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    status: session.status,
    owner: shortReference(session.ownerAddress, 10, 6),
    fileCount: session.inputFiles.length,
    hashes: {
      inputHash: shortReference(session.trace.inputHash),
      resultHash: shortReference(session.trace.resultHash),
      traceHash: shortReference(session.trace.traceHash),
    },
    storage: {
      provider: session.storage.storageProvider,
      status: session.storage.storageStatus,
      network: session.storage.storageNetwork,
      blobId: shortReference(session.storage.blobId),
      hashMatched: session.storage.hashMatched,
    },
    proof: {
      status: session.proof.status,
      network: session.proof.network,
      transactionDigest: shortReference(session.proof.transactionDigest),
      suiObjectId: shortReference(session.proof.suiObjectId),
    },
    verification: {
      walrusBlobAvailable: session.verification.walrusBlobAvailable,
      directWalrusReadPassed: session.verification.directWalrusReadPassed,
      suiProofFound: session.verification.suiProofFound,
      tatumRpcPassed: session.verification.tatumRpcPassed,
      hashMatched: session.verification.hashMatched,
      checkedAt: session.verification.checkedAt,
    },
  };
}

export async function listSessionSummaries() {
  const sessions = await listSessions();
  return sessions.map(redactSessionSummary);
}

export async function listSessionSummariesSafe() {
  const { sessions, warning } = await listSessionsSafe();
  return {
    sessions: sessions.map(redactSessionSummary),
    warning,
  };
}

export async function anchorSessionProof(id: string, input: ProofAnchorInput) {
  const session = await getSessionById(id);
  if (!session) return undefined;

  const transactionDigest = input.transactionDigest.trim();
  const proofObjectId = input.proofObjectId?.trim();
  const packageId = input.packageId.trim();
  const owner = input.owner.trim();
  if (!isValidTransactionDigest(transactionDigest)) {
    throw new SessionValidationError("transactionDigest must be a valid Sui transaction digest.");
  }
  if (proofObjectId && !isValidSuiObjectId(proofObjectId)) {
    throw new SessionValidationError("proofObjectId must be a valid Sui object ID.");
  }
  if (!isValidSuiObjectId(packageId)) {
    throw new SessionValidationError("packageId must be a valid Sui package ID.");
  }
  if (!isValidSuiAddress(owner)) {
    throw new SessionValidationError("owner must be a valid Sui address.");
  }
  if (!["testnet", "sui-testnet", "mainnet", "sui-mainnet"].includes(input.network)) {
    throw new SessionValidationError("network must be sui-testnet or sui-mainnet.");
  }

  const normalizedOwner = normalizeSuiAddress(owner);
  const normalizedPackageId = normalizeSuiObjectId(packageId);
  const normalizedProofObjectId = proofObjectId
    ? normalizeSuiObjectId(proofObjectId)
    : undefined;
  const network = normalizeSuiNetwork(input.network);
  const registry = getSuiProofRegistryConfig();
  if (
    !registry.configured ||
    normalizeSuiObjectId(registry.packageId) !== normalizedPackageId
  ) {
    throw new SessionValidationError(
      "packageId must match the configured Agent BlackBox proof package.",
    );
  }
  if (!session.ownerAddress) {
    throw new SessionValidationError("The session must have a recorded owner wallet before proof anchoring.");
  }
  if (normalizeSuiAddress(session.ownerAddress) !== normalizedOwner) {
    throw new SessionValidationError(
      "The connected wallet must match the wallet that created this session.",
    );
  }
  if (!session.storage.blobId || session.storage.storageProvider === "local") {
    throw new SessionValidationError(
      "A real Walrus-backed trace blob is required before proof anchoring.",
    );
  }
  if (session.proof.network !== network) {
    throw new SessionValidationError(
      `The proof must be anchored on ${session.proof.network}.`,
    );
  }
  if (
    isValidTransactionDigest(session.proof.transactionDigest) &&
    session.proof.transactionDigest !== transactionDigest
  ) {
    throw new SessionValidationError("This session already has a different Sui proof anchor.");
  }

  const checkedAt = new Date().toISOString();
  const candidateProof = {
    ...session.proof,
    suiObjectId: normalizedProofObjectId ?? session.proof.suiObjectId,
    transactionDigest,
    owner: normalizedOwner,
    network,
    packageId: normalizedPackageId,
    moduleName: registry.moduleName,
    createFunction: registry.createFunction,
    eventType: registry.eventType,
    proofMode: "onchain" as const,
  };
  const tatumRpc = await verifyProofMetadata(candidateProof, {
    sessionId: session.id,
    owner: normalizedOwner,
    traceHash: session.trace.traceHash,
    resultHash: session.trace.resultHash,
    inputHash: session.trace.inputHash,
    blobId: session.storage.blobId,
    storageNetwork: session.storage.storageNetwork ?? session.proof.storageNetwork ?? "walrus-mainnet",
  });
  const proofVerified = tatumRpc.status === "passed";
  const anchoredSession: AgentSession = {
    ...session,
    updatedAt: checkedAt,
    proof: {
      ...candidateProof,
      suiObjectId: normalizedProofObjectId ?? session.proof.suiObjectId,
      transactionDigest,
      owner: normalizedOwner,
      network,
      packageId: normalizedPackageId,
      moduleName: registry.moduleName,
      createFunction: registry.createFunction,
      eventType: registry.eventType,
      proofMode: "onchain",
      status: proofVerified ? "verified" : "prepared",
      ...(proofVerified ? { anchoredAt: checkedAt } : {}),
    },
    tatumRpc,
  };

  return persistSession(anchoredSession);
}

export async function verifySession(id: string): Promise<LocalVerificationReport | undefined> {
  const session = await getSessionByIdSafe(id);
  if (!session) return undefined;

  const adapter = getStorageAdapter(session.storage.storageProvider);
  const storedTrace = await adapter.getStoredTrace(session.storage.blobId);
  const storageVerification = await adapter.verifyStoredTrace(
    session.storage.blobId,
    session.proof.traceHash,
  );
  const replayedTrace = storedTrace.payload?.trace ?? session.trace;
  const recomputedResultHash = createResultHash(replayedTrace.finalOutput);
  const recomputedTraceHash = createTraceHash(replayedTrace);
  const hashMatched =
    storedTrace.available &&
    storageVerification.checked &&
    storageVerification.hashMatched &&
    recomputedResultHash === session.trace.resultHash &&
    recomputedResultHash === session.proof.resultHash &&
    recomputedTraceHash === session.trace.traceHash &&
    recomputedTraceHash === session.proof.traceHash;
  const checkedAt = new Date().toISOString();
  const directWalrus = session.storage.storageProvider === "walrus_direct" || session.storage.storageProvider === "walrus_sdk_relay";
  const verificationFailed = storageVerification.checked && !storageVerification.hashMatched;
  const tatumRpc = await verifyProofMetadata(session.proof, {
    sessionId: session.id,
    owner: session.proof.owner ?? session.ownerAddress ?? "",
    traceHash: session.trace.traceHash,
    resultHash: session.trace.resultHash,
    inputHash: session.trace.inputHash,
    blobId: session.storage.blobId,
    storageNetwork: session.storage.storageNetwork ?? session.proof.storageNetwork ?? "walrus-mainnet",
  });
  const verification: VerificationResult = {
    ...session.verification,
    storagePrepared: true,
    walrusBlobAvailable: directWalrus && storedTrace.available,
    directWalrusReadPassed: directWalrus && storageVerification.checked && storageVerification.hashMatched,
    suiProofFound: tatumRpc.objectFound === true,
    tatumRpcPassed: tatumRpc.status === "passed",
    hashMatched,
    tamperDetected: verificationFailed,
    checkedAt,
  };
  const verifiedSession: AgentSession = {
    ...session,
    updatedAt: checkedAt,
    status: verificationFailed ? "failed" : tatumRpc.status === "passed" && hashMatched ? "verified" : "pending",
    proof: {
      ...session.proof,
      status:
        tatumRpc.status === "passed"
          ? "verified"
          : session.proof.status === "anchored_pending_object"
            ? "prepared"
            : session.proof.status,
    },
    storage: { ...session.storage, hashMatched },
    walrusVerification: {
      ...session.walrusVerification,
      readStatus: directWalrus ? storageVerification.readStatus : "unknown",
      availabilityStatus: directWalrus ? storageVerification.readStatus : "unknown",
      hashMatched: directWalrus && storageVerification.hashMatched,
      checkedAt: storageVerification.checkedAt,
      source: storageVerification.source,
      expectedTraceHash: storageVerification.expectedTraceHash,
      actualTraceHash: storageVerification.actualTraceHash,
      error: directWalrus ? storageVerification.error : session.storage.warning,
    },
    tatumRpc,
    verification,
  };

  return {
    session: verifiedSession,
    verification,
    tatumRpc,
    localReadback: {
      storageProvider: session.storage.storageProvider,
      uploadAdapter: session.storage.uploadAdapter,
      blobId: session.storage.blobId,
      available: storedTrace.available,
      checked: storageVerification.checked,
    },
    hashes: {
      sealedTraceHash: session.proof.traceHash,
      recomputedTraceHash,
      sealedResultHash: session.proof.resultHash,
      recomputedResultHash,
      match: hashMatched,
    },
  };
}

export async function recheckSession(id: string) {
  const report = await verifySession(id);
  if (!report) return undefined;
  await persistSession(report.session);
  return report;
}

export async function simulateTamper(
  id: string,
  tamperedOutput?: string,
): Promise<TamperSimulationResult | undefined> {
  const session = await getSessionByIdSafe(id);
  if (!session) return undefined;

  const requestedOutput = tamperedOutput?.trim();
  const changedOutput =
    requestedOutput && requestedOutput !== session.trace.finalOutput
      ? requestedOutput
      : `${session.trace.finalOutput}\n\n[Local tamper simulation: final output changed after sealing.]`;
  const tamperedResultHash = createResultHash(changedOutput);
  const tamperedTraceHash = createTraceHash({
    ...session.trace,
    finalOutput: changedOutput,
    resultHash: tamperedResultHash,
  });

  return {
    sessionId: session.id,
    originalResultHash: session.proof.resultHash,
    tamperedResultHash,
    originalTraceHash: session.proof.traceHash,
    tamperedTraceHash,
    match: false,
    tampered: true,
    reason: "The locally modified output recomputes to a different trace hash than the sealed proof hash.",
  };
}

export async function hydrateSessionStore() {
  try {
    await readStore();
    return { ok: true, warning: getServerlessSessionStoreWarning() };
  } catch (error) {
    return { ok: false, warning: formatSessionStoreWarning(error) };
  }
}

export async function getStorageReferenceByBlobId(blobId: string) {
  try {
    const sessions = await readStore();
    return sessions.find((session) => session.storage.blobId === blobId)?.storage;
  } catch {
    return undefined;
  }
}

export async function getStorageReferenceByUploadJobId(uploadJobId: string) {
  try {
    const sessions = await readStore();
    return sessions.find((session) => session.storage.uploadJobId === uploadJobId)?.storage;
  } catch {
    return undefined;
  }
}
