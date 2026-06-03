import { NextResponse } from "next/server";

import { apiErrorPayload } from "@/lib/http/safe-request";
import { guardApiRequest } from "@/lib/security/api-guard";
import { walrusSdkRelayStorageAdapter } from "@/lib/storage-adapters/walrus-sdk-relay";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function GET(request: Request, { params }: { params: Promise<{ blobId: string }> }) {
  const guard = await guardApiRequest(request, { profile: "read" });
  if (guard) return guard;

  const { blobId } = await params;
  const result = await walrusSdkRelayStorageAdapter.getStoredTrace(blobId);
  if (!result.available) {
    return NextResponse.json(
      apiErrorPayload("WALRUS_READ_FAILED", result.error ?? "Walrus blob is unavailable."),
      { status: result.readStatus === "not_configured" ? 503 : result.readStatus === "invalid_json" ? 422 : 404 },
    );
  }
  const response: ApiSuccessResponse<typeof result> = {
    ok: true,
    message: "Direct Walrus Mainnet blob read completed through the configured aggregator.",
    data: result,
  };
  return NextResponse.json(response);
}
