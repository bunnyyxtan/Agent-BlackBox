import { NextResponse } from "next/server";

import { analyzeOnchainInput } from "@/lib/onchain/analyzer-router";
import type { OnchainAnalyzeRequest, OnchainAnalyzeResponse } from "@/lib/onchain/types";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRequest(value: unknown): OnchainAnalyzeRequest {
  if (!isRecord(value)) {
    throw new Error("Request body must be a JSON object.");
  }
  const title = safeString(value.title);
  const prompt = safeString(value.prompt);
  if (!title) throw new Error("title is required.");
  if (!prompt) throw new Error("prompt is required.");
  return {
    title,
    prompt,
    agentMode: safeString(value.agentMode),
    network: safeString(value.network) || undefined,
    target: safeString(value.target) || undefined,
    sessionId: safeString(value.sessionId) || undefined,
    evidence: value.evidence,
  };
}

export async function POST(request: Request) {
  try {
    const input = normalizeRequest(await request.json());
    const report = await analyzeOnchainInput(input);
    const response: OnchainAnalyzeResponse = {
      ok: true,
      report,
      detected: report.detected,
      dataSources: report.dataSources,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const response: OnchainAnalyzeResponse = {
      ok: false,
      error: {
        code: "onchain_analyze_failed",
        message: "Onchain analysis could not be completed.",
        details: error instanceof Error ? error.message : "Unknown analyzer error.",
      },
    };
    return NextResponse.json(response, { status: 400 });
  }
}
