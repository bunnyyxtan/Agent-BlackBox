import { NextResponse } from "next/server";

import { getStorageAdapter } from "@/lib/storage-adapters";
import { hydrateSessionStore } from "@/lib/session-service";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export async function POST(request: Request) {
  await hydrateSessionStore();
  const body = (await request.json()) as {
    uploadJobId?: string;
    jobId?: string;
    storageProvider?: string;
    instantDelete?: boolean;
  };
  const uploadJobId = body.uploadJobId ?? body.jobId;
  if (!uploadJobId) {
    return NextResponse.json({ ok: false, message: "uploadJobId is required." }, { status: 400 });
  }

  const adapter = getStorageAdapter(body.storageProvider);
  const result = adapter.cancelRenewal
    ? await adapter.cancelRenewal(uploadJobId, body.instantDelete)
    : await adapter.getStorageStatus(uploadJobId);
  const response: PlaceholderApiResponse<typeof result> = {
    ok: true,
    phase: "phase-1",
    message: `Renewal cancellation handled through the ${adapter.id} adapter.`,
    data: result,
  };
  return NextResponse.json(response);
}
