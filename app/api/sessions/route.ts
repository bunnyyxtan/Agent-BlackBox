import { NextResponse } from "next/server";

import { guardApiRequest } from "@/lib/security/api-guard";
import { listSessionSummariesSafe } from "@/lib/session-service";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function GET(request: Request) {
  const guard = await guardApiRequest(request, { profile: "read" });
  if (guard) return guard;

  const { sessions, warning } = await listSessionSummariesSafe();
  const response: ApiSuccessResponse<{ sessions: typeof sessions }> = {
    ok: true,
    message: warning ?? "Redacted session summaries loaded from the server-side session store.",
    data: { sessions },
  };
  return NextResponse.json(response);
}
