import "server-only";

export interface SafeProviderJson<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  message?: string;
}

export async function fetchProviderJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<SafeProviderJson<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return {
        ok: false,
        status: response.status,
        data: null,
        message: `Provider returned ${contentType || "non-JSON"} content.`,
      };
    }
    try {
      return {
        ok: response.ok,
        status: response.status,
        data: JSON.parse(text) as T,
        message: response.ok ? undefined : `Provider returned HTTP ${response.status}.`,
      };
    } catch {
      return {
        ok: false,
        status: response.status,
        data: null,
        message: "Provider returned invalid JSON.",
      };
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      message: error instanceof Error ? error.message : "Provider request failed.",
    };
  }
}
