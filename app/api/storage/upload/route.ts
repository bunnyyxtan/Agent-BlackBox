import { NextResponse } from "next/server";

import { storeTraceBundleWithFallback, type TraceBundle } from "@/lib/storage-adapters";
import { WalrusHttpError } from "@/lib/walrus";
import type { PlaceholderApiResponse, StorageMode } from "@/types/blackbox";

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
  try {
    const body = (await request.json()) as UploadRequest;
    if (!body.traceBundle?.trace) {
      return NextResponse.json({ ok: false, message: "traceBundle.trace is required." }, { status: 400 });
    }

    const storage = await storeTraceBundleWithFallback(
      body.traceBundle,
      {
        storageEpochs: body.storageEpochs ?? Number(process.env.WALRUS_STORAGE_EPOCHS ?? 1),
        storageMode: body.storageMode ?? "deletable",
      },
      body.storageProvider,
    );
    const response: PlaceholderApiResponse<typeof storage> = {
      ok: true,
      phase: "phase-2a",
      message: storage.warning
        ? `Trace bundle stored with warning: ${storage.warning}`
        : `Trace bundle stored through the ${formatUploadAdapterLabel(storage.uploadAdapter)} adapter.`,
      data: storage,
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof WalrusHttpError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.statusCode });
    }
    throw error;
  }
}
