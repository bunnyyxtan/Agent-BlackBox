import { NextResponse } from "next/server";

import { apiErrorPayload } from "@/lib/http/safe-request";
import { guardApiRequest } from "@/lib/security/api-guard";
import { getStorageAdapter } from "@/lib/storage-adapters";
import { getStorageReferenceByBlobId, hydrateSessionStore } from "@/lib/session-service";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function GET(request: Request, { params }: { params: Promise<{ blobId: string }> }) {
  const guard = await guardApiRequest(request, { profile: "read" });
  if (guard) return guard;

  const { blobId } = await params;
  await hydrateSessionStore();
  const storedReference = await getStorageReferenceByBlobId(blobId);
  const adapter = getStorageAdapter(
    new URL(request.url).searchParams.get("adapter") ?? storedReference?.storageProvider,
  );
  const result = await adapter.getStoredTrace(blobId);
  if (!result.available) {
    return NextResponse.json(
      apiErrorPayload("STORAGE_READ_FAILED", result.error ?? "Stored trace bundle is unavailable."),
      { status: result.readStatus === "not_configured" ? 503 : result.readStatus === "invalid_json" ? 422 : 404 },
    );
  }
  const response: ApiSuccessResponse<typeof result> = {
    ok: true,
    message: `Stored trace read through the ${adapter.id} adapter.`,
    data: result,
  };
  return NextResponse.json(response);
}
