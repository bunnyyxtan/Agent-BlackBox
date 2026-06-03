import { NextResponse } from "next/server";

import { guardApiRequest } from "@/lib/security/api-guard";
import { getStorageAdapter } from "@/lib/storage-adapters";
import { hydrateSessionStore } from "@/lib/session-service";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function GET(request: Request) {
  const guard = await guardApiRequest(request, { profile: "read" });
  if (guard) return guard;

  await hydrateSessionStore();
  const adapter = getStorageAdapter(new URL(request.url).searchParams.get("adapter") ?? undefined);
  const storageRefs = adapter.listStorageRefs ? await adapter.listStorageRefs() : [];
  const uploads = { storageRefs, uploadAdapter: adapter.id };
  const response: ApiSuccessResponse<typeof uploads> = {
    ok: true,
    message: `Storage listing read through the ${adapter.id} adapter.`,
    data: uploads,
  };
  return NextResponse.json(response);
}
