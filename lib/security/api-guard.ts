import "server-only";

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

type GuardProfile = "strict" | "standard" | "read";

interface ApiGuardOptions {
  profile?: GuardProfile;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const RATE_LIMITS: Record<GuardProfile, { max: number; windowMs: number }> = {
  strict: { max: 20, windowMs: 60_000 },
  standard: { max: 60, windowMs: 60_000 },
  read: { max: 120, windowMs: 60_000 },
};

const globalForApiGuard = globalThis as typeof globalThis & {
  agentBlackBoxApiRateBuckets?: Map<string, RateBucket>;
};

const buckets = globalForApiGuard.agentBlackBoxApiRateBuckets ?? new Map<string, RateBucket>();
globalForApiGuard.agentBlackBoxApiRateBuckets = buckets;

function isGuardEnabled() {
  return (
    process.env.DEMO_API_GUARD_ENABLED?.trim().toLowerCase() === "true" ||
    process.env.API_GUARD_ENABLED?.trim().toLowerCase() === "true"
  );
}

function protectedError(
  status: number,
  code: "UNAUTHORIZED" | "RATE_LIMITED",
  message = "This endpoint is protected.",
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function hasValidApiToken(request: Request) {
  const expected =
    process.env.DEMO_API_TOKEN?.trim() ||
    process.env.AGENT_BLACKBOX_API_TOKEN?.trim();
  if (!expected) return false;
  const supplied =
    request.headers.get("x-agent-blackbox-demo-token")?.trim() ||
    request.headers.get("x-agent-blackbox-api-token")?.trim();
  return Boolean(supplied && safeCompare(supplied, expected));
}

function isSameOriginBrowserRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin") return true;
  if (!host) return false;
  try {
    if (origin && new URL(origin).host === host) return true;
    const referer = request.headers.get("referer");
    return Boolean(referer && new URL(referer).host === host);
  } catch {
    return false;
  }
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "local"
  );
}

function rateLimitKey(request: Request, profile: GuardProfile) {
  const url = new URL(request.url);
  return `${profile}:${clientIp(request)}:${url.pathname}`;
}

function checkRateLimit(request: Request, profile: GuardProfile) {
  const limit = RATE_LIMITS[profile];
  const now = Date.now();
  const key = rateLimitKey(request, profile);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    return true;
  }
  existing.count += 1;
  return existing.count <= limit.max;
}

export function isApiRequestAuthorized(request: Request) {
  if (!isGuardEnabled()) return true;
  return hasValidApiToken(request) || isSameOriginBrowserRequest(request);
}

export function isApiGuardEnabled() {
  return isGuardEnabled();
}

export async function guardApiRequest(request: Request, options: ApiGuardOptions = {}) {
  if (!isGuardEnabled()) return null;
  if (!isApiRequestAuthorized(request)) {
    return protectedError(401, "UNAUTHORIZED");
  }
  const profile = options.profile ?? "strict";
  if (!checkRateLimit(request, profile)) {
    return protectedError(429, "RATE_LIMITED", "Too many requests. Please try again shortly.");
  }
  return null;
}
