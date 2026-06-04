import { NextResponse } from "next/server";

import { apiErrorPayload } from "@/lib/http/safe-request";
import { isApiGuardEnabled, isApiRequestAuthorized } from "@/lib/security/api-guard";
import { getSessionForWalletSafe, redactSessionSummary } from "@/lib/session-service";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const ownerWallet = url.searchParams.get("ownerWallet") ?? "";
  const session = await getSessionForWalletSafe(id, ownerWallet);
  if (!session) {
    const message = ownerWallet
      ? "This session belongs to another wallet."
      : "Connect the session owner wallet to inspect this session.";
    return NextResponse.json(apiErrorPayload("SESSION_NOT_FOUND", message), { status: ownerWallet ? 403 : 401 });
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
