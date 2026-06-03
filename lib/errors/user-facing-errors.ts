const FROST_PER_WAL = BigInt(1_000_000_000);

export interface UserFacingError {
  title: string;
  lines: string[];
  details?: string;
}

export type WalrusUploadErrorCode =
  | "wallet_not_connected"
  | "wallet_signer_unavailable"
  | "wrong_network"
  | "walrus_config_missing"
  | "relay_unavailable"
  | "invalid_trace_bundle"
  | "invalid_storage_policy"
  | "wallet_rejected"
  | "insufficient_wal"
  | "insufficient_sui"
  | "invalid_endpoint_response"
  | "upload_failed"
  | "blob_id_missing";

export interface WalrusUploadDiagnostics {
  failedStep: string;
  stepId?: string;
  routePath?: string;
  actionName: string;
  endpoint?: string;
  relayHost?: string;
  network?: string;
  expectedNetwork?: string;
  walletConnected: boolean;
  signerAvailable: boolean;
  walletApprovalRequested?: boolean;
  walletApprovalStage?: string;
  storageMode?: string;
  walletAddress?: string | null;
  statusCode?: number;
  contentType?: string;
  responseSnippet?: string;
  errorCode?: string;
  shortMessage?: string;
  sanitizedMessage?: string;
  failurePhase?: string;
  traceBundleExists: boolean;
  inputHashExists: boolean;
  resultHashExists: boolean;
  traceHashExists: boolean;
  walrusConfigExists: boolean;
  missingConfigKeys: string[];
  relayUrlConfigured?: boolean;
  aggregatorUrlConfigured?: boolean;
  storageEpochsValid?: boolean;
  balancePreflight: string;
  uploadJobIdReturned?: boolean;
  blobIdReturned?: boolean;
  blobIdRecorded: boolean;
  recommendation?: string;
}

export class WalrusUploadError extends Error {
  name = "WalrusUploadError";

  constructor(
    message: string,
    public readonly code: WalrusUploadErrorCode,
    public readonly diagnostics: WalrusUploadDiagnostics,
  ) {
    super(message);
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Unknown error.");
}

function isSafeJsonResponseError(error: unknown): error is {
  name?: string;
  endpoint?: string;
  status?: number;
  statusText?: string;
  contentType?: string;
  snippet?: string;
} {
  return typeof error === "object" && error !== null && (error as { name?: string }).name === "SafeJsonResponseError";
}

function isWalrusUploadError(error: unknown): error is WalrusUploadError {
  return typeof error === "object" && error !== null && (error as { name?: string }).name === "WalrusUploadError";
}

function yesNo(value: boolean) {
  return value ? "yes" : "no";
}

function optionalYesNo(value: boolean | undefined) {
  return typeof value === "boolean" ? yesNo(value) : "not reported";
}

function normalizeDiagnosticCode(value: string | undefined) {
  return value ? value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toUpperCase() : "NOT_REPORTED";
}

function formatWalrusDiagnostics(diagnostics: WalrusUploadDiagnostics) {
  return [
    `Failed step: ${diagnostics.failedStep}`,
    `Step ID: ${diagnostics.stepId || "storage_upload"}`,
    `Route/path: ${diagnostics.routePath || "wallet:walrus-sdk-relay"}`,
    `Endpoint/action: ${diagnostics.actionName}`,
    `Relay host: ${diagnostics.relayHost || "not reported"}`,
    `Network: ${diagnostics.network || "not reported"}`,
    `Expected network: ${diagnostics.expectedNetwork || "not reported"}`,
    `Storage mode: ${diagnostics.storageMode || "not reported"}`,
    `Storage epochs valid: ${optionalYesNo(diagnostics.storageEpochsValid)}`,
    `Wallet address: ${diagnostics.walletAddress || "not connected"}`,
    `Wallet connected: ${yesNo(diagnostics.walletConnected)}`,
    `Signer available: ${yesNo(diagnostics.signerAvailable)}`,
    `Wallet approval requested: ${optionalYesNo(diagnostics.walletApprovalRequested)}`,
    `Wallet approval stage: ${diagnostics.walletApprovalStage || "not reported"}`,
    `Failure phase: ${diagnostics.failurePhase || "not reported"}`,
    `Status: ${diagnostics.statusCode ?? "not reported"}`,
    `Content-Type: ${diagnostics.contentType || "not reported"}`,
    `Code: ${normalizeDiagnosticCode(diagnostics.errorCode)}`,
    `Message: ${diagnostics.sanitizedMessage || diagnostics.shortMessage || "not reported"}`,
    `Safe response snippet: ${diagnostics.responseSnippet || "not available"}`,
    `Trace bundle exists: ${yesNo(diagnostics.traceBundleExists)}`,
    `Input hash exists: ${yesNo(diagnostics.inputHashExists)}`,
    `Result hash exists: ${yesNo(diagnostics.resultHashExists)}`,
    `Trace hash exists: ${yesNo(diagnostics.traceHashExists)}`,
    `Walrus config exists: ${yesNo(diagnostics.walrusConfigExists)}`,
    `Relay URL configured: ${optionalYesNo(diagnostics.relayUrlConfigured)}`,
    `Aggregator URL configured: ${optionalYesNo(diagnostics.aggregatorUrlConfigured)}`,
    `Missing config keys: ${diagnostics.missingConfigKeys.length > 0 ? diagnostics.missingConfigKeys.join(", ") : "none"}`,
    `Balance/preflight result: ${diagnostics.balancePreflight}`,
    `Upload job ID returned: ${optionalYesNo(diagnostics.uploadJobIdReturned)}`,
    `Blob/reference returned: ${optionalYesNo(diagnostics.blobIdReturned)}`,
    `Blob ID recorded: ${yesNo(diagnostics.blobIdRecorded)}`,
    `Recommendation: ${diagnostics.recommendation || "Retry Step 06 or check Walrus upload relay status."}`,
  ].join("\n");
}

function toBigInt(value: bigint | number | string) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.max(0, Math.trunc(value)));
  const normalized = value.replace(/[,_\s]/g, "");
  return normalized ? BigInt(normalized) : BigInt(0);
}

