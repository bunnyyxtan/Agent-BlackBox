import { NextResponse } from "next/server";

import { AgentRuntimeExecutionError, AgentRuntimeSetupError } from "@/lib/agents/agent-runtime";
import { createSession, SessionValidationError } from "@/lib/session-service";
import { WalrusHttpError } from "@/lib/walrus";
import type { CreateAgentSessionRequest, PlaceholderApiResponse } from "@/types/blackbox";

function formatUploadAdapterLabel(adapter: string) {
  if (adapter === "walrus_mainnet_upload_relay") return "Walrus Mainnet Upload Relay";
  if (adapter === "walrus_http_publisher") return "Walrus HTTP Publisher";
  if (adapter === "tatum_walrus") return "Tatum Walrus Adapter";
  if (adapter === "local") return "Local Trace Store";
  return "configured storage adapter";
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CreateAgentSessionRequest;
    const session = await createSession(input);
    const result = {
      sessionId: session.id,
      session,
      output: session.trace.finalOutput,
      hashes: {
        inputHash: session.trace.inputHash,
        resultHash: session.trace.resultHash,
        traceHash: session.trace.traceHash,
      },
      timeline: session.trace.timeline,
      storage: session.storage,
      suiProof: session.proof,
      status: session.status,
    };
    const response: PlaceholderApiResponse<typeof result> = {
      ok: true,
      phase: "phase-2a",
      message: session.storage.warning
        ? `Trace created with storage warning: ${session.storage.warning}`
        : `Trace created, stored through ${formatUploadAdapterLabel(session.storage.uploadAdapter)}, persisted, and hash-verified.`,
      data: result,
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof SessionValidationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    if (error instanceof AgentRuntimeSetupError || error instanceof AgentRuntimeExecutionError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.statusCode },
      );
    }
    if (error instanceof WalrusHttpError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.statusCode });
    }
    throw error;
  }
}
