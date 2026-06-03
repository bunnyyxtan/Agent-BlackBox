import "server-only";

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { abortAfterTimeout } from "@modelcontextprotocol/sdk/utils.js";

import { createHashFromString, stableStringify } from "@/lib/hash";
import type { OnchainMcpStatusSnapshot, OnchainMcpToolEvidence } from "@/lib/onchain/types";

const require = createRequire(import.meta.url);

const PROVIDER = "Tatum Blockchain MCP" as const;
const TOOL_PROVIDER = "Tatum MCP" as const;
const DEFAULT_PACKAGE = "@tatumio/blockchain-mcp" as const;
const DEFAULT_SERVER_NAME = "tatumio";
const TOOL_TIMEOUT_MS = 25_000;
const DEFAULT_MCP_COMMAND = "npx";

let lastTatumMcpRuntimeError: string | undefined;
let lastDiscoveredTatumMcpTools: string[] | undefined;
let preferLocalEntrypointFallback = false;

export type TatumMcpToolName =
  | "get_wallet_portfolio"
  | "get_transaction_history"
  | "check_malicious_address"
  | "check_malicous_address"
  | "get_tokens"
  | "get_exchange_rate"
  | "gateway_get_supported_chains"
  | "gateway_get_supported_methods"
  | "gateway_execute_rpc";

const MALICIOUS_ADDRESS_TOOL_NAMES = ["check_malicous_address", "check_malicious_address"] as const;
export const KNOWN_TATUM_MCP_TOOL_NAMES = [
  "get_wallet_portfolio",
  "get_transaction_history",
  ...MALICIOUS_ADDRESS_TOOL_NAMES,
  "get_tokens",
  "get_exchange_rate",
  "gateway_get_supported_chains",
  "gateway_get_supported_methods",
  "gateway_execute_rpc",
] satisfies TatumMcpToolName[];

interface TatumMcpConfig {
  enabled: boolean;
  apiKey: string;
  apiKeyPresent: boolean;
  command: string;
  spawnCommand: string;
  spawnArgs: string[];
  packageName: "@tatumio/blockchain-mcp";
  serverName: string;
  fallbackSpawnCommand?: string;
  fallbackSpawnArgs?: string[];
}

interface RunMcpToolCallParams {
  toolName: TatumMcpToolName;
  network?: string;
  target?: string;
  args?: Record<string, unknown>;
  sessionId?: string;
}

interface TatumMcpToolDiscovery {
  availableTools: string[];
  checkedAt: string;
  error?: {
    code: string;
    message: string;
    status?: string;
    details?: string;
  };
}

function getTatumMcpConfig(): TatumMcpConfig {
  const command = process.env.TATUM_MCP_COMMAND?.trim() || DEFAULT_MCP_COMMAND;
  const packageName = (process.env.TATUM_MCP_PACKAGE?.trim() || DEFAULT_PACKAGE) as "@tatumio/blockchain-mcp";
  const enabledSetting = process.env.TATUM_MCP_ENABLED?.trim().toLowerCase();
  const usesNpx = /^(npx|npx\.cmd)$/i.test(command);
  const packageEntrypoint = getPackageEntrypoint(packageName);
  return {
    enabled: enabledSetting === "true",
    apiKey: process.env.TATUM_API_KEY?.trim() ?? "",
    apiKeyPresent: Boolean(process.env.TATUM_API_KEY?.trim()),
    command,
    spawnCommand: process.platform === "win32" && usesNpx ? "cmd.exe" : command,
    spawnArgs: process.platform === "win32" && usesNpx ? ["/d", "/s", "/c", "npx", packageName] : [packageName],
    packageName,
    serverName: process.env.TATUM_MCP_SERVER_NAME?.trim() || DEFAULT_SERVER_NAME,
    ...(packageEntrypoint
      ? {
          fallbackSpawnCommand: process.execPath,
          fallbackSpawnArgs: buildLocalEntrypointArgs(packageEntrypoint),
        }
      : {}),
  };
}

