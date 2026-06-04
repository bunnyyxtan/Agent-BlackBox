#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const TABLE_NAME = "agent_sessions";
const DEFAULT_SESSIONS_PATH = path.join(process.cwd(), ".data", "sessions.json");
const DRY_RUN = process.argv.includes("--dry-run");
const FILE_ARG = process.argv.find((arg) => arg.startsWith("--file="));
const SESSIONS_PATH = FILE_ARG ? path.resolve(FILE_ARG.slice("--file=".length)) : DEFAULT_SESSIONS_PATH;

const SUSPICIOUS_PATTERNS = [
  { label: "sk-", pattern: /sk-/i },
  { label: "private_key", pattern: /private_key/i },
  { label: "service_role", pattern: /service_role/i },
  { label: "SUPABASE", pattern: /SUPABASE/i },
  { label: "OPENAI", pattern: /OPENAI/i },
  { label: "TATUM_API_KEY", pattern: /TATUM_API_KEY/i },
  { label: "api_key", pattern: /api_key/i },
  { label: "secret", pattern: /secret/i },
];

function readPath(session, paths, fallback = null) {
  for (const keyPath of paths) {
    const value = keyPath.split(".").reduce((current, key) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return current[key];
    }, session);

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
}

function normalizeTimestamp(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getSessionEvidenceStatus(session) {
  if (session.isSample || session.isDemo) {
    return "Sample Trace";
  }

  const proofStatus = readPath(session, ["proof.status", "suiAnchorStatus", "sui_anchor_status"]);
  const storageProvider = readPath(session, ["storage.storageProvider", "storageProvider"]);
  const directWalrusPassed = Boolean(readPath(session, ["verification.directWalrusReadPassed"]));
  const verificationHashMatched = readPath(session, ["verification.hashMatched"]);
  const storageHashMatched = readPath(session, ["storage.hashMatched", "hashMatched"]);

  if (directWalrusPassed && verificationHashMatched === true && proofStatus === "verified") {
    return "Fully Verified";
  }

  if (proofStatus === "anchored_pending_object") {
    return "Pending Sui Anchor";
  }

  if (proofStatus === "anchored" || proofStatus === "verified") {
    return "Sui Anchored";
  }

  if (storageProvider && storageProvider !== "local" && directWalrusPassed && storageHashMatched === true) {
    return "Walrus Verified";
  }

  if (storageProvider === "local") {
    return "Local Trace";
  }

  return "Prepared";
}

function getHashMatchStatus(session) {
  const verificationHashMatched = readPath(session, ["verification.hashMatched"]);
  const storageHashMatched = readPath(session, ["storage.hashMatched", "hashMatched"]);
  const hashMatched = verificationHashMatched ?? storageHashMatched;

  if (hashMatched === true) {
    return "matched";
  }

  if (hashMatched === false) {
    return "failed";
  }

  return readPath(session, ["hashMatchStatus", "hash_match_status"], "pending");
}

function getReplayStatus(session) {
  if (readPath(session, ["verification.directWalrusReadPassed"]) === true) {
    return "passed";
  }

  return readPath(session, ["walrusVerification.readStatus", "replayStatus", "replay_status"], "pending");
}

function toSupabaseSessionRow(session) {
  const proofStatus = readPath(session, ["proof.status", "suiAnchorStatus", "sui_anchor_status"]);
  const pendingProofObject = proofStatus === "anchored_pending_object";
  const createdAt = normalizeTimestamp(readPath(session, ["createdAt", "created_at"])) ?? new Date().toISOString();
  const updatedAt = normalizeTimestamp(readPath(session, ["updatedAt", "updated_at"])) ?? createdAt;

  return {
    id: String(session.id),
    owner_wallet: readPath(session, ["ownerAddress", "ownerWallet", "owner_wallet", "proof.owner"], null),
    agent_mode: readPath(session, ["agentMode", "agent_mode", "mode"], null),
    title: readPath(session, ["title"], null),
    prompt: readPath(session, ["prompt", "task.prompt", "originalPrompt"], null),
    status: readPath(session, ["status"], null),
    network: readPath(session, ["proof.network", "network"], "sui-mainnet"),
    storage_mode: readPath(session, ["storageMode", "storage_mode", "storage.storageMode"], null),
    evidence_status: readPath(session, ["evidenceStatus", "evidence_status"], getSessionEvidenceStatus(session)),
    report_type: readPath(
      session,
      ["trace.structuredOutput.agentDisplayName", "trace.structuredOutput.reportType", "reportType", "report_type"],
      readPath(session, ["agentMode", "agent_mode", "mode"], null),
    ),
    confidence: readPath(session, ["trace.structuredOutput.confidence", "confidence"], null),
    input_hash: readPath(session, ["trace.inputHash", "inputHash", "input_hash"], null),
    result_hash: readPath(session, ["trace.resultHash", "resultHash", "result_hash"], null),
    trace_hash: readPath(session, ["trace.traceHash", "traceHash", "trace_hash"], null),
    walrus_blob_id: readPath(session, ["storage.blobId", "walrusBlobId", "walrus_blob_id"], null),
    walrus_object_id: readPath(session, ["storage.blobObjectId", "storage.objectId", "walrusObjectId", "walrus_object_id"], null),
    walrus_upload_job_id: readPath(session, ["storage.uploadJobId", "walrusUploadJobId", "walrus_upload_job_id"], null),
    walrus_network: readPath(
      session,
      ["storage.storageNetwork", "proof.storageNetwork", "walrusNetwork", "walrus_network"],
      "walrus-mainnet",
    ),
    walrus_status: readPath(session, ["storage.storageStatus", "walrusStatus", "walrus_status"], null),
    replay_status: getReplayStatus(session),
    hash_match_status: getHashMatchStatus(session),
    sui_proof_object_id: pendingProofObject
      ? null
      : readPath(session, ["proof.suiObjectId", "suiProofObjectId", "sui_proof_object_id"], null),
    sui_transaction_digest: pendingProofObject
      ? null
      : readPath(session, ["proof.transactionDigest", "suiTransactionDigest", "sui_transaction_digest"], null),
    sui_anchor_status: proofStatus ?? null,
    sui_package_id: readPath(
      session,
      ["proof.packageId", "suiPackageId", "sui_package_id"],
      process.env.SUI_PROOF_PACKAGE_ID ?? process.env.NEXT_PUBLIC_SUI_PROOF_PACKAGE_ID ?? null,
    ),
    proof_status: proofStatus ?? null,
    is_demo: Boolean(readPath(session, ["isSample", "isDemo", "is_demo"], false)),
    session_json: session,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function parseSessions(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.sessions)) {
    return payload.sessions;
  }

  throw new Error("Expected .data/sessions.json to be an array or an object with a sessions array.");
}

function findSuspiciousPatterns(rawJson) {
  return SUSPICIOUS_PATTERNS.filter(({ pattern }) => pattern.test(rawJson)).map(({ label }) => label);
}

function sanitizeErrorMessage(message) {
  return String(message ?? "Unknown error")
    .replace(/(service_role|apikey|api_key|authorization|bearer|password|secret)\s*[:=]\s*["']?[^"',\s]+/gi, "$1=[redacted]")
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[redacted-jwt]")
    .slice(0, 600);
}

function previewRow(row) {
  return {
    ...row,
    session_json: "[full original session stored in real import]",
  };
}

function printSummary({ imported, skipped, failed }) {
  console.log("");
  console.log("Import summary");
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
}

async function main() {
  console.log(`Reading local sessions from ${SESSIONS_PATH}`);

  const rawJson = await readFile(SESSIONS_PATH, "utf8");
  const suspiciousMatches = findSuspiciousPatterns(rawJson);

  if (suspiciousMatches.length > 0) {
    console.error("Import stopped. The local sessions file contains suspicious secret-looking strings:");
    for (const match of suspiciousMatches) {
      console.error(`- ${match}`);
    }
    console.error("Review and sanitize .data/sessions.json before importing it into Supabase.");
    process.exitCode = 1;
    return;
  }

  const parsed = JSON.parse(rawJson);
  const sessions = parseSessions(parsed);
  const rows = [];
  let skipped = 0;

  for (const session of sessions) {
    if (!session || typeof session !== "object" || !session.id) {
      skipped += 1;
      console.warn("Skipping a session without an id.");
      continue;
    }

    rows.push(toSupabaseSessionRow(session));
  }

  if (DRY_RUN) {
    console.log(`Dry run only. ${rows.length} session row(s) would be upserted into ${TABLE_NAME}.`);
    console.log("Sample mapped rows:");
    console.log(JSON.stringify(rows.slice(0, 3).map(previewRow), null, 2));
    printSummary({ imported: 0, skipped, failed: 0 });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for import mode.");
    console.error("Run with --dry-run to validate local sessions without writing to Supabase.");
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let imported = 0;
  let failed = 0;

  for (const row of rows) {
    const { error } = await supabase.from(TABLE_NAME).upsert(row, { onConflict: "id" });

    if (error) {
      failed += 1;
      console.error(`Failed to import ${row.id}: ${sanitizeErrorMessage(error.message)}`);
      continue;
    }

    imported += 1;
  }

  printSummary({ imported, skipped, failed });

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Import failed: ${sanitizeErrorMessage(error?.message ?? error)}`);
  process.exitCode = 1;
});
