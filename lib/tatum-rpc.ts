import "server-only";

import {
  isValidSuiAddress,
  isValidSuiObjectId,
  isValidTransactionDigest,
  normalizeSuiAddress,
} from "@/lib/sui-client-helpers";

import { readResponseTextWithLimit } from "@/lib/http/safe-request";
import { getNetworkConfig } from "@/lib/network-config";
import type {
  ExpectedProofFields,
  ProofFieldComparisons,
  ProofMetadata,
  TatumRpcVerification,
} from "@/types/blackbox";

export const ALLOWED_TATUM_SUI_RPC_METHODS = [
  "sui_getObject",
  "sui_getTransactionBlock",
  "suix_queryEvents",
] as const;

export type AllowedTatumSuiRpcMethod = (typeof ALLOWED_TATUM_SUI_RPC_METHODS)[number];

export interface TatumRpcError {
  code: number | string | null;
  message: string;
  data?: unknown;
}

export interface TatumRpcCallResult<T = unknown> {
  configured: boolean;
  method: AllowedTatumSuiRpcMethod;
  result: T | null;
  error: TatumRpcError | null;
  status: "not_configured" | "success" | "failed";
  message: string;
}

interface InternalTatumSuiRpcConfig {
  apiKey: string;
  rpcUrl: string;
  configured: boolean;
  apiKeyConfigured: boolean;
  rpcUrlConfigured: boolean;
  rpcHost: string;
  network: ReturnType<typeof getNetworkConfig>["network"];
  rpcNetworkMismatch: boolean;
}

const TATUM_RPC_TIMEOUT_MS = 8_000;

function parseTatumRpcPayload<T>(text: string) {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as { result?: T; error?: TatumRpcError } | null;
  } catch {
    throw new Error("Tatum Sui RPC returned an invalid JSON response.");
  }
}

function getRpcHost(rpcUrl: string) {
  if (!rpcUrl) return "Not configured";
  try {
    return new URL(rpcUrl).host;
  } catch {
    return "Invalid URL";
  }
}

function getInternalTatumSuiRpcConfig(): InternalTatumSuiRpcConfig {
  const apiKey = process.env.TATUM_API_KEY?.trim() ?? "";
  const networkConfig = getNetworkConfig(process.env.SUI_NETWORK);
  const rpcUrl = process.env.TATUM_SUI_RPC_URL?.trim() || networkConfig.tatumRpcUrl;
  const apiKeyConfigured = Boolean(apiKey);
  const rpcUrlConfigured = Boolean(rpcUrl);
  return {
    apiKey,
    rpcUrl,
    configured: apiKeyConfigured && rpcUrlConfigured && !networkConfig.rpcNetworkMismatch,
    apiKeyConfigured,
    rpcUrlConfigured,
    rpcHost: getRpcHost(rpcUrl),
    network: networkConfig.network,
    rpcNetworkMismatch: networkConfig.rpcNetworkMismatch,
  };
}

export function getTatumSuiRpcConfig() {
  const { apiKey: _apiKey, rpcUrl: _rpcUrl, ...safeConfig } =
    getInternalTatumSuiRpcConfig();
  return safeConfig;
}