function getPackageEntrypoint(packageName: string) {
  if (packageName !== DEFAULT_PACKAGE) return null;
  try {
    return require.resolve("@tatumio/blockchain-mcp");
  } catch {
    return null;
  }
}

function packageAvailable(packageName: string) {
  return Boolean(getPackageEntrypoint(packageName));
}

function buildLocalEntrypointArgs(entrypoint: string) {
  const moduleUrl = pathToFileURL(entrypoint).href;
  const argvPath = moduleUrl.startsWith("file://") ? moduleUrl.slice("file://".length) : entrypoint;
  const bootstrap = `process.argv[1]=${JSON.stringify(argvPath)};await import(${JSON.stringify(moduleUrl)});`;
  return ["--input-type=module", "--eval", bootstrap];
}

function recordTatumMcpRuntimeError(details?: string) {
  if (details) lastTatumMcpRuntimeError = sanitizeDetail(details);
}

function sanitizeDetail(value: unknown) {
  const text = value instanceof Error ? value.message : typeof value === "string" ? value : "Unknown MCP error.";
  return text
    .replace(/t-[a-z0-9-]+/gi, "[redacted]")
    .replace(/TATUM_API_KEY\s*=\s*[^,\s)]+/gi, "TATUM_API_KEY=[redacted]")
    .slice(0, 280);
}

function createStatusSnapshot(
  status: OnchainMcpStatusSnapshot["status"],
  message: string,
  details?: string,
): OnchainMcpStatusSnapshot {
  const config = getTatumMcpConfig();
  return {
    enabled: config.enabled,
    configured: config.enabled && config.apiKeyPresent && status === "configured",
    status,
    provider: PROVIDER,
    packageName: DEFAULT_PACKAGE,
    command: config.command,
    serverName: config.serverName,
    apiKeyPresent: config.apiKeyPresent,
    nodeVersion: process.version,
    checkedAt: new Date().toISOString(),
    message,
    ...(lastDiscoveredTatumMcpTools ? { availableTools: lastDiscoveredTatumMcpTools } : {}),
    ...(details || lastTatumMcpRuntimeError ? { details: details ?? lastTatumMcpRuntimeError } : {}),
  };
}

function summarizeToolResult(toolName: string, result: unknown) {
  const text = extractTextContent(result);
  if (!text) return `${toolName} completed through Tatum MCP.`;
  const parsed = parseJsonMaybe(text);
  if (isRecord(parsed)) {
    if (parsed.success === false) {
      const error = typeof parsed.error === "string" ? parsed.error : "Tatum MCP returned an unsuccessful response.";
      return `${toolName} returned an unsuccessful response: ${error.slice(0, 180)}`;
    }
    const data = typeof parsed.data === "string" ? parseJsonMaybe(parsed.data) : parsed.data;
    const count = countRecords(data);
    if (count !== null) return `${toolName} returned ${count} record(s) through Tatum MCP.`;
    return `${toolName} returned structured blockchain data through Tatum MCP.`;
  }
  return `${toolName} completed through Tatum MCP.`;
}

function getStatusFromResult(value: unknown) {
  if (!isRecord(value)) return undefined;
  const status = value.status;
  return typeof status === "number" || typeof status === "string" ? String(status) : undefined;
}

function getToolFailureFromResult(result: unknown, toolName: string) {
  const text = extractTextContent(result);
  if (!text) return null;
  const parsed = parseJsonMaybe(text);
  if (!isRecord(parsed) || parsed.success !== false) return null;
  const rawMessage =
    typeof parsed.error === "string"
      ? parsed.error
      : typeof parsed.message === "string"
        ? parsed.message
        : "Tatum MCP returned an unsuccessful response.";
  const message = sanitizeDetail(rawMessage);
  const lowerMessage = message.toLowerCase();
  const toolNotFound = isToolNotFoundMessage(lowerMessage);
  const code = toolNotFound
    ? "TATUM_MCP_TOOL_NOT_FOUND"
    : lowerMessage.includes("gateway url not found") || lowerMessage.includes("unsupported")
      ? "TATUM_MCP_UNSUPPORTED_CHAIN"
      : "TATUM_MCP_TOOL_FAILED";
  return {
    code,
    message: toolNotFound ? `Tatum MCP tool not found: ${toolName}` : message,
    status: getStatusFromResult(parsed),
    details: toolNotFound ? `MCP response: ${message}` : `MCP response: ${message}`,
  };
}

