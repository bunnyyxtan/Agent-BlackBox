import { NextResponse } from "next/server";

import { walrusSdkRelayStorageAdapter } from "@/lib/storage-adapters/walrus-sdk-relay";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export async function GET(_: Request, { params }: { params: Promise<{ blobId: string }> }) {
  const { blobId } = await params;
  const result = await walrusSdkRelayStorageAdapter.getStoredTrace(blobId);
  if (!result.available) {
    return NextResponse.json(
      { ok: false, message: result.error ?? "Walrus blob is unavailable.", data: result },
      { status: result.readStatus === "not_configured" ? 503 : result.readStatus === "invalid_json" ? 422 : 404 },
    );
  }
  const response: PlaceholderApiResponse<typeof result> = {
    ok: true,
    phase: "phase-2e",
    message: "Direct Walrus Mainnet blob read completed through the configured aggregator.",
    data: result,
  };
  return NextResponse.json(response);
}
