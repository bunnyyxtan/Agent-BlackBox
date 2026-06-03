import { NextResponse } from "next/server";

import {
  callTatumSuiRpc,
  isAllowedTatumSuiRpcMethod,
} from "@/lib/tatum-rpc";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { method?: unknown; params?: unknown }
    | null;
  if (!body || typeof body.method !== "string") {
    return NextResponse.json({ error: "method is required." }, { status: 400 });
  }
  if (!isAllowedTatumSuiRpcMethod(body.method)) {
    return NextResponse.json(
      { error: "RPC method is not allowed." },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.params)) {
    return NextResponse.json({ error: "params must be an array." }, { status: 400 });
  }

  return NextResponse.json(await callTatumSuiRpc(body.method, body.params));
}
