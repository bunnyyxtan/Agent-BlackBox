import { NextResponse } from "next/server";

import { recheckSession } from "@/lib/session-service";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await recheckSession(id);
  if (!result) {
    return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
  }

  const response: PlaceholderApiResponse<typeof result> = {
    ok: true,
    phase: "phase-2d",
    message: "Stored trace and Sui proof read-only verification rerun completed.",
    data: result,
  };
  return NextResponse.json(response);
}
