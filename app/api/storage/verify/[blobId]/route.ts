import { NextResponse } from "next/server";

import { getStorageAdapter } from "@/lib/storage-adapters";
import { getStorageReferenceByBlobId, hydrateSessionStore } from "@/lib/session-service";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export async function POST(request: Request, { params }: { params: Promise<{ blobId: string }> }) {
  const { blobId } = await params;
  await hydrateSessionStore();
  const body = (await request.json()) as { expectedTraceHash: string; storageProvider?: string };
  if (!body.expectedTraceHash) {
    return NextResponse.json(
      { ok: false, message: "expectedTraceHash is required." },
      { status: 400 },
    );
  }

  const storedReference = await getStorageReferenceByBlobId(blobId);
  const adapter = getStorageAdapter(body.storageProvider ?? storedReference?.storageProvider);
  const result = await adapter.verifyStoredTrace(blobId, body.expectedTraceHash);
  if (!result.checked) {
    return NextResponse.json(
      { ok: false, message: result.error ?? "Stored trace bundle could not be verified.", data: result },
      { status: result.readStatus === "not_configured" ? 503 : result.readStatus === "invalid_json" ? 422 : 404 },
    );
  }
  const response: PlaceholderApiResponse<typeof result> = {
    ok: true,
    phase: "phase-2a",
    message: `Stored trace verified through the ${adapter.id} adapter.`,
    data: result,
  };
  return NextResponse.json(response);
}
