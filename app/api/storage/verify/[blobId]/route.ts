import { NextResponse } from "next/server";

import { apiErrorPayload, BODY_SIZE_LIMITS, readJsonRequest, SafeRequestError, safeRequestErrorPayload } from "@/lib/http/safe-request";
import { guardApiRequest } from "@/lib/security/api-guard";
import { getStorageAdapter } from "@/lib/storage-adapters";
import { getStorageReferenceByBlobId, hydrateSessionStore } from "@/lib/session-service";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function POST(request: Request, { params }: { params: Promise<{ blobId: string }> }) {
  const guard = await guardApiRequest(request, { profile: "standard" });
  if (guard) return guard;

  const { blobId } = await params;
  await hydrateSessionStore();
  let body: { expectedTraceHash: string; storageProvider?: string };
  try {
    body = await readJsonRequest<{ expectedTraceHash: string; storageProvider?: string }>(request, {
      maxBytes: BODY_SIZE_LIMITS.normalJson,
    });
  } catch (error) {
    if (error instanceof SafeRequestError) {
      return NextResponse.json(safeRequestErrorPayload(error), { status: error.statusCode });
    }
    throw error;
  }
  if (!body.expectedTraceHash) {
    return NextResponse.json(
      apiErrorPayload("EXPECTED_TRACE_HASH_REQUIRED", "expectedTraceHash is required."),
      { status: 400 },
    );
  }

  const storedReference = await getStorageReferenceByBlobId(blobId);
  const adapter = getStorageAdapter(body.storageProvider ?? storedReference?.storageProvider);
  const result = await adapter.verifyStoredTrace(blobId, body.expectedTraceHash);
  if (!result.checked) {
    return NextResponse.json(
      apiErrorPayload("STORAGE_VERIFY_FAILED", result.error ?? "Stored trace bundle could not be verified."),
      { status: result.readStatus === "not_configured" ? 503 : result.readStatus === "invalid_json" ? 422 : 404 },
    );
  }
  const response: ApiSuccessResponse<typeof result> = {
    ok: true,
    message: `Stored trace verified through the ${adapter.id} adapter.`,
    data: result,
  };
  return NextResponse.json(response);
}
