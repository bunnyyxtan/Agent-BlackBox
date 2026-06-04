import { NextResponse } from "next/server";

import { apiErrorPayload, BODY_SIZE_LIMITS, readJsonRequest, SafeRequestError, safeRequestErrorPayload } from "@/lib/http/safe-request";
import { guardApiRequest } from "@/lib/security/api-guard";
import { simulateTamper } from "@/lib/session-service";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApiRequest(request, { profile: "strict" });
  if (guard) return guard;

  const { id } = await params;
  let body: { tamperedOutput?: string };
  try {
    body = await readJsonRequest<{ tamperedOutput?: string }>(request, {
      maxBytes: BODY_SIZE_LIMITS.normalJson,
      required: false,
    });
  } catch (error) {
    if (error instanceof SafeRequestError) {
      return NextResponse.json(safeRequestErrorPayload(error), { status: error.statusCode });
    }
    throw error;
  }
  const result = await simulateTamper(id, body.tamperedOutput);
  if (!result) {
    return NextResponse.json(apiErrorPayload("SESSION_NOT_FOUND", "Session not found."), { status: 404 });
  }

  const response: ApiSuccessResponse<typeof result> = {
    ok: true,
    message: "Tamper simulation recomputed a temporary local hash mismatch. The original session was not changed.",
    data: result,
  };
  return NextResponse.json(response);
}
