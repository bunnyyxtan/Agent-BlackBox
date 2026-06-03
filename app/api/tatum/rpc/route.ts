import { NextResponse } from "next/server";

import {
  callTatumSuiRpc,
  isAllowedTatumSuiRpcMethod,
} from "@/lib/tatum-rpc";
import { apiErrorPayload, BODY_SIZE_LIMITS, readJsonRequest, SafeRequestError, safeRequestErrorPayload } from "@/lib/http/safe-request";
import { guardApiRequest } from "@/lib/security/api-guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await guardApiRequest(request, { profile: "strict" });
  if (guard) return guard;

  let body: { method?: unknown; params?: unknown } | null = null;
  try {
    body = await readJsonRequest<{ method?: unknown; params?: unknown }>(request, {
      maxBytes: BODY_SIZE_LIMITS.normalJson,
    });
  } catch (error) {
    if (error instanceof SafeRequestError) {
      return NextResponse.json(safeRequestErrorPayload(error), { status: error.statusCode });
    }
    throw error;
  }
  if (!body || typeof body.method !== "string") {
    return NextResponse.json(apiErrorPayload("METHOD_REQUIRED", "method is required."), { status: 400 });
  }
  if (!isAllowedTatumSuiRpcMethod(body.method)) {
    return NextResponse.json(
      apiErrorPayload("RPC_METHOD_NOT_ALLOWED", "RPC method is not allowed."),
      { status: 400 },
    );
  }
  if (!Array.isArray(body.params)) {
    return NextResponse.json(apiErrorPayload("PARAMS_MUST_BE_ARRAY", "params must be an array."), { status: 400 });
  }

  return NextResponse.json(await callTatumSuiRpc(body.method, body.params));
}
