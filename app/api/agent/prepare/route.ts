import { NextResponse } from "next/server";

import { AgentRuntimeExecutionError, AgentRuntimeSetupError } from "@/lib/agents/agent-runtime";
import { prepareSessionDraft, SessionValidationError } from "@/lib/session-service";
import { getUploadRelayTipConfig } from "@/lib/storage-adapters/walrus-sdk-relay";
import { getWalrusConfiguration } from "@/lib/walrus";
import type { CreateAgentSessionRequest, PlaceholderApiResponse } from "@/types/blackbox";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as CreateAgentSessionRequest;
    const prepared = await prepareSessionDraft(input);
    const walrus = getWalrusConfiguration();
    const relayStatus = await getUploadRelayTipConfig();
    const result = {
      ...prepared,
      storageConfig: {
        provider: "walrus_sdk_relay",
        network: walrus.network,
        relayUrl: walrus.relayUrl,
        aggregatorUrl: walrus.aggregatorUrl,
        storageEpochs: prepared.session.storageEpochs,
        storageMode: prepared.session.storageMode,
        relayStatus,
      },
    };
    const response: PlaceholderApiResponse<typeof result> = {
      ok: true,
      phase: "phase-2e",
      message: "Trace prepared for wallet-paid Walrus Mainnet SDK Relay upload.",
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
    const message = error instanceof Error ? error.message : "Agent session could not be prepared.";
    return NextResponse.json(
      {
        ok: false,
        code: "agent_prepare_failed",
        message: "Agent session could not be prepared.",
        details: message,
      },
      { status: 500 },
    );
  }
}
