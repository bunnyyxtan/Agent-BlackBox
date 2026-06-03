import { NextResponse } from "next/server";

import { apiErrorPayload } from "@/lib/http/safe-request";
import { guardApiRequest } from "@/lib/security/api-guard";
import { recheckSession } from "@/lib/session-service";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApiRequest(request, { profile: "strict" });
  if (guard) return guard;

  const { id } = await params;
  const result = await recheckSession(id);
  if (!result) {
    return NextResponse.json(apiErrorPayload("SESSION_NOT_FOUND", "Session not found."), { status: 404 });
  }

  const response: ApiSuccessResponse<typeof result> = {
    ok: true,
    message: "Stored trace and Sui proof read-only verification rerun completed.",
    data: result,
  };
  return NextResponse.json(response);
}
