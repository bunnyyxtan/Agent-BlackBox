import type { AgentSession } from "@/types/blackbox";

export type VerificationPresentationState =
  | "verified"
  | "pending"
  | "unavailable"
  | "tampered";

function hasText(value?: string | null) {
  return Boolean(value?.trim());
}

export function hasConfirmedHashMismatch(session: AgentSession) {
  const expectedTraceHash =
    session.walrusVerification.expectedTraceHash ||
    session.proof.traceHash ||
    session.trace.traceHash;
  const actualTraceHash = session.walrusVerification.actualTraceHash;

  return (
    session.walrusVerification.readStatus === "available" &&
    hasText(expectedTraceHash) &&
    hasText(actualTraceHash) &&
    actualTraceHash !== expectedTraceHash
  );
}

function hasRealTamperFlag(session: AgentSession) {
  return session.verification.tamperDetected && session.verification.hashMatched === false;
}

function hasRequiredHashData(session: AgentSession) {
  return (
    hasText(session.trace.traceHash) &&
    hasText(session.trace.resultHash) &&
    hasText(session.trace.inputHash) &&
    hasText(session.proof.traceHash) &&
    hasText(session.proof.resultHash)
  );
}

function isVerificationUnavailable(session: AgentSession) {
  if (!hasRequiredHashData(session)) return true;
  if (session.storage.storageStatus === "failed") return true;
  return ["unavailable", "not_configured", "invalid_json"].includes(
    session.walrusVerification.readStatus,
  );
}

export function getVerificationPresentation(
  session: AgentSession,
) {
  const verified =
    session.verification.directWalrusReadPassed &&
    session.verification.hashMatched;
  const tampered = hasConfirmedHashMismatch(session) || hasRealTamperFlag(session);

  if (tampered) {
    return {
      state: "tampered" as const,
      title: "Trace Mismatch Detected",
      status: "Trace Mismatch",
      description:
        "Canonical replay/hash comparison confirmed that the stored payload does not match the sealed proof hash.",
    };
  }

  if (verified) {
    return {
      state: "verified" as const,
      title: "Verified Trace",
      status: "Verified Trace",
      description:
        "Replay payload hash matches the sealed proof hash, and Sui proof details are shown below.",
    };
  }

  if (isVerificationUnavailable(session)) {
    return {
      state: "unavailable" as const,
      title: "Verification Unavailable",
      status: "Verification Unavailable",
      description:
        "Required proof or readback data is missing, so verification cannot be performed in this view.",
    };
  }

  return {
    state: "pending" as const,
    title: "Verification Pending",
    status: "Verification Pending",
    description:
      "Walrus or Sui proof evidence is still being prepared or has not been rechecked yet.",
  };
}
