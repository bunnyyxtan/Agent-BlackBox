import { NextResponse } from "next/server";

import { apiErrorPayload, BODY_SIZE_LIMITS, readJsonRequest, SafeRequestError, safeRequestErrorPayload } from "@/lib/http/safe-request";
import { guardApiRequest } from "@/lib/security/api-guard";
import { getStorageAdapter } from "@/lib/storage-adapters";
import { hydrateSessionStore } from "@/lib/session-service";
import { WalrusHttpError } from "@/lib/walrus";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function POST(request: Request) {
  const guard = await guardApiRequest(request, { profile: "strict" });
  if (guard) return guard;

  await hydrateSessionStore();
  let body: { uploadJobId?: string; jobId?: string; storageProvider?: string; instantDelete?: boolean };
  try {
    body = await readJsonRequest<{
      uploadJobId?: string;
      jobId?: string;
      storageProvider?: string;
      instantDelete?: boolean;
    }>(request, { maxBytes: BODY_SIZE_LIMITS.normalJson });
  } catch (error) {
    if (error instanceof SafeRequestError) {
      return NextResponse.json(safeRequestErrorPayload(error), { status: error.statusCode });
    }
    throw error;
  }
  const uploadJobId = body.uploadJobId ?? body.jobId;
  if (!uploadJobId) {
    return NextResponse.json(apiErrorPayload("UPLOAD_JOB_ID_REQUIRED", "uploadJobId is required."), { status: 400 });
  }

  try {
    const adapter = getStorageAdapter(body.storageProvider);
    const result = adapter.cancelRenewal
      ? await adapter.cancelRenewal(uploadJobId, body.instantDelete)
      : await adapter.getStorageStatus(uploadJobId);
    const response: ApiSuccessResponse<typeof result> = {
      ok: true,
      message: `Renewal cancellation handled through the ${adapter.id} adapter.`,
      data: result,
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof WalrusHttpError) {
      return NextResponse.json(apiErrorPayload(error.code, error.message), { status: error.statusCode });
    }
    throw error;
  }
}
