import type { ProofMode, ProofStatus, TatumRpcVerificationStatus } from "@/types/blackbox";

export function formatTatumRpcStatus(status: TatumRpcVerificationStatus) {
  const labels: Record<TatumRpcVerificationStatus, string> = {
    local_phase1: "Local Check",
    not_configured: "Not Configured",
    pending: "Pending",
    transaction_found: "Transaction Found",
    passed: "Passed",
    failed: "Failed",
  };
  return labels[status];
}

export function formatProofMode(mode: ProofMode) {
  return mode === "onchain" ? "Onchain" : "Local Check";
}

export function formatProofStatus(status: ProofStatus) {
  const labels: Record<ProofStatus, string> = {
    prepared: "Not Anchored",
    anchored_pending_object: "Proof Pending",
    anchored: "Anchored",
    verified: "Verified",
    failed: "Failed",
  };
  return labels[status];
}
