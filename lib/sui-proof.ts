import { buildSuiExplorerUrl } from "@/lib/sui-explorer";
import { isValidSuiObjectId, isValidTransactionDigest } from "@/lib/sui-client-helpers";
import type { AgentSession, ProofMetadata } from "@/types/blackbox";

const DEFAULT_MODULE_NAME = "agent_blackbox";
const DEFAULT_CREATE_FUNCTION = "create_session_proof";

export interface NormalizedProofMetadata {
  sessionId: string;
  agentMode: string;
  inputHash: string;
  resultHash: string;
  traceHash: string;
  walrusBlobId: string;
  walrusObjectId: string;
  uploadJobId: string;
  uploadAdapter: string;
  storageProvider: string;
  storageNetwork: string;
  createdAtMs: number;
  status: string;
}

export function getSuiProofRegistryConfig() {
  const packageId =
    process.env.NEXT_PUBLIC_SUI_PROOF_PACKAGE_ID?.trim() ||
    process.env.SUI_PROOF_PACKAGE_ID?.trim() ||
    process.env.NEXT_PUBLIC_AGENT_BLACKBOX_PACKAGE_ID?.trim() ||
    "";
  const moduleName =
    process.env.NEXT_PUBLIC_SUI_PROOF_MODULE?.trim() ||
    process.env.SUI_PROOF_MODULE?.trim() ||
    process.env.NEXT_PUBLIC_AGENT_BLACKBOX_MODULE?.trim() ||
    DEFAULT_MODULE_NAME;
  const createFunction =
    process.env.NEXT_PUBLIC_SUI_PROOF_CREATE_FUNCTION?.trim() ||
    process.env.SUI_PROOF_CREATE_FUNCTION?.trim() ||
    process.env.NEXT_PUBLIC_AGENT_BLACKBOX_CREATE_FUNCTION?.trim() ||
    DEFAULT_CREATE_FUNCTION;
  const configured = isValidSuiObjectId(packageId);
  return {
    configured,
    packageId,
    moduleName,
    createFunction,
    eventType: configured
      ? `${packageId}::${moduleName}::AgentSessionProofCreated`
      : undefined,
  };
}

export function normalizeProofMetadata(session: AgentSession): NormalizedProofMetadata {
  const createdAtMs = new Date(session.createdAt).getTime();
  if (!Number.isSafeInteger(createdAtMs) || createdAtMs < 0) {
    throw new Error("Session creation time is invalid.");
  }
  if (!session.trace.traceHash || !session.trace.resultHash || !session.trace.inputHash) {
    throw new Error("Session hashes must be sealed before proof anchoring.");
  }
  if (!session.storage.blobId || session.storage.storageProvider === "local") {
    throw new Error("A Walrus storage reference is required before proof anchoring.");
  }

  return {
    sessionId: session.id,
    agentMode: session.agentMode,
    inputHash: session.trace.inputHash,
    resultHash: session.trace.resultHash,
    traceHash: session.trace.traceHash,
    walrusBlobId: session.storage.blobId,
    walrusObjectId: session.storage.blobObjectId || "",
    uploadJobId: session.storage.uploadJobId || "",
    uploadAdapter: session.storage.uploadAdapter,
    storageProvider: session.storage.storageProvider,
    storageNetwork: session.storage.storageNetwork ?? "walrus-mainnet",
    createdAtMs,
    status: "anchored",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCreatedObjectIdFromEffects(effects: unknown) {
  if (!isRecord(effects) || !Array.isArray(effects.changedObjects)) return undefined;
  for (const changedObject of effects.changedObjects) {
    if (
      isRecord(changedObject) &&
      changedObject.idOperation === "Created" &&
      changedObject.outputState === "ObjectWrite" &&
      typeof changedObject.objectId === "string" &&
      isValidSuiObjectId(changedObject.objectId)
    ) {
      return changedObject.objectId;
    }
  }
  return undefined;
}

function readCreatedObjectIdFromObjectChanges(objectChanges: unknown) {
  if (!Array.isArray(objectChanges)) return undefined;
  for (const objectChange of objectChanges) {
    if (
      isRecord(objectChange) &&
      objectChange.type === "created" &&
      typeof objectChange.objectId === "string" &&
      isValidSuiObjectId(objectChange.objectId)
    ) {
      return objectChange.objectId;
    }
  }
  return undefined;
}

export function extractProofObjectIdFromTransactionResult(result: unknown) {
  if (!isRecord(result)) return undefined;
  const transaction = isRecord(result.Transaction) ? result.Transaction : result;
  return (
    readCreatedObjectIdFromEffects(transaction.effects) ??
    readCreatedObjectIdFromObjectChanges(transaction.objectChanges) ??
    readCreatedObjectIdFromObjectChanges(result.objectChanges)
  );
}

export function isAnchoredProof(proof: ProofMetadata) {
  return (
    isValidTransactionDigest(proof.transactionDigest) &&
    (proof.status === "anchored" || proof.status === "verified")
  );
}

export function getProofExplorerUrl(proof: ProofMetadata) {
  if (!isValidTransactionDigest(proof.transactionDigest)) return undefined;
  return buildSuiExplorerUrl("transaction", proof.transactionDigest, proof.network);
}
