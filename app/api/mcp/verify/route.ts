import { NextResponse } from "next/server";

import { verifyWithMcpPlaceholder } from "@/lib/mcp-verifier";
import { getSessionById } from "@/lib/session-service";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export async function POST(request: Request) {
  const body = (await request.json()) as { sessionId: string };
  if (!body.sessionId) {
    return NextResponse.json({ ok: false, message: "sessionId is required." }, { status: 400 });
  }
  const session = await getSessionById(body.sessionId);
  if (!session) {
    return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
  }
  // TODO(phase-2): connect the optional Tatum MCP verifier for AI-assisted evidence inspection.
  const result = await verifyWithMcpPlaceholder(session);
  const response: PlaceholderApiResponse<typeof result> = {
    ok: true,
    phase: "phase-1",
    message: "Tatum MCP verification boundary prepared.",
    data: result,
  };
  return NextResponse.json(response);
}
