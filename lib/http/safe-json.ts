export interface SafeJsonResponseErrorOptions {
  endpoint: string;
  status: number;
  statusText: string;
  contentType: string;
  snippet: string;
  reason: "invalid_content_type" | "invalid_json";
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
      `Invalid response from ${options.endpoint}. Status: ${options.status} ${options.statusText}. Content-Type: ${
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

export async function readJsonResponse<T>(response: Response, endpoint: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
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