function parseRequiredAvailable(message: string) {
  return {
    required: message.match(/Required:\s*([0-9][0-9,_\s]*)/i)?.[1],
    available: message.match(/Available:\s*([0-9][0-9,_\s]*)/i)?.[1],
  };
}

export function formatWalAmountFromFrost(value: bigint | number | string): string {
  const amount = toBigInt(value);
  const whole = amount / FROST_PER_WAL;
  const fraction = amount % FROST_PER_WAL;
  if (fraction === BigInt(0)) return `${whole.toString()} WAL`;

  const decimal = fraction.toString().padStart(9, "0").replace(/0+$/, "");
  const numeric = Number(`${whole.toString()}.${decimal}`);
  if (numeric > 0 && numeric < 0.0001) return `${whole.toString()}.${decimal} WAL`;
  if (numeric < 1) return `${numeric.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} WAL`;
  return `${numeric.toLocaleString("en-US", { maximumFractionDigits: 6 })} WAL`;
}

export function isWalBalanceError(error: unknown) {
  const message = errorMessage(error);
  return /Insufficient balance/i.test(message) && /::wal::WAL/i.test(message);
}

export function isSuiGasError(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("gas") ||
    message.includes("::sui::sui") ||
    (message.includes("insufficient") && /\bsui\b/.test(message))
  );
}

export function isWalletRejectedError(error: unknown) {
  return /reject|denied|cancel/i.test(errorMessage(error));
}

export function isNetworkMismatchError(error: unknown) {
  return /network mismatch|switch.*sui|wrong network/i.test(errorMessage(error));
}

