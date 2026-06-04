import { NextResponse } from "next/server";

import {
  anchorSessionProof,
  recheckSession,
  SessionValidationError,
} from "@/lib/session-service";
import { apiErrorPayload, BODY_SIZE_LIMITS, readJsonRequest, SafeRequestError, safeRequestErrorPayload } from "@/lib/http/safe-request";
import { guardApiRequest } from "@/lib/security/api-guard";
import type { ApiSuccessResponse } from "@/types/blackbox";

interface ProofAnchorRequest {
  transactionDigest?: unknown;
  proofObjectId?: unknown;
  packageId?: unknown;
  network?: unknown;
  owner?: unknown;
}

const MAX_REQUEST_BYTES = 4_096;
const MAX_FIELD_LENGTH = 256;

function readRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new SessionValidationError(`${field} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length > MAX_FIELD_LENGTH) {
    throw new SessionValidationError(`${field} is too long.`);
  }
  return normalized;
}

function readOptionalString(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  return readRequiredString(value, field);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiRequest(request, { profile: "strict" });
  if (guard) return guard;

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(apiErrorPayload("REQUEST_TOO_LARGE", "Request body is too large."), { status: 413 });
  }

  let body: ProofAnchorRequest | null = null;
  try {
    body = await readJsonRequest<ProofAnchorRequest>(request, {
      maxBytes: Math.min(MAX_REQUEST_BYTES, BODY_SIZE_LIMITS.normalJson),
    });
  } catch (error) {
    if (error instanceof SafeRequestError) {
      return NextResponse.json(safeRequestErrorPayload(error), { status: error.statusCode });
    }
    throw error;
  }
  if (!body) {
    return NextResponse.json(
      apiErrorPayload("INVALID_JSON", "A JSON proof-anchor body is required."),
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const session = await anchorSessionProof(id, {
      transactionDigest: readRequiredString(body.transactionDigest, "transactionDigest"),
      proofObjectId: readOptionalString(body.proofObjectId, "proofObjectId"),
      packageId: readRequiredString(body.packageId, "packageId"),
      network: readRequiredString(body.network, "network"),
      owner: readRequiredString(body.owner, "owner"),
    });
    if (!session) {
      return NextResponse.json(apiErrorPayload("SESSION_NOT_FOUND", "Session not found."), { status: 404 });
    }

    const verification = await recheckSession(session.id);
    const persistedSession = verification?.session ?? session;
    const response: ApiSuccessResponse<{
      session: typeof persistedSession;
      verification: typeof verification | null;
    }> = {
      ok: true,
      message:
        persistedSession.tatumRpc.status === "transaction_found"
          ? "Transaction found, but proof object/event verification is incomplete."
          : persistedSession.tatumRpc.status === "passed"
            ? "Wallet-signed Sui proof anchor verified through Tatum RPC."
          : "Wallet-signed Sui proof anchor recorded and read-only verification rerun completed.",
      data: {
        session: persistedSession,
        verification: verification ?? null,
      },
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof SessionValidationError) {
      return NextResponse.json(apiErrorPayload("SESSION_VALIDATION_FAILED", error.message), { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Sui proof anchor could not be persisted.";
    return NextResponse.json(
      apiErrorPayload("proof_anchor_failed", "Sui proof anchor could not be persisted.", message),
      { status: 500 },
    );
  }
}