export async function checkTatumSuiRpcReachability() {
  const config = getInternalTatumSuiRpcConfig();
  const checkedAt = new Date().toISOString();
  if (!config.configured) {
    return {
      configured: config.configured,
      reachable: false,
      checkedAt,
      message: config.rpcNetworkMismatch
        ? "Tatum RPC network does not match the configured Sui network."
        : "Tatum RPC is not configured.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TATUM_RPC_TIMEOUT_MS);
  try {
    const response = await fetch(config.rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getLatestCheckpointSequenceNumber",
        params: [],
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await readResponseTextWithLimit(response, 512 * 1024);
    const payload = parseTatumRpcPayload<unknown>(text);
    if (!response.ok || payload?.error) {
      return {
        configured: true,
        reachable: false,
        checkedAt,
        message: payload?.error?.message ?? `Tatum RPC returned HTTP ${response.status}.`,
      };
    }
    return {
      configured: true,
      reachable: payload?.result !== undefined,
      checkedAt,
      message: payload?.result !== undefined ? "Tatum RPC is reachable." : "Tatum RPC response did not include checkpoint data.",
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      checkedAt,
      message:
        error instanceof DOMException && error.name === "AbortError"
          ? "Tatum RPC reachability check timed out."
          : error instanceof Error
            ? error.message
            : "Tatum RPC reachability check failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function isAllowedTatumSuiRpcMethod(
  method: string,
): method is AllowedTatumSuiRpcMethod {
  return ALLOWED_TATUM_SUI_RPC_METHODS.includes(method as AllowedTatumSuiRpcMethod);
}

function normalizeRpcError(error: unknown): TatumRpcError {
  if (error instanceof Error) {
    return { code: null, message: error.message };
  }
  return { code: null, message: "Tatum Sui RPC request failed." };
}

export async function callTatumSuiRpc<T = unknown>(
  method: AllowedTatumSuiRpcMethod,
  params: unknown[],
): Promise<TatumRpcCallResult<T>> {
  const config = getInternalTatumSuiRpcConfig();
  if (!config.configured) {
    return {
      configured: false,
      method,
      result: null,
      error: null,
      status: "not_configured",
      message: config.rpcNetworkMismatch
        ? "Tatum Sui RPC network does not match the configured Sui network."
        : "Tatum Sui RPC is not configured",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TATUM_RPC_TIMEOUT_MS);
  try {
    const response = await fetch(config.rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await readResponseTextWithLimit(response, 512 * 1024);
    const payload = parseTatumRpcPayload<T>(text);

    if (!response.ok) {
      return {
        configured: true,
        method,
        result: null,
        error: payload?.error ?? {
          code: response.status,
          message: `Tatum Sui RPC returned HTTP ${response.status}.`,
        },
        status: "failed",
        message: "Tatum Sui RPC request failed.",
      };
    }
    if (payload?.error) {
      return {
        configured: true,
        method,
        result: null,
        error: payload.error,
        status: "failed",
        message: payload.error.message,
      };
    }

    return {
      configured: true,
      method,
      result: payload?.result ?? null,
      error: null,
      status: "success",
      message: "Tatum Sui RPC request completed.",
    };
  } catch (error) {
    const normalizedError =
      error instanceof DOMException && error.name === "AbortError"
        ? { code: "timeout", message: "Tatum Sui RPC request timed out." }
        : normalizeRpcError(error);
    return {
      configured: true,
      method,
      result: null,
      error: normalizedError,
      status: "failed",
      message: normalizedError.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSuiObject(objectId: string) {
  return callTatumSuiRpc("sui_getObject", [
    objectId,
    { showType: true, showOwner: true, showContent: true },
  ]);
}

export async function getTransactionBlock(digest: string) {
  return callTatumSuiRpc("sui_getTransactionBlock", [
    digest,
    { showInput: true, showEffects: true, showEvents: true },
  ]);
}

export async function queryEvents(
  query: Record<string, unknown>,
  cursor: string | null = null,
  limit = 50,
  descendingOrder = true,
) {
  return callTatumSuiRpc("suix_queryEvents", [query, cursor, limit, descendingOrder]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMoveFields(result: unknown) {
  if (!isRecord(result) || !isRecord(result.data)) return null;
  const content = result.data.content;
  if (!isRecord(content) || !isRecord(content.fields)) return null;
  return content.fields;
}

function readEventFields(result: unknown, eventType: string) {
  if (!isRecord(result) || !Array.isArray(result.data)) return null;
  for (const event of result.data) {
    if (
      isRecord(event) &&
      event.type === eventType &&
      isRecord(event.parsedJson)
    ) {
      return event.parsedJson;
    }
  }
  return null;
}

function readStringField(fields: Record<string, unknown> | null, names: string[]) {
  if (!fields) return null;
  for (const name of names) {
    const value = fields[name];
    if (typeof value === "string") return value;
  }
  return null;
}

function compareField(actual: string | null, expected: string) {
  return actual === null ? null : actual === expected;
}

function compareAddressField(actual: string | null, expected: string) {
  if (actual === null) return null;
  if (isValidSuiAddress(actual) && isValidSuiAddress(expected)) {
    return normalizeSuiAddress(actual) === normalizeSuiAddress(expected);
  }
  return actual === expected;
}

function compareProofFields(
  fields: Record<string, unknown> | null,
  expected: ExpectedProofFields,
): ProofFieldComparisons {
  return {
    sessionId: compareField(readStringField(fields, ["session_id", "sessionId"]), expected.sessionId),
    owner: compareAddressField(readStringField(fields, ["owner"]), expected.owner),
    traceHash: compareField(readStringField(fields, ["trace_hash", "traceHash"]), expected.traceHash),
    resultHash: compareField(readStringField(fields, ["result_hash", "resultHash"]), expected.resultHash),
    inputHash: compareField(readStringField(fields, ["input_hash", "inputHash"]), expected.inputHash),
    blobId: compareField(
      readStringField(fields, ["walrus_blob_id", "walrusBlobId", "blob_id", "blobId"]),
      expected.blobId,
    ),
    storageNetwork: compareField(
      readStringField(fields, ["storage_network", "storageNetwork"]),
      expected.storageNetwork,
    ),
  };
}

function getMismatchReasons(
  comparisons: ProofFieldComparisons | undefined,
  source: string,
) {
  if (!comparisons) return [];
  const labels: Record<keyof ProofFieldComparisons, string> = {
    sessionId: "session ID",
    owner: "owner",
    traceHash: "trace hash",
    resultHash: "result hash",
    inputHash: "input hash",
    blobId: "Walrus Blob ID",
    storageNetwork: "storage network",
  };
  return (Object.entries(comparisons) as Array<
    [keyof ProofFieldComparisons, boolean | null]
  >).flatMap(([field, matched]) => {
    if (matched === true) return [];
    return [
      matched === null
        ? `${source} is missing ${labels[field]}.`
        : `${source} ${labels[field]} does not match the sealed session.`,
    ];
  });
}

function hasResultData(result: unknown) {
  return isRecord(result) && result.data !== null && result.data !== undefined;
}

function readObjectType(result: unknown) {
  if (!isRecord(result) || !isRecord(result.data)) return null;
  return typeof result.data.type === "string" ? result.data.type : null;
}

function objectTypeMatchesPackage(result: unknown, packageId: string) {
  const type = readObjectType(result);
  if (!type || !isValidSuiObjectId(packageId)) return null;
  return type.startsWith(`${packageId}::`);
}

function transactionMentionsMoveTarget(
  result: unknown,
  proofMetadata: Pick<ProofMetadata, "packageId" | "moduleName" | "createFunction">,
) {
  if (!isValidSuiObjectId(proofMetadata.packageId)) return null;
  if (!proofMetadata.moduleName || !proofMetadata.createFunction) return null;
  const serialized = JSON.stringify(result);
  return (
    serialized.includes(proofMetadata.packageId) &&
    serialized.includes(proofMetadata.moduleName) &&
    serialized.includes(proofMetadata.createFunction)
  );
}

export function buildLocalPhase1TatumRpcVerification(): TatumRpcVerification {
  const checkedAt = new Date().toISOString();
  return {
    status: "local_phase1",
    configured: getTatumSuiRpcConfig().configured,
    onchain: false,
    checkedAt,
    objectFound: null,
    transactionFound: null,
    eventFound: null,
    message:
      "This session has local proof metadata. On-chain proof is not anchored yet.",
  };
}

export async function verifyProofMetadata(
  proofMetadata: Pick<
    ProofMetadata,
    "suiObjectId" | "transactionDigest" | "packageId" | "moduleName" | "createFunction" | "eventType"
  >,
  expectedFields: ExpectedProofFields,
): Promise<TatumRpcVerification> {
  if (!isValidTransactionDigest(proofMetadata.transactionDigest)) {
    return buildLocalPhase1TatumRpcVerification();
  }

  const config = getTatumSuiRpcConfig();
  const checkedAt = new Date().toISOString();
  if (!config.configured) {
    return {
      status: "not_configured",
      configured: false,
      onchain: true,
      checkedAt,
      objectFound: null,
      transactionFound: null,
      eventFound: null,
      message:
        "Tatum Sui RPC is not configured. Add TATUM_API_KEY and TATUM_SUI_RPC_URL to verify the proof anchor.",
    };
  }
  const transactionPromise = getTransactionBlock(proofMetadata.transactionDigest);
  const eventPromise = proofMetadata.eventType
    ? queryEvents({ Transaction: proofMetadata.transactionDigest })
    : Promise.resolve(null);
  if (!isValidSuiObjectId(proofMetadata.suiObjectId)) {
    const [transactionResult, eventResult] = await Promise.all([
      transactionPromise,
      eventPromise,
    ]);
    const transactionFound =
      transactionResult.status === "success" && transactionResult.result !== null;
    const transactionTargetMatched = transactionFound
      ? transactionMentionsMoveTarget(transactionResult.result, proofMetadata)
      : null;
    const eventFields =
      eventResult !== null && proofMetadata.eventType
        ? readEventFields(eventResult.result, proofMetadata.eventType)
        : null;
    const eventFound =
      eventResult === null
        ? null
        : eventResult.status === "success" && eventFields !== null;
    const eventFieldComparisons =
      eventFields !== null ? compareProofFields(eventFields, expectedFields) : undefined;
    const eventFieldsMatched =
      eventFieldComparisons !== undefined &&
      Object.values(eventFieldComparisons).every((value) => value === true);
    const eventVerified = Boolean(
      proofMetadata.eventType &&
      eventFound === true &&
      eventFieldsMatched &&
      transactionTargetMatched !== false,
    );
    const mismatchReasons = [
      ...(transactionFound ? [] : ["Tatum RPC could not find the proof-anchor transaction."]),
      ...(transactionTargetMatched === false
        ? ["The transaction does not appear to call the configured proof package/module/function."]
        : []),
      ...(proofMetadata.eventType && eventFound !== true
        ? ["Tatum RPC could not find the AgentSessionProofCreated event."]
        : []),
      ...getMismatchReasons(eventFieldComparisons, "The creation event"),
    ];
    const error = transactionResult.error?.message ?? eventResult?.error?.message;
    return {
      status: eventVerified ? "passed" : transactionFound ? "transaction_found" : "failed",
      configured: true,
      onchain: true,
      checkedAt,
      objectFound: null,
      transactionFound,
      eventFound,
      ...(eventFieldComparisons ? { eventFieldComparisons } : {}),
      ...(mismatchReasons.length ? { mismatchReasons } : {}),
      message: eventVerified
        ? "Tatum Sui RPC confirmed the proof transaction and creation event fields."
        : transactionFound
          ? "Transaction found, but proof object/event verification is incomplete."
        : "Tatum Sui RPC could not confirm the recorded proof-anchor transaction.",
      ...(error ? { error } : {}),
    };
  }

  const [objectResult, transactionResult, eventResult] = await Promise.all([
    getSuiObject(proofMetadata.suiObjectId),
    transactionPromise,
    eventPromise,
  ]);
  const objectFound = objectResult.status === "success" && hasResultData(objectResult.result);
  const objectPackageMatched = objectFound
    ? objectTypeMatchesPackage(objectResult.result, proofMetadata.packageId)
    : null;
  const transactionFound =
    transactionResult.status === "success" && transactionResult.result !== null;
  const transactionTargetMatched = transactionFound
    ? transactionMentionsMoveTarget(transactionResult.result, proofMetadata)
    : null;
  const eventFound =
    eventResult === null
      ? null
      : eventResult.status === "success" &&
        readEventFields(eventResult.result, proofMetadata.eventType!) !== null;
  const fieldComparisons = compareProofFields(
    objectFound ? readMoveFields(objectResult.result) : null,
    expectedFields,
  );
  const eventFieldComparisons =
    eventResult !== null && proofMetadata.eventType
      ? compareProofFields(
          readEventFields(eventResult.result, proofMetadata.eventType),
          expectedFields,
        )
      : undefined;
  const fieldsMatched = Object.values(fieldComparisons).every((value) => value === true);
  const eventFieldsMatched =
    eventFieldComparisons === undefined ||
    Object.values(eventFieldComparisons).every((value) => value === true);
  const passed =
    objectFound &&
    objectPackageMatched !== false &&
    transactionFound &&
    transactionTargetMatched !== false &&
    fieldsMatched &&
    (proofMetadata.eventType ? eventFound === true && eventFieldsMatched : true);
  const error = objectResult.error?.message ?? transactionResult.error?.message ?? eventResult?.error?.message;
  const mismatchReasons = [
    ...(objectFound ? [] : ["Tatum RPC could not find the Sui proof object."]),
    ...(objectPackageMatched === false
      ? ["The Sui proof object package does not match the configured package ID."]
      : []),
    ...(transactionFound ? [] : ["Tatum RPC could not find the proof-anchor transaction."]),
    ...(transactionTargetMatched === false
      ? ["The transaction does not appear to call the configured proof package/module/function."]
      : []),
    ...(proofMetadata.eventType && eventFound !== true
      ? ["Tatum RPC could not find the AgentSessionProofCreated event."]
      : []),
    ...getMismatchReasons(fieldComparisons, "The Sui proof object"),
    ...getMismatchReasons(eventFieldComparisons, "The creation event"),
  ];

  return {
    status: passed ? "passed" : "failed",
    configured: true,
    onchain: true,
    checkedAt,
    objectFound,
    transactionFound,
    eventFound,
    fieldComparisons,
    ...(eventFieldComparisons ? { eventFieldComparisons } : {}),
    ...(mismatchReasons.length ? { mismatchReasons } : {}),
    message: passed
      ? "Tatum Sui RPC confirmed the proof object, transaction, and anchored evidence fields."
      : "Tatum Sui RPC could not confirm the complete on-chain proof metadata.",
    ...(error ? { error } : {}),
  };
}
