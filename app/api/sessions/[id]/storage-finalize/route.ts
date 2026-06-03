import { NextResponse } from "next/server";

import { apiErrorPayload, BODY_SIZE_LIMITS, readJsonRequest, SafeRequestError, safeRequestErrorPayload } from "@/lib/http/safe-request";
import { guardApiRequest } from "@/lib/security/api-guard";
import { finalizeSessionStorage, type FinalizeStorageInput, SessionValidationError } from "@/lib/session-service";
import type { AgentSession, ApiSuccessResponse } from "@/types/blackbox";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApiRequest(request, { profile: "strict" });
  if (guard) return guard;

  const { id } = await params;
  try {
    const body = await readJsonRequest<FinalizeStorageInput>(request, {
      maxBytes: BODY_SIZE_LIMITS.storageJson,
    });
    const session = await finalizeSessionStorage(id, body);
    if (!session) {
      return NextResponse.json(apiErrorPayload("SESSION_NOT_FOUND", "Session not found."), { status: 404 });
    }
    const response: ApiSuccessResponse<{ session: AgentSession }> = {
      ok: true,
      message: "Walrus Mainnet SDK Relay upload finalized, read back, hash-verified, and persisted.",
      data: { session },
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof SafeRequestError) {
      return NextResponse.json(safeRequestErrorPayload(error), { status: error.statusCode });
    }
    if (error instanceof SessionValidationError) {
      return NextResponse.json(apiErrorPayload("SESSION_VALIDATION_FAILED", error.message), { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Walrus storage could not be finalized.";
    return NextResponse.json(
      apiErrorPayload("storage_finalize_failed", "Walrus storage could not be finalized.", message),
      { status: 500 },
    );
  }
}