function isToolNotFoundMessage(value: string) {
  return /tool.*not found|not found.*tool|unknown tool|method not found|no such tool|tool does not exist/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonMaybe(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function extractTextContent(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.content)) return "";
  return value.content
    .map((item) => (isRecord(item) && typeof item.text === "string" ? item.text : ""))
    .filter(Boolean)
    .join("\n")
    .slice(0, 10_000);
}

function buildMcpProcessEnv(apiKey: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key && !key.startsWith("=") && typeof value === "string") env[key] = value;
  }
  env.TATUM_API_KEY = apiKey;
  return env;
}

function countRecords(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (!isRecord(value)) return null;
  if (Array.isArray(value.data)) return value.data.length;
  if (Array.isArray(value.transactions)) return value.transactions.length;
  if (Array.isArray(value.result)) return value.result.length;
  if (Array.isArray(value.items)) return value.items.length;
  return null;
}

function getSafeErrorMessage(status: OnchainMcpStatusSnapshot["status"]) {
  if (status === "disabled") return "Tatum MCP tools are disabled. EVM analysis will run as a preliminary report.";
  if (status === "missing_api_key") return "Tatum MCP is enabled, but no Tatum API key is configured.";
  if (status === "package_unavailable") {
    return "Tatum MCP package or runtime is unavailable. EVM analysis will run as a preliminary report.";
  }
  if (status === "runtime_unavailable") return "Tatum MCP runtime is unavailable. EVM analysis is preliminary.";
  return "Tatum MCP tools are configured for EVM and multichain analysis.";
}

function createSafeRuntimeError(
  error: unknown,
  toolName: string,
  network?: string,
  target?: string,
) {
  const details = sanitizeDetail(error);
  const lowerDetails = details.toLowerCase();
  const timedOut = lowerDetails.includes("timed out") || lowerDetails.includes("abort");
  const unsupported = lowerDetails.includes("unsupported") || lowerDetails.includes("gateway url not found");
  const toolNotFound = isToolNotFoundMessage(details);
  const status = timedOut ? "timeout" : unsupported ? "unsupported_chain" : toolNotFound ? "tool_not_found" : "tool_failed";
  const code = timedOut
    ? "TATUM_MCP_TIMEOUT"
    : unsupported
      ? "TATUM_MCP_UNSUPPORTED_CHAIN"
      : toolNotFound
        ? "TATUM_MCP_TOOL_NOT_FOUND"
      : "TATUM_MCP_TOOL_FAILED";
  const message = timedOut
    ? `${toolName} timed out through Tatum MCP.`
    : unsupported
      ? `${toolName} is unsupported for ${network ?? "the selected network"} through Tatum MCP.`
      : toolNotFound
        ? `Tatum MCP tool not found: ${toolName}`
      : `${toolName} could not complete through Tatum MCP.`;
  const safeContext = [
    `tool=${toolName}`,
    network ? `network=${network}` : "",
    target ? `target=${target}` : "",
    `status=${status}`,
    `cause=${details}`,
  ].filter(Boolean).join(" | ");

  return { code, message, status, details: safeContext };
}

function normalizeToolNames(availableTools: readonly string[]) {
  return new Set(availableTools.map((toolName) => toolName.trim()).filter(Boolean));
}

export function resolveTatumMcpToolName(
  preferredName: TatumMcpToolName,
  availableTools: readonly string[],
): TatumMcpToolName | undefined {
  const available = normalizeToolNames(availableTools);
  if (MALICIOUS_ADDRESS_TOOL_NAMES.includes(preferredName as (typeof MALICIOUS_ADDRESS_TOOL_NAMES)[number])) {
    if (available.has("check_malicous_address")) return "check_malicous_address";
    if (available.has("check_malicious_address")) return "check_malicious_address";
    return undefined;
  }
  if (available.has(preferredName)) return preferredName;
  return undefined;
}

