import { NextResponse } from "next/server";

import { guardApiRequest } from "@/lib/security/api-guard";
import { listSessionSummaries } from "@/lib/session-service";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function GET(request: Request) {
  const guard = await guardApiRequest(request, { profile: "read" });
  if (guard) return guard;

  const sessions = await listSessionSummaries();
  const response: ApiSuccessResponse<{ sessions: typeof sessions }> = {
    ok: true,
    message: "Redacted session summaries loaded from the server-side session store.",
    data: { sessions },
  };
  return NextResponse.json(response);
}
