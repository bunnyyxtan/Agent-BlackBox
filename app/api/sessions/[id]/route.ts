import { NextResponse } from "next/server";

import { apiErrorPayload } from "@/lib/http/safe-request";
import { isApiGuardEnabled, isApiRequestAuthorized } from "@/lib/security/api-guard";
import { getSessionByIdSafe, redactSessionSummary } from "@/lib/session-service";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionByIdSafe(id);
  if (!session) {
    return NextResponse.json(apiErrorPayload("SESSION_NOT_FOUND", "Session not found."), { status: 404 });
  }

  if (isApiGuardEnabled() && !isApiRequestAuthorized(request)) {
    const summary = redactSessionSummary(session);
    const response: ApiSuccessResponse<{ session: typeof summary; redacted: true }> = {
      ok: true,
      message: "Redacted session summary loaded. Full session data requires same-origin access.",
      data: { session: summary, redacted: true },
    };
    return NextResponse.json(response);
  }

  const response: ApiSuccessResponse<{ session: typeof session }> = {
    ok: true,
    message: "Session loaded from the server-side session store.",
    data: { session },
  };
  return NextResponse.json(response);
}