function sanitizeToolName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 96);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function withTatumMcpClient<T>(timeoutMs: number, callback: (client: Client) => Promise<T>): Promise<T> {
  const config = getTatumMcpConfig();
  if (preferLocalEntrypointFallback && config.fallbackSpawnCommand && config.fallbackSpawnArgs) {
    return runWithTatumMcpClient(
      config.fallbackSpawnCommand,
      config.fallbackSpawnArgs,
      config.apiKey,
      timeoutMs,
      callback,
    );
  }
  try {
    return await runWithTatumMcpClient(
      config.spawnCommand,
      config.spawnArgs,
      config.apiKey,
      timeoutMs,
      callback,
    );
  } catch (error) {
    if (!config.fallbackSpawnCommand || !config.fallbackSpawnArgs || !isMcpStartupError(error)) throw error;
    preferLocalEntrypointFallback = true;
    recordTatumMcpRuntimeError(
      `Primary MCP command failed; using local package entrypoint fallback. Cause: ${sanitizeDetail(error)}`,
    );
    return runWithTatumMcpClient(
      config.fallbackSpawnCommand,
      config.fallbackSpawnArgs,
      config.apiKey,
      timeoutMs,
      callback,
    );
  }
}

function isMcpStartupError(error: unknown) {
  const message = sanitizeDetail(error).toLowerCase();
  return (
    message.includes("connection closed") ||
    message.includes("spawn einval") ||
    message.includes("spawn enoent") ||
    message.includes("failed to start") ||
    message.includes("tatum mcp connection timed out")
  );
}

async function runWithTatumMcpClient<T>(
  command: string,
  args: string[],
  apiKey: string,
  timeoutMs: number,
  callback: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client(
    { name: "agent-blackbox", version: "0.1.0" },
    { capabilities: {} },
  );
  const transport = new StdioClientTransport({
    command,
    args,
    env: buildMcpProcessEnv(apiKey),
    stderr: "ignore",
  });
  try {
    await withTimeout(client.connect(transport), timeoutMs, "Tatum MCP connection");
    return await callback(client);
  } finally {
    await transport.close().catch(() => undefined);
  }
}

export async function getTatumMcpStatus(): Promise<OnchainMcpStatusSnapshot> {
  const config = getTatumMcpConfig();
  if (!config.enabled) {
    return createStatusSnapshot(
      "disabled",
      "Tatum MCP tools are disabled. EVM analysis will run as a preliminary report.",
    );
  }
  if (!config.apiKeyPresent) {
    return createStatusSnapshot(
      "missing_api_key",
      "Tatum MCP is enabled, but no Tatum API key is configured.",
    );
  }
  if (!packageAvailable(config.packageName)) {
    return createStatusSnapshot(
      "package_unavailable",
      "Tatum MCP package or runtime is unavailable. EVM analysis will run as a preliminary report.",
    );
  }

  return createStatusSnapshot(
    "configured",
    "Tatum MCP tools are configured for EVM and multichain analysis. Runtime will be checked during the first EVM analysis.",
  );
}

