import { NextResponse } from "next/server";

import { guardApiRequest } from "@/lib/security/api-guard";
import { getStorageAdapter } from "@/lib/storage-adapters";
import { getStorageReferenceByUploadJobId, hydrateSessionStore } from "@/lib/session-service";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function GET(request: Request, { params }: { params: Promise<{ uploadJobId: string }> }) {
  const guard = await guardApiRequest(request, { profile: "read" });
  if (guard) return guard;

  const { uploadJobId } = await params;
  await hydrateSessionStore();
  const storedReference = await getStorageReferenceByUploadJobId(uploadJobId);
  const adapter = getStorageAdapter(
    new URL(request.url).searchParams.get("adapter") ?? storedReference?.storageProvider,
  );
  const status = await adapter.getStorageStatus(storedReference ?? uploadJobId);
  const response: ApiSuccessResponse<typeof status> = {
    ok: true,
    message: `Storage status read through the ${adapter.id} adapter.`,
    data: status,
  };
  return NextResponse.json(response);
}
