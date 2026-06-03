import { NextResponse } from "next/server";

import { apiErrorPayload, BODY_SIZE_LIMITS, readJsonRequest, SafeRequestError, safeRequestErrorPayload } from "@/lib/http/safe-request";
import { guardApiRequest } from "@/lib/security/api-guard";
import { storeTraceBundleWithFallback, type TraceBundle } from "@/lib/storage-adapters";
import { WalrusHttpError } from "@/lib/walrus";
import type { ApiSuccessResponse, StorageMode } from "@/types/blackbox";

function formatUploadAdapterLabel(adapter: string) {
  if (adapter === "walrus_mainnet_upload_relay") return "Walrus Mainnet Upload Relay";
  if (adapter === "walrus_http_publisher") return "Walrus HTTP Publisher";
  if (adapter === "tatum_walrus") return "Tatum Walrus Adapter";
  if (adapter === "local") return "Local Trace Store";
  return "configured storage adapter";
}

interface UploadRequest {
  sessionId?: string;
  traceBundle: TraceBundle;
  storageProvider?: string;
  storageEpochs?: number;
  storageMode?: StorageMode;
}

export async function POST(request: Request) {
  const guard = await guardApiRequest(request, { profile: "strict" });
  if (guard) return guard;

  try {
    const body = await readJsonRequest<UploadRequest>(request, {
      maxBytes: BODY_SIZE_LIMITS.storageJson,
    });
    if (!body.traceBundle?.trace) {
      return NextResponse.json(apiErrorPayload("TRACE_BUNDLE_REQUIRED", "traceBundle.trace is required."), { status: 400 });
    }

    const storage = await storeTraceBundleWithFallback(
      body.traceBundle,
      {
        storageEpochs: body.storageEpochs ?? Number(process.env.WALRUS_STORAGE_EPOCHS ?? 1),
        storageMode: body.storageMode ?? "deletable",
      },
      body.storageProvider,
    );
    const response: ApiSuccessResponse<typeof storage> = {
      ok: true,
      message: storage.warning
        ? `Trace bundle stored with warning: ${storage.warning}`
        : `Trace bundle stored through the ${formatUploadAdapterLabel(storage.uploadAdapter)} adapter.`,
      data: storage,
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof SafeRequestError) {
      return NextResponse.json(safeRequestErrorPayload(error), { status: error.statusCode });
    }
    if (error instanceof WalrusHttpError) {
      return NextResponse.json(apiErrorPayload(error.code, error.message), { status: error.statusCode });
    }
    throw error;
  }
}
