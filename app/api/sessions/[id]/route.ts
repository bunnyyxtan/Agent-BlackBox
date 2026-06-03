import { NextResponse } from "next/server";

import { getSessionById } from "@/lib/session-service";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) {
    return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
  }

  const response: PlaceholderApiResponse<{ session: typeof session }> = {
    ok: true,
    phase: "phase-1",
    message: "Session loaded from the Phase 1 server-side store.",
    data: { session },
  };
  return NextResponse.json(response);
}
