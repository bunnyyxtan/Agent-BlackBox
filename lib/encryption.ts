import type { AgentTrace } from "@/types/blackbox";

// Production traces should be encrypted before upload because Walrus blobs are public by default.
export async function encryptTracePlaceholder(trace: AgentTrace) {
  return { encrypted: false, payload: trace };
}

// Phase 2: decrypt locally after blob retrieval and before replay.
export async function decryptTracePlaceholder(payload: unknown) {
  return { decrypted: false, payload };
}