export function normalizeUserFacingError(error: unknown): UserFacingError {
  const message = errorMessage(error);
  const lower = message.toLowerCase();
  const { required, available } = parseRequiredAvailable(message);

  if (isWalrusUploadError(error)) {
    const diagnostics = {
      ...error.diagnostics,
      errorCode: error.diagnostics.errorCode || error.code,
      shortMessage: error.diagnostics.shortMessage || message,
    };
    const details = formatWalrusDiagnostics(diagnostics);

    if (error.code === "wallet_not_connected") {
      return {
        title: "Wallet connection is required.",
        lines: ["Wallet connection is required to pay for Walrus Mainnet storage."],
        details,
      };
    }

    if (error.code === "wrong_network") {
      return {
        title: "Switch to Sui Mainnet.",
        lines: ["Switch to Sui Mainnet before storing this trace on Walrus."],
        details,
      };
    }

    if (error.code === "wallet_signer_unavailable") {
      return {
        title: "Wallet signer not available.",
        lines: ["Wallet signer not available. Reconnect your wallet and try again."],
        details,
      };
    }

    if (error.code === "walrus_config_missing") {
      return {
        title: "Walrus upload is not ready.",
        lines: ["Check relay configuration and wallet connection before retrying."],
        details,
      };
    }

    if (error.code === "relay_unavailable") {
      return {
        title: "Walrus upload relay failed.",
        lines: ["The trace bundle remains sealed locally and can be re-run from this step."],
        details,
      };
    }

    if (error.code === "invalid_endpoint_response") {
      return {
        title: "Walrus endpoint returned an invalid response.",
        lines: ["The app preserved the sealed trace bundle for re-run."],
        details,
      };
    }

    if (error.code === "invalid_trace_bundle") {
      return {
        title: "Trace bundle was not found.",
        lines: ["The sealed trace payload or required hashes are missing. Re-run from the current step."],
        details,
      };
    }

    if (error.code === "invalid_storage_policy") {
      return {
        title: "Walrus storage policy is invalid.",
        lines: ["Select a valid storage duration and mode before retrying."],
        details,
      };
    }

    if (error.code === "wallet_rejected") {
      return {
        title: "Wallet approval was rejected.",
        lines: ["No Walrus storage transaction was completed. You can re-run from this step."],
        details,
      };
    }

    if (error.code === "insufficient_wal") {
      return {
        title: "Not enough WAL for Walrus Mainnet storage.",
        lines: [
          "Not enough SUI/WAL balance to pay for Walrus storage.",
          required ? `Required: ~${formatWalAmountFromFrost(required)}` : "Required: small WAL balance",
          available ? `Available: ${formatWalAmountFromFrost(available)}` : "Available: not reported",
        ],
        details,
      };
    }

    if (error.code === "insufficient_sui") {
      return {
        title: "Insufficient SUI for Walrus storage gas.",
        lines: ["Add a small SUI balance for Walrus registration and certification transactions."],
        details,
      };
    }

    if (error.code === "blob_id_missing") {
      return {
        title: "Walrus relay did not return a valid upload job.",
        lines: ["The sealed trace bundle is preserved locally and can be re-run from Step 6."],
        details,
      };
    }

    if (error.code === "upload_failed") {
      return {
        title: "Walrus SDK upload failed.",
        lines: ["The trace bundle remains sealed locally and can be re-run from this step."],
        details,
      };
    }

    return {
      title: "Walrus storage failed.",
      lines: ["The trace bundle remains sealed locally and can be re-run from this step."],
      details,
    };
  }

  if (isSafeJsonResponseError(error)) {
    const isWalrusEndpoint = /walrus|storage|sessions\/.+storage-finalize/i.test(error.endpoint ?? "");
    return {
      title: isWalrusEndpoint ? "Walrus endpoint returned an invalid response." : "Action could not be completed.",
      lines: [
        isWalrusEndpoint
          ? "The app preserved the sealed trace bundle for re-run."
          : "The verification endpoint returned an invalid response.",
        isWalrusEndpoint
          ? "No raw endpoint response was trusted as proof."
          : "Please re-run the agent from this step.",
      ],
      details: [
        `Endpoint: ${error.endpoint ?? "unknown"}`,
        `Status: ${error.status ?? "unknown"} ${error.statusText ?? ""}`.trim(),
        `Content-Type: ${error.contentType || "not reported"}`,
        error.snippet ? `Response snippet: ${error.snippet}` : "Response snippet: empty",
      ].join("\n"),
    };
  }

  if (isWalBalanceError(error) || (lower.includes("::wal::wal") && lower.includes("insufficient"))) {
    return {
      title: "Not enough WAL for Walrus Mainnet storage.",
      lines: [
        "Your wallet needs a small WAL balance to store this trace on Walrus Mainnet.",
        required ? `Required: ~${formatWalAmountFromFrost(required)}` : "Required: small WAL balance",
        available ? `Available: ${formatWalAmountFromFrost(available)}` : "Available: not reported",
        "Add a small WAL balance to this wallet and try again.",
      ],
      details: message,
    };
  }

  if (isSuiGasError(error)) {
    return {
      title: "Not enough SUI for transaction gas.",
      lines: ["Add a small SUI balance to this wallet and try again."],
      details: message,
    };
  }

  if (isWalletRejectedError(error)) {
    return {
      title: "Wallet request cancelled.",
      lines: ["No transaction was sent. You can try again."],
      details: message,
    };
  }

  if (lower.includes("connect") && lower.includes("fail")) {
    return {
      title: "Wallet connection failed.",
      lines: ["Choose a wallet and try again."],
      details: message,
    };
  }

  if (isNetworkMismatchError(error)) {
    return {
      title: "Switch to Sui Mainnet.",
      lines: ["Agent BlackBox is configured for Sui Mainnet."],
      details: message,
    };
  }

  if (lower.includes("relay")) {
    return {
      title: "Walrus upload relay is temporarily unavailable.",
      lines: ["Your trace was not stored. Try again in a moment."],
      details: message,
    };
  }

  if (lower.includes("hash mismatch")) {
    return {
      title: "Trace verification failed.",
      lines: ["The stored blob did not match the expected trace hash."],
      details: message,
    };
  }

  if (lower.includes("proof contract not configured")) {
    return {
      title: "Proof contract not configured.",
      lines: [
        "Walrus storage can be created first. Sui proof anchoring stays disabled until the Mainnet package ID is set.",
      ],
      details: message,
    };
  }

  if (lower.includes("agent_runtime_schema_error")) {
    return {
      title: "Agent Runtime returned an invalid structured report.",
      lines: ["No session was created. Try again or adjust the task prompt."],
      details: message,
    };
  }

  if (lower.includes("agent runtime is not configured")) {
    return {
      title: "Agent Runtime is not configured.",
      lines: ["Add the server-side runtime key before creating live BlackBox sessions."],
      details: message,
    };
  }

  if (lower.includes("aggregator") || lower.includes("readback")) {
    return {
      title: "Walrus Mainnet readback failed.",
      lines: ["The trace was not saved because the stored blob could not be verified."],
      details: message,
    };
  }

  return {
    title: "Action could not be completed.",
    lines: ["No successful state was recorded. Review the details and try again."],
    details: message,
  };
}
