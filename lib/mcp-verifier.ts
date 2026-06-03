import type { AgentSession } from "@/types/blackbox";

export function createMcpVerificationPrompt(session: AgentSession) {
  return [
    "Inspect this Agent BlackBox proof bundle.",
    `Session: ${session.id}`,
    `Trace hash: ${session.trace.traceHash}`,
    `Walrus upload job: ${session.storage.uploadJobId}`,
    `Walrus blob: ${session.storage.blobId}`,
    `Sui proof object: ${session.proof.suiObjectId}`,
    "Explain any discrepancy across storage, blob availability, proof ownership, and trace integrity.",
  ].join("\n");
}

export async function reviewProofBundleForMcp(session: AgentSession) {
  const checks = [
    {
      label: "Walrus blob availability",
      passed: session.verification.walrusBlobAvailable,
      detail: session.storage.blobId || "No Walrus blob ID recorded.",
    },
    {
      label: "Direct Walrus read",
      passed: session.verification.directWalrusReadPassed,
      detail: session.walrusVerification.error || session.walrusVerification.directReadUrl || "Aggregator read not completed.",
    },
    {
      label: "Trace hash match",
      passed: session.verification.hashMatched,
      detail: session.trace.traceHash,
    },
    {
      label: "Sui proof anchor",
      passed: session.verification.suiProofFound,
      detail: session.proof.suiObjectId || session.proof.transactionDigest || "No confirmed proof object recorded.",
    },
    {
      label: "Tatum Sui RPC proof read",
      passed: session.verification.tatumRpcPassed,
      detail: session.tatumRpc.message,
    },
  ];
  const failedChecks = checks.filter((check) => !check.passed);
  const status = failedChecks.length === 0 ? "verified" : session.status === "tampered" ? "tampered" : "attention_needed";

  return {
    inspected: true,
    provider: "Deterministic Proof Bundle Review",
    status,
    summary:
      failedChecks.length === 0
        ? "Walrus storage, hash integrity, Sui anchor, and Tatum Sui RPC checks are aligned."
        : "One or more proof-bundle checks needs attention before this session can be treated as fully verified.",
    checks,
    nextActions: failedChecks.map((check) => `Review ${check.label}.`),
    mcpPrompt: createMcpVerificationPrompt(session),
  };
}
