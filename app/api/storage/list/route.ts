import { NextResponse } from "next/server";

import { getStorageAdapter } from "@/lib/storage-adapters";
import { hydrateSessionStore } from "@/lib/session-service";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export async function GET(request: Request) {
  await hydrateSessionStore();
  const adapter = getStorageAdapter(new URL(request.url).searchParams.get("adapter") ?? undefined);
  const storageRefs = adapter.listStorageRefs ? await adapter.listStorageRefs() : [];
  const uploads = { storageRefs, uploadAdapter: adapter.id };
  const response: PlaceholderApiResponse<typeof uploads> = {
    ok: true,
    phase: "phase-2a",
    message: `Storage listing read through the ${adapter.id} adapter.`,
    data: uploads,
  };
  return NextResponse.json(response);
}
