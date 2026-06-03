import { stableStringify } from "@/lib/hash";
import type { TraceBundle } from "@/lib/storage-adapters/types";
import type { AgentSession } from "@/types/blackbox";

export const TRACE_BUNDLE_VERSION = "agent-blackbox-trace-v1";
export const WALRUS_MAINNET_STORAGE_NETWORK = "walrus-mainnet";

export function createTraceBundleFromSession(
  session: AgentSession,
  storageNetwork = WALRUS_MAINNET_STORAGE_NETWORK,
): TraceBundle {
  return {
    version: TRACE_BUNDLE_VERSION,
    sessionId: session.id,
    agentMode: session.agentMode,
    taskTitle: session.title,
    taskPrompt: session.prompt,
    inputFiles: session.inputFiles,
    agentOutput: session.trace.structuredOutput ?? session.trace.finalOutput,
    timeline: session.trace.timeline,
    inputHash: session.trace.inputHash,
    resultHash: session.trace.resultHash,
    traceHash: session.trace.traceHash,
    storageNetwork,
    createdAt: session.createdAt,
    ownerWalletAddress: session.ownerAddress,
    trace: session.trace,
  };
}

export function serializeTraceBundle(traceBundle: TraceBundle) {
  return stableStringify(traceBundle);
}

export function encodeTraceBundle(traceBundle: TraceBundle) {
  return new TextEncoder().encode(serializeTraceBundle(traceBundle));
}
