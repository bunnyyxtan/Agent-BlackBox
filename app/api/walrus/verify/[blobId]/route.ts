import { NextResponse } from "next/server";

import { walrusSdkRelayStorageAdapter } from "@/lib/storage-adapters/walrus-sdk-relay";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export async function POST(request: Request, { params }: { params: Promise<{ blobId: string }> }) {
  const { blobId } = await params;
  const body = (await request.json()) as { expectedHash?: string; expectedTraceHash?: string };
  const expectedHash = body.expectedTraceHash ?? body.expectedHash;
  if (!expectedHash) {
    return NextResponse.json({ ok: false, message: "expectedTraceHash is required." }, { status: 400 });
  }
  const result = await walrusSdkRelayStorageAdapter.verifyStoredTrace(blobId, expectedHash);
  if (!result.checked) {
    return NextResponse.json(
      { ok: false, message: result.error ?? "Walrus blob could not be verified.", data: result },
      { status: result.readStatus === "not_configured" ? 503 : result.readStatus === "invalid_json" ? 422 : 404 },
    );
  }
  const response: PlaceholderApiResponse<typeof result> = {
    ok: true,
    phase: "phase-2e",
    message: "Direct Walrus Mainnet hash verification completed from aggregator content.",
    data: result,
  };
  return NextResponse.json(response);
}
