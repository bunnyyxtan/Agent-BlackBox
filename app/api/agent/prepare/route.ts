import { NextResponse } from "next/server";

import { AgentRuntimeExecutionError, AgentRuntimeSetupError } from "@/lib/agents/agent-runtime";
import { apiErrorPayload, BODY_SIZE_LIMITS, readJsonRequest, SafeRequestError, safeRequestErrorPayload } from "@/lib/http/safe-request";
import { guardApiRequest } from "@/lib/security/api-guard";
import { prepareSessionDraft, SessionValidationError } from "@/lib/session-service";
import { getUploadRelayTipConfig } from "@/lib/storage-adapters/walrus-sdk-relay";
import { getWalrusConfiguration } from "@/lib/walrus";
import type { ApiSuccessResponse, CreateAgentSessionRequest } from "@/types/blackbox";

export async function POST(request: Request) {
  const guard = await guardApiRequest(request, { profile: "strict" });
  if (guard) return guard;

  try {
    const input = await readJsonRequest<CreateAgentSessionRequest>(request, {
      maxBytes: BODY_SIZE_LIMITS.agentJson,
    });
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
    const response: ApiSuccessResponse<typeof result> = {
      ok: true,
      message: "Trace prepared for wallet-paid Walrus Mainnet SDK Relay upload.",
      data: result,
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof SafeRequestError) {
      return NextResponse.json(safeRequestErrorPayload(error), { status: error.statusCode });
    }
    if (error instanceof SessionValidationError) {
      return NextResponse.json(apiErrorPayload("SESSION_VALIDATION_FAILED", error.message), { status: 400 });
    }
    if (error instanceof AgentRuntimeSetupError || error instanceof AgentRuntimeExecutionError) {
      return NextResponse.json(
        apiErrorPayload(error.code, error.message),
        { status: error.statusCode },
      );
    }
    const message = error instanceof Error ? error.message : "Agent session could not be prepared.";
    return NextResponse.json(
      apiErrorPayload("agent_prepare_failed", "Agent session could not be prepared.", message),
      { status: 500 },
    );
  }
}
