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

// Phase 2: route this prompt to Tatum MCP for AI-assisted evidence inspection.
export async function verifyWithMcpPlaceholder(session: AgentSession) {
  return { enabled: false, inspected: false, prompt: createMcpVerificationPrompt(session) };
}
