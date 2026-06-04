export interface SafeJsonResponseErrorOptions {
  endpoint: string;
  status: number;
  statusText: string;
  contentType: string;
  snippet: string;
  reason: "invalid_content_type" | "invalid_json" | "response_too_large";
}

export class SafeJsonResponseError extends Error {
  code = "invalid_endpoint_response";
  endpoint: string;
  status: number;
  statusText: string;
  contentType: string;
  snippet: string;
  reason: SafeJsonResponseErrorOptions["reason"];

  constructor(options: SafeJsonResponseErrorOptions) {
    super(
      options.reason === "response_too_large"
        ? `Response from ${options.endpoint} exceeded the safe JSON size limit.`
        : `Invalid response from ${options.endpoint}. Status: ${options.status} ${options.statusText}. Content-Type: ${
            options.contentType || "not reported"
          }.`,
    );
    this.name = "SafeJsonResponseError";
    this.endpoint = options.endpoint;
    this.status = options.status;
    this.statusText = options.statusText;
    this.contentType = options.contentType;
    this.snippet = options.snippet;
    this.reason = options.reason;
  }
}

function isJsonContentType(contentType: string) {
  const normalized = contentType.toLowerCase();
  return normalized.includes("application/json") || normalized.includes("+json");
}

function firstSnippet(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

async function readResponseTextWithLimit(response: Response, endpoint: string, maxBytes = 512 * 1024) {
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
      throw new SafeJsonResponseError({
        endpoint,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type") ?? "",
        snippet: "",
        reason: "response_too_large",
      });
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

export async function readJsonResponse<T>(
  response: Response,
  endpoint: string,
  options: { maxBytes?: number } = {},
): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await readResponseTextWithLimit(response, endpoint, options.maxBytes);
  const snippet = firstSnippet(text);

  if (!isJsonContentType(contentType)) {
    throw new SafeJsonResponseError({
      endpoint,
      status: response.status,
      statusText: response.statusText,
      contentType,
      snippet,
      reason: "invalid_content_type",
    });
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SafeJsonResponseError({
      endpoint,
      status: response.status,
      statusText: response.statusText,
      contentType,
      snippet,
      reason: "invalid_json",
    });
  }
}
