import { NextResponse } from "next/server";

import { getStorageAdapter } from "@/lib/storage-adapters";
import { getStorageReferenceByBlobId, hydrateSessionStore } from "@/lib/session-service";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export async function GET(request: Request, { params }: { params: Promise<{ blobId: string }> }) {
  const { blobId } = await params;
  await hydrateSessionStore();
  const storedReference = await getStorageReferenceByBlobId(blobId);
  const adapter = getStorageAdapter(
    new URL(request.url).searchParams.get("adapter") ?? storedReference?.storageProvider,
  );
  const result = await adapter.getStoredTrace(blobId);
  if (!result.available) {
    return NextResponse.json(
      { ok: false, message: result.error ?? "Stored trace bundle is unavailable.", data: result },
      { status: result.readStatus === "not_configured" ? 503 : result.readStatus === "invalid_json" ? 422 : 404 },
    );
  }
  const response: PlaceholderApiResponse<typeof result> = {
    ok: true,
    phase: "phase-2a",
    message: `Stored trace read through the ${adapter.id} adapter.`,
    data: result,
  };
  return NextResponse.json(response);
}
