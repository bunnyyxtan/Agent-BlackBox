import "server-only";

import { getSessionEvidenceStatus } from "@/lib/constants";
import { getSupabaseAdminClient, getSupabaseStorageStatus } from "@/lib/supabase/server";
import { getSuiProofRegistryConfig } from "@/lib/sui-proof";
import { normalizeSuiAddressForCompare } from "@/lib/sui-client-helpers";
import type { AgentSession } from "@/types/blackbox";

const TABLE_NAME = "agent_sessions";
const SUPABASE_QUERY_TIMEOUT_MS = 8_000;

interface AgentSessionRow {
  id: string;
  session_json: unknown;
  is_demo?: boolean | null;
}

export interface SupabaseSessionStoreCheck {
  configured: boolean;
  tableReachable: boolean;
  checkedAt: string;
  error: string | null;
  count: number | null;
}

function sanitizeSupabaseMessage(message: string) {
  return message
    .replace(/(service_role|apikey|authorization|bearer)\s*[:=]\s*["']?[^"',\s]+/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function normalizeError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return sanitizeSupabaseMessage(String((error as { message?: unknown }).message ?? "Supabase request failed."));
  }
  if (error instanceof Error) return sanitizeSupabaseMessage(error.message);
  return "Supabase session storage request failed.";
}

async function withSupabaseTimeout<T>(operation: PromiseLike<T>, label: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${label} timed out.`));
        }, SUPABASE_QUERY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function readSessionJson(row: AgentSessionRow): AgentSession | null {
  const value = row.session_json;
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as AgentSession;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as AgentSession;
  }
  return null;
}

function statusFromBoolean(value: boolean | null | undefined, positive: string, negative = "pending") {
  if (value === true) return positive;
  if (value === false) return "failed";
  return negative;
}

function normalizeOwnerWallet(value?: string | null) {
  const normalized = normalizeSuiAddressForCompare(value);
  return normalized || null;
}

export function toSupabaseSessionRow(session: AgentSession) {
  const proofRegistry = getSuiProofRegistryConfig();
  const report = session.trace.structuredOutput;
  return {
    id: session.id,
    owner_wallet: normalizeOwnerWallet(session.ownerAddress),
    agent_mode: session.agentMode,
    title: session.title,
    prompt: session.prompt,
    status: session.status,
    network: session.proof.network ?? "sui-mainnet",
    storage_mode: session.storageMode,
    evidence_status: getSessionEvidenceStatus(session),
    report_type: report?.agentDisplayName ?? session.agentMode,
    confidence: report?.confidence ?? null,
    input_hash: session.trace.inputHash,
    result_hash: session.trace.resultHash,
    trace_hash: session.trace.traceHash,
    walrus_blob_id: session.storage.blobId || null,
    walrus_object_id: session.storage.blobObjectId || null,
    walrus_upload_job_id: session.storage.uploadJobId || null,
    walrus_network: session.storage.storageNetwork ?? session.proof.storageNetwork ?? "walrus-mainnet",
    walrus_status: session.storage.storageStatus,
    replay_status: session.verification.directWalrusReadPassed
      ? "passed"
      : session.walrusVerification.readStatus ?? "pending",
    hash_match_status: statusFromBoolean(session.verification.hashMatched, "matched"),
    sui_proof_object_id: session.proof.suiObjectId?.includes("pending") ? null : session.proof.suiObjectId,
    sui_transaction_digest: session.proof.transactionDigest?.includes("pending") ? null : session.proof.transactionDigest,
    sui_anchor_status: session.proof.status,
    sui_package_id: session.proof.packageId || proofRegistry.packageId || null,
    proof_status: session.proof.status,
    is_demo: Boolean(session.isSample),
    session_json: session,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

export function fromSupabaseSessionRow(row: AgentSessionRow): AgentSession | null {
  const session = readSessionJson(row);
  if (!session) return null;
  return {
    ...session,
    isSample: session.isSample ?? Boolean(row.is_demo),
  };
}

export async function listSupabaseSessions() {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  const { data, error } = await withSupabaseTimeout(
    client
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false }),
    "Supabase session list",
  );

  if (error) throw new Error(normalizeError(error));
  return ((data ?? []) as AgentSessionRow[])
    .map(fromSupabaseSessionRow)
    .filter((session): session is AgentSession => Boolean(session));
}

export async function listSupabaseSessionsForWallet(ownerWallet: string) {
  const client = getSupabaseAdminClient();
  const normalizedOwner = normalizeOwnerWallet(ownerWallet);
  if (!client || !normalizedOwner) return [];

  const { data, error } = await withSupabaseTimeout(
    client
      .from(TABLE_NAME)
      .select("*")
      .eq("owner_wallet", normalizedOwner)
      .eq("is_demo", false)
      .order("created_at", { ascending: false }),
    "Supabase wallet-scoped session list",
  );

  if (error) throw new Error(normalizeError(error));
  return ((data ?? []) as AgentSessionRow[])
    .map(fromSupabaseSessionRow)
    .filter((session): session is AgentSession => Boolean(session));
}

export async function getSupabaseSessionById(id: string) {
  const client = getSupabaseAdminClient();
  if (!client) return undefined;

  const { data, error } = await withSupabaseTimeout(
    client
      .from(TABLE_NAME)
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    "Supabase session lookup",
  );

  if (error) throw new Error(normalizeError(error));
  return data ? fromSupabaseSessionRow(data as AgentSessionRow) ?? undefined : undefined;
}

export async function getSupabaseSessionByIdForWallet(id: string, ownerWallet: string) {
  const client = getSupabaseAdminClient();
  const normalizedOwner = normalizeOwnerWallet(ownerWallet);
  if (!client || !normalizedOwner) return undefined;

  const { data, error } = await withSupabaseTimeout(
    client
      .from(TABLE_NAME)
      .select("*")
      .eq("id", id)
      .eq("owner_wallet", normalizedOwner)
      .eq("is_demo", false)
      .maybeSingle(),
    "Supabase wallet-scoped session lookup",
  );

  if (error) throw new Error(normalizeError(error));
  return data ? fromSupabaseSessionRow(data as AgentSessionRow) ?? undefined : undefined;
}

export async function upsertSupabaseSession(session: AgentSession) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase session storage is not configured.");

  const { error } = await withSupabaseTimeout(
    client
      .from(TABLE_NAME)
      .upsert(toSupabaseSessionRow(session), { onConflict: "id" }),
    "Supabase session upsert",
  );

  if (error) throw new Error(normalizeError(error));
  return session;
}

export async function updateSupabaseSession(id: string, patch: Partial<AgentSession>) {
  const existing = await getSupabaseSessionById(id);
  if (!existing) return undefined;
  const updated = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  } satisfies AgentSession;
  return upsertSupabaseSession(updated);
}

export async function deleteSupabaseSession(id: string) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Supabase session storage is not configured.");
  const { error } = await withSupabaseTimeout(
    client.from(TABLE_NAME).delete().eq("id", id),
    "Supabase session delete",
  );
  if (error) throw new Error(normalizeError(error));
}

export async function getSupabaseDashboardStats() {
  const sessions = await listSupabaseSessions();
  return {
    total: sessions.length,
    walrusStored: sessions.filter(
      (session) => session.storage.storageProvider !== "local" && session.verification.directWalrusReadPassed,
    ).length,
    suiAnchored: sessions.filter(
      (session) => session.proof.status === "anchored" || session.proof.status === "verified",
    ).length,
    fullyVerified: sessions.filter(
      (session) => session.verification.directWalrusReadPassed && session.verification.tatumRpcPassed,
    ).length,
  };
}

export async function checkSupabaseSessionStore(): Promise<SupabaseSessionStoreCheck> {
  const status = getSupabaseStorageStatus();
  const checkedAt = new Date().toISOString();
  const client = getSupabaseAdminClient();
  if (!status.configured || !client) {
    return {
      configured: status.configured,
      tableReachable: false,
      checkedAt,
      error: status.urlPresent
        ? "Supabase service role key is not configured."
        : "Supabase URL is not configured.",
      count: null,
    };
  }

  try {
    const { count, error } = await withSupabaseTimeout(
      client
        .from(TABLE_NAME)
        .select("id", { count: "exact", head: true }),
      "Supabase session storage check",
    );
    if (error) {
      return {
        configured: true,
        tableReachable: false,
        checkedAt,
        error: normalizeError(error),
        count: null,
      };
    }
    return {
      configured: true,
      tableReachable: true,
      checkedAt,
      error: null,
      count: count ?? null,
    };
  } catch (error) {
    return {
      configured: true,
      tableReachable: false,
      checkedAt,
      error: normalizeError(error),
      count: null,
    };
  }
}
