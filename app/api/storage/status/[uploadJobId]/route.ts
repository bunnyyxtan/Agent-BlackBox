import { NextResponse } from "next/server";

import { getStorageAdapter } from "@/lib/storage-adapters";
import { getStorageReferenceByUploadJobId, hydrateSessionStore } from "@/lib/session-service";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export async function GET(request: Request, { params }: { params: Promise<{ uploadJobId: string }> }) {
  const { uploadJobId } = await params;
  await hydrateSessionStore();
  const storedReference = await getStorageReferenceByUploadJobId(uploadJobId);
  const adapter = getStorageAdapter(
    new URL(request.url).searchParams.get("adapter") ?? storedReference?.storageProvider,
  );
  const status = await adapter.getStorageStatus(storedReference ?? uploadJobId);
  const response: PlaceholderApiResponse<typeof status> = {
    ok: true,
    phase: "phase-2a",
    message: `Storage status read through the ${adapter.id} adapter.`,
    data: status,
  };
  return NextResponse.json(response);
}
