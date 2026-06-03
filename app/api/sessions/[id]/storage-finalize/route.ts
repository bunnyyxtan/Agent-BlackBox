import { NextResponse } from "next/server";

import { finalizeSessionStorage, SessionValidationError } from "@/lib/session-service";
import type { AgentSession, PlaceholderApiResponse, StorageReference } from "@/types/blackbox";

interface FinalizeStorageRequest {
  session: AgentSession;
  storage: StorageReference;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = (await request.json()) as FinalizeStorageRequest;
    const session = await finalizeSessionStorage(id, body);
    const response: PlaceholderApiResponse<{ session: AgentSession }> = {
      ok: true,
      phase: "phase-2e",
      message: "Walrus Mainnet SDK Relay upload finalized, read back, hash-verified, and persisted.",
      data: { session },
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof SessionValidationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Walrus storage could not be finalized.";
    return NextResponse.json(
      {
        ok: false,
        code: "storage_finalize_failed",
        message: "Walrus storage could not be finalized.",
        details: message,
      },
      { status: 500 },
    );
  }
}
