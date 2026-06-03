import { NextResponse } from "next/server";

import { apiErrorPayload, BODY_SIZE_LIMITS, readJsonRequest, SafeRequestError, safeRequestErrorPayload } from "@/lib/http/safe-request";
import { reviewProofBundleForMcp } from "@/lib/mcp-verifier";
import { guardApiRequest } from "@/lib/security/api-guard";
import { getSessionById } from "@/lib/session-service";
import type { ApiSuccessResponse } from "@/types/blackbox";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await guardApiRequest(request, { profile: "strict" });
  if (guard) return guard;

  let body: { sessionId: string };
  try {
    body = await readJsonRequest<{ sessionId: string }>(request, { maxBytes: BODY_SIZE_LIMITS.normalJson });
  } catch (error) {
    if (error instanceof SafeRequestError) {
      return NextResponse.json(safeRequestErrorPayload(error), { status: error.statusCode });
    }
    throw error;
  }
  if (!body.sessionId) {
    return NextResponse.json(apiErrorPayload("SESSION_ID_REQUIRED", "sessionId is required."), { status: 400 });
  }
  const session = await getSessionById(body.sessionId);
  if (!session) {
    return NextResponse.json(apiErrorPayload("SESSION_NOT_FOUND", "Session not found."), { status: 404 });
  }
  const result = await reviewProofBundleForMcp(session);
  const response: ApiSuccessResponse<typeof result> = {
    ok: true,
    message: "Proof bundle review completed.",
    data: result,
  };
  return NextResponse.json(response);
}
