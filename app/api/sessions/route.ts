import { NextResponse } from "next/server";

import { listSessions } from "@/lib/session-service";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export async function GET() {
  const sessions = await listSessions();
  const response: PlaceholderApiResponse<{ sessions: typeof sessions }> = {
    ok: true,
    phase: "phase-1",
    message: "Sessions loaded from the Phase 1 server-side store.",
    data: { sessions },
  };
  return NextResponse.json(response);
}
