import { NextResponse } from "next/server";

import { getUploadRelayTipConfig } from "@/lib/storage-adapters/walrus-sdk-relay";
import { getWalrusConfiguration } from "@/lib/walrus";
import type { PlaceholderApiResponse } from "@/types/blackbox";

export async function GET() {
  const walrus = getWalrusConfiguration();
  const relayStatus = await getUploadRelayTipConfig();
  const result = {
    configured: walrus.relayConfigured,
    relayReachable: relayStatus.reachable,
    network: walrus.network,
    relayUrl: walrus.relayUrl,
    aggregatorUrl: walrus.aggregatorUrl,
    tipRequirement: relayStatus.tipRequirement,
    tipConfig: relayStatus.tipConfig,
    checkedAt: relayStatus.checkedAt,
    error: relayStatus.error,
  };
  const response: PlaceholderApiResponse<typeof result> = {
    ok: true,
    phase: "phase-2e",
    message: relayStatus.reachable
      ? "Walrus Mainnet upload relay tip configuration loaded."
      : "Walrus Mainnet upload relay status could not be confirmed.",
    data: result,
  };
  return NextResponse.json(response, { status: relayStatus.configured ? 200 : 503 });
}
