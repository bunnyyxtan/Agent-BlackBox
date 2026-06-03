import { NextResponse } from "next/server";

import {
  anchorSessionProof,
  recheckSession,
  SessionValidationError,
} from "@/lib/session-service";
import type { PlaceholderApiResponse } from "@/types/blackbox";

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
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, message: "Request body is too large." }, { status: 413 });
  }

  const body = (await request.json().catch(() => null)) as ProofAnchorRequest | null;
  if (!body) {
    return NextResponse.json(
      { ok: false, message: "A JSON proof-anchor body is required." },
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
      return NextResponse.json({ ok: false, message: "Session not found." }, { status: 404 });
    }

    const verification = await recheckSession(session.id);
    const persistedSession = verification?.session ?? session;
    const response: PlaceholderApiResponse<{
      session: typeof persistedSession;
      verification: typeof verification | null;
    }> = {
      ok: true,
      phase: "phase-2d",
      message:
        persistedSession.proof.status === "anchored_pending_object"
          ? "Transaction anchored. Proof object extraction pending."
          : "Wallet-signed Sui proof anchor recorded and read-only verification rerun completed.",
      data: {
        session: persistedSession,
        verification: verification ?? null,
      },
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof SessionValidationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