export async function discoverTatumMcpTools(): Promise<TatumMcpToolDiscovery> {
  const checkedAt = new Date().toISOString();
  const status = await getTatumMcpStatus();
  if (status.status !== "configured") {
    return {
      availableTools: [],
      checkedAt,
      error: {
        code: "TATUM_MCP_UNAVAILABLE",
        message: getSafeErrorMessage(status.status),
        status: status.status,
        ...(status.details ? { details: status.details } : {}),
      },
    };
  }

  try {
    const availableTools = await withTatumMcpClient(TOOL_TIMEOUT_MS, async (client) => {
      const names: string[] = [];
      let cursor: string | undefined;
      do {
        const result = await client.listTools(
          cursor ? { cursor } : undefined,
          { signal: abortAfterTimeout(TOOL_TIMEOUT_MS) },
        );
        for (const tool of result.tools ?? []) {
          const name = sanitizeToolName(tool.name);
          if (name) names.push(name);
        }
        cursor = typeof result.nextCursor === "string" ? result.nextCursor : undefined;
      } while (cursor);
      return Array.from(new Set(names)).sort();
    });
    lastDiscoveredTatumMcpTools = availableTools;
    lastTatumMcpRuntimeError = undefined;
    return { availableTools, checkedAt };
  } catch (error) {
    const safeError = createSafeRuntimeError(error, "listTools");
    recordTatumMcpRuntimeError(safeError.details);
    return {
      availableTools: [],
      checkedAt,
      error: {
        code: safeError.code,
        message: "Tatum MCP tool discovery could not complete.",
        status: safeError.status,
        details: safeError.details,
      },
    };
  }
}

export async function runTatumMcpToolCall({
  toolName,
  network,
  target,
  args,
  sessionId,
}: RunMcpToolCallParams): Promise<OnchainMcpToolEvidence> {
  const startedAt = new Date().toISOString();
  const inputPayload = { provider: TOOL_PROVIDER, toolName, network, target, args, sessionId };
  const inputHash = createHashFromString(stableStringify(inputPayload));
  const config = getTatumMcpConfig();
  const status = await getTatumMcpStatus();

  if (status.status !== "configured") {
    const completedAt = new Date().toISOString();
    return {
      provider: TOOL_PROVIDER,
      packageName: DEFAULT_PACKAGE,
      toolName,
      ...(network ? { network } : {}),
      ...(target ? { target } : {}),
      status: "skipped",
      summary: getSafeErrorMessage(status.status),
      startedAt,
      completedAt,
      inputHash,
      resultUsedInReport: false,
      error: {
        code: "TATUM_MCP_UNAVAILABLE",
        message: getSafeErrorMessage(status.status),
        ...(status.details ? { details: status.details } : {}),
      },
    };
  }

  try {
    const result = await withTatumMcpClient(TOOL_TIMEOUT_MS, (client) =>
      client.callTool(
        {
          name: toolName,
          arguments: args ?? {},
        },
        undefined,
        { signal: abortAfterTimeout(TOOL_TIMEOUT_MS) },
      ),
    );
    const completedAt = new Date().toISOString();
    const outputText = extractTextContent(result);
    const outputHash = outputText ? createHashFromString(outputText) : undefined;
    const toolFailure = getToolFailureFromResult(result, toolName);
    if (toolFailure) {
      recordTatumMcpRuntimeError(toolFailure.details);
      return {
        provider: TOOL_PROVIDER,
        packageName: config.packageName,
        toolName,
        ...(network ? { network } : {}),
        ...(target ? { target } : {}),
        status: "failed",
        summary: `${toolName} returned no usable live data through Tatum MCP.`,
        startedAt,
        completedAt,
        inputHash,
        ...(outputHash ? { outputHash } : {}),
        resultUsedInReport: false,
        error: toolFailure,
      };
    }
    return {
      provider: TOOL_PROVIDER,
      packageName: config.packageName,
      toolName,
      ...(network ? { network } : {}),
      ...(target ? { target } : {}),
      status: "completed",
      summary: summarizeToolResult(toolName, result),
      startedAt,
      completedAt,
      inputHash,
      ...(outputHash ? { outputHash } : {}),
      resultUsedInReport: true,
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const safeError = createSafeRuntimeError(error, toolName, network, target);
    recordTatumMcpRuntimeError(safeError.details);
    return {
      provider: TOOL_PROVIDER,
      packageName: config.packageName,
      toolName,
      ...(network ? { network } : {}),
      ...(target ? { target } : {}),
      status: "failed",
      summary: safeError.message,
      startedAt,
      completedAt,
      inputHash,
      resultUsedInReport: false,
      error: {
        code: safeError.code,
        message: safeError.message,
        status: safeError.status,
        details: safeError.details,
      },
    };
  }
}
