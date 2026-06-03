import { NextResponse } from "next/server";

import { guardApiRequest } from "@/lib/security/api-guard";
import { getUploadRelayTipConfig } from "@/lib/storage-adapters/walrus-sdk-relay";
import { getWalrusConfiguration } from "@/lib/walrus";
import type { ApiSuccessResponse } from "@/types/blackbox";

export async function GET(request: Request) {
  const guard = await guardApiRequest(request, { profile: "read" });
  if (guard) return guard;

  const walrus = getWalrusConfiguration();
  const relayStatus = await getUploadRelayTipConfig();
  const relayDetails = relayStatus as {
    relayHost?: string;
    statusCode?: number;
    contentType?: string;
    responseSnippet?: string;
  };
  const result = {
    configured: walrus.relayConfigured,
    relayReachable: relayStatus.reachable,
    network: walrus.network,
    relayUrl: walrus.relayUrl,
    relayHost: relayDetails.relayHost,
    aggregatorUrl: walrus.aggregatorUrl,
    tipRequirement: relayStatus.tipRequirement,
    tipConfig: relayStatus.tipConfig,
    checkedAt: relayStatus.checkedAt,
    statusCode: relayDetails.statusCode,
    contentType: relayDetails.contentType,
    responseSnippet: relayDetails.responseSnippet,
    error: relayStatus.error,
  };
  const response: ApiSuccessResponse<typeof result> = {
    ok: true,
    message: relayStatus.reachable
      ? "Walrus Mainnet upload relay tip configuration loaded."
      : "Walrus Mainnet upload relay status could not be confirmed.",
    data: result,
  };
  return NextResponse.json(response, { status: relayStatus.configured ? 200 : 503 });
}
