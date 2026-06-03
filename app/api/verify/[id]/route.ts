import { NextResponse } from "next/server";

import { apiErrorPayload } from "@/lib/http/safe-request";
import { guardApiRequest, isApiGuardEnabled, isApiRequestAuthorized } from "@/lib/security/api-guard";
import { getSessionById, verifySession } from "@/lib/session-service";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isApiGuardEnabled() && !isApiRequestAuthorized(request)) {
    const session = await getSessionById(id);
    if (!session) {
      return NextResponse.json(apiErrorPayload("SESSION_NOT_FOUND", "Session not found."), { status: 404 });
    }
    const proof = {
      sessionId: session.id,
      status: session.status,
      storage: {
        provider: session.storage.storageProvider,
        status: session.storage.storageStatus,
        network: session.storage.storageNetwork,
        blobId: session.storage.blobId,
        blobObjectId: session.storage.blobObjectId,
      },
      proof: {
        status: session.proof.status,
        network: session.proof.network,
        transactionDigest: session.proof.transactionDigest,
        suiObjectId: session.proof.suiObjectId,
        packageId: session.proof.packageId,
      },
      hashes: {
        inputHash: session.trace.inputHash,
        resultHash: session.trace.resultHash,
        traceHash: session.trace.traceHash,
      },
      verification: session.verification,
    };
    const response: ApiSuccessResponse<{ proof: typeof proof; redacted: true }> = {
      ok: true,
      message: "Redacted proof payload loaded without raw prompt, report, or trace evidence.",
      data: { proof, redacted: true },
    };
    return NextResponse.json(response);
  }

  const guard = await guardApiRequest(request, { profile: "read" });
  if (guard) return guard;

  const result = await verifySession(id);
  if (!result) {
    return NextResponse.json(apiErrorPayload("SESSION_NOT_FOUND", "Session not found."), { status: 404 });
  }
  const response: ApiSuccessResponse<typeof result> = {
    ok: true,
    message: "Stored trace verification completed with an honest Tatum Sui RPC proof status.",
    data: result,
  };
  return NextResponse.json(response);
}
