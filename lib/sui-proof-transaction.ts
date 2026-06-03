"use client";

import { Transaction } from "@mysten/sui/transactions";

import { getSuiProofRegistryConfig, normalizeProofMetadata } from "@/lib/sui-proof";
import type { AgentSession } from "@/types/blackbox";

export function buildCreateSessionProofTransaction(session: AgentSession) {
  const config = getSuiProofRegistryConfig();
  if (!config.configured) {
    throw new Error("Proof contract not configured.");
  }

  const metadata = normalizeProofMetadata(session);
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${config.packageId}::${config.moduleName}::${config.createFunction}`,
    arguments: [
      transaction.pure.string(metadata.sessionId),
      transaction.pure.string(metadata.agentMode),
      transaction.pure.string(metadata.inputHash),
      transaction.pure.string(metadata.resultHash),
      transaction.pure.string(metadata.traceHash),
      transaction.pure.string(metadata.walrusBlobId),
      transaction.pure.string(metadata.walrusObjectId),
      transaction.pure.string(metadata.uploadJobId),
      transaction.pure.string(metadata.uploadAdapter),
      transaction.pure.string(metadata.storageProvider),
      transaction.pure.string(metadata.storageNetwork),
      transaction.pure.u64(metadata.createdAtMs),
      transaction.pure.string(metadata.status),
    ],
  });
  return transaction;
}
