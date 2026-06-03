import { NextResponse } from "next/server";

import { simulateTamper } from "@/lib/session-service";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { tamperedOutput?: string };
  const result = await simulateTamper(id, body.tamperedOutput);
  if (!result) {
    return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
  }

  const response: PlaceholderApiResponse<typeof result> = {
    ok: true,
    phase: "phase-1",
    message: "Tamper simulation recomputed a mismatched local result and trace hash.",
    data: result,
  };
  return NextResponse.json(response);
}
