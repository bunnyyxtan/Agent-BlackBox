import { NextResponse } from "next/server";

import { getSessionById } from "@/lib/session-service";
import { isValidTransactionDigest } from "@/lib/sui-client-helpers";
import { getSuiProofRegistryConfig } from "@/lib/sui-proof";
import { verifyProofMetadata } from "@/lib/tatum-rpc";

interface VerifyProofRequest {
  sessionId?: unknown;
  proofObjectId?: unknown;
  transactionDigest?: unknown;
  expectedTraceHash?: unknown;
  expectedResultHash?: unknown;
  expectedInputHash?: unknown;
  expectedBlobId?: unknown;
  expectedSessionId?: unknown;
  expectedOwner?: unknown;
  packageId?: unknown;
  eventType?: unknown;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as VerifyProofRequest | null;
  if (!body) {
    return NextResponse.json({ error: "A JSON proof verification body is required." }, { status: 400 });
  }

  const sessionId = readString(body.sessionId);
  const session = sessionId ? await getSessionById(sessionId) : undefined;
  const proofRegistry = getSuiProofRegistryConfig();
  if (sessionId && !session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const proofObjectId =
    readString(body.proofObjectId) ?? session?.proof.suiObjectId ?? "proof-object-pending";
  const transactionDigest =
    readString(body.transactionDigest) ?? session?.proof.transactionDigest;
  const expectedTraceHash =
    readString(body.expectedTraceHash) ?? session?.trace.traceHash;
  const expectedResultHash =
    readString(body.expectedResultHash) ?? session?.trace.resultHash;
  const expectedInputHash =
    readString(body.expectedInputHash) ?? session?.trace.inputHash;
  const expectedBlobId = readString(body.expectedBlobId) ?? session?.storage.blobId;
  const expectedStorageNetwork = session?.storage.storageNetwork ?? session?.proof.storageNetwork ?? "walrus-mainnet";
  const expectedSessionId = readString(body.expectedSessionId) ?? session?.id;
  const expectedOwner =
    readString(body.expectedOwner) ?? session?.proof.owner ?? session?.ownerAddress ?? undefined;
  const anchored = isValidTransactionDigest(transactionDigest ?? "");

  if (
    !transactionDigest ||
    !expectedTraceHash ||
    !expectedResultHash ||
    !expectedInputHash ||
    !expectedBlobId ||
    !expectedSessionId ||
    (anchored && !expectedOwner)
  ) {
    return NextResponse.json(
      { error: "Proof references and expected evidence hashes are required." },
      { status: 400 },
    );
  }

  const result = await verifyProofMetadata(
    {
      suiObjectId: proofObjectId,
      transactionDigest,
      packageId:
        readString(body.packageId) ??
        (session?.proof.packageId !== "package-id-pending" ? session?.proof.packageId : undefined) ??
        proofRegistry.packageId ??
        "package-id-pending",
      eventType: readString(body.eventType) ?? session?.proof.eventType ?? proofRegistry.eventType,
    },
    {
      sessionId: expectedSessionId,
      owner: expectedOwner ?? "",
      traceHash: expectedTraceHash,
      resultHash: expectedResultHash,
      inputHash: expectedInputHash,
      blobId: expectedBlobId,
      storageNetwork: expectedStorageNetwork,
    },
  );

  return NextResponse.json({
    ...result,
    tatumRpcConfigured: result.configured,
    sessionId: sessionId ?? null,
  });
}
