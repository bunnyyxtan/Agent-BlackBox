import "server-only";

export const BODY_SIZE_LIMITS = {
  normalJson: 256 * 1024,
  agentJson: 1024 * 1024,
  storageJson: 512 * 1024,
} as const;

export class SafeRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly code = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "SafeRequestError";
  }
}

function parseContentLength(request: Request) {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function readJsonRequest<T>(
  request: Request,
  options: { maxBytes?: number; required?: boolean } = {},
): Promise<T> {
  const maxBytes = options.maxBytes ?? BODY_SIZE_LIMITS.normalJson;
  const contentLength = parseContentLength(request);
  if (contentLength !== null && contentLength > maxBytes) {
    throw new SafeRequestError("Request body is too large.", 413, "REQUEST_TOO_LARGE");
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > maxBytes) {
    throw new SafeRequestError("Request body is too large.", 413, "REQUEST_TOO_LARGE");
  }
  if (body.byteLength === 0) {
    if (options.required === false) return {} as T;
    throw new SafeRequestError("A JSON request body is required.", 400, "INVALID_JSON");
  }

  const text = new TextDecoder().decode(body);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SafeRequestError("Request body must be valid JSON.", 400, "INVALID_JSON");
  }
}

export function safeRequestErrorPayload(error: SafeRequestError) {
  return apiErrorPayload(error.code, error.message);
}

export function apiErrorPayload(code: string, message: string, details?: string) {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10_000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function readResponseTextWithLimit(response: Response, maxBytes = 1024 * 1024) {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new SafeRequestError("Provider response is too large.", 502, "RESPONSE_TOO_LARGE");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}
