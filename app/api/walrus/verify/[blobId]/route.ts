import { NextResponse } from "next/server";

import { apiErrorPayload, BODY_SIZE_LIMITS, readJsonRequest, SafeRequestError, safeRequestErrorPayload } from "@/lib/http/safe-request";
import { guardApiRequest } from "@/lib/security/api-guard";
import { walrusSdkRelayStorageAdapter } from "@/lib/storage-adapters/walrus-sdk-relay";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function POST(request: Request, { params }: { params: Promise<{ blobId: string }> }) {
  const guard = await guardApiRequest(request, { profile: "standard" });
  if (guard) return guard;

  const { blobId } = await params;
  let body: { expectedHash?: string; expectedTraceHash?: string };
  try {
    body = await readJsonRequest<{ expectedHash?: string; expectedTraceHash?: string }>(request, {
      maxBytes: BODY_SIZE_LIMITS.normalJson,
    });
  } catch (error) {
    if (error instanceof SafeRequestError) {
      return NextResponse.json(safeRequestErrorPayload(error), { status: error.statusCode });
    }
    throw error;
  }
  const expectedHash = body.expectedTraceHash ?? body.expectedHash;
  if (!expectedHash) {
    return NextResponse.json(apiErrorPayload("EXPECTED_TRACE_HASH_REQUIRED", "expectedTraceHash is required."), { status: 400 });
  }
  const result = await walrusSdkRelayStorageAdapter.verifyStoredTrace(blobId, expectedHash);
  if (!result.checked) {
    return NextResponse.json(
      apiErrorPayload("WALRUS_VERIFY_FAILED", result.error ?? "Walrus blob could not be verified."),
      { status: result.readStatus === "not_configured" ? 503 : result.readStatus === "invalid_json" ? 422 : 404 },
    );
  }
  const response: ApiSuccessResponse<typeof result> = {
    ok: true,
    message: "Direct Walrus Mainnet hash verification completed from aggregator content.",
    data: result,
  };
  return NextResponse.json(response);
}
