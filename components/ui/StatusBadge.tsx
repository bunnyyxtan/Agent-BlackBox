export type StatusBadgeVariant = "success" | "warning" | "error" | "neutral";
export type StatusBadgeSize = "sm" | "md";

const LABEL_OVERRIDES: Record<string, string> = {
  active: "Active",
  anchored: "Anchored",
  anchored_pending_object: "Proof Pending",
  available: "Available",
  cancelled: "Cancelled",
  certified: "Certified",
  checking: "Checking...",
  "checking...": "Checking...",
  complete: "Completed",
  completed: "Completed",
  configured: "Configured",
  "contract pending": "Contract Pending",
  "configuration pending": "Configuration Pending",
  deleted: "Deleted",
  disabled: "Disabled",
  done: "Completed",
  error: "Action Needed",
  evm_wallet: "EVM Wallet",
  failed: "Failed",
  found: "Found",
  invalid_json: "Invalid Response",
  live: "Live",
  local: "Local",
  local_only: "Local Only",
  "local demo": "Local Check",
  "local fallback": "Local Check",
  "local phase": "Local Check",
  "local phase 1": "Local Check",
  local_phase1: "Local Check",
  "mainnet": "Mainnet",
  matched: "Matched",
  missing: "Missing",
  "missing api key": "Missing API Key",
  missing_api_key: "Missing API Key",
  mismatch: "Mismatch",
  no: "No",
  not_configured: "Not Configured",
  "not anchored": "Not Anchored",
  "not checked": "Not Checked",
  "not configured": "Not Configured",
  "not confirmed": "Not Confirmed",
  "not required": "Not Required",
  "not used": "Not Used",
  no_tip: "Not Required",
  "not verified": "Not Verified",
  optional: "Optional",
  "package unavailable": "Package Unavailable",
  package_unavailable: "Package Unavailable",
  partial: "Partial",
  passed: "Passed",
  pending: "Pending",
  "pending hash": "Pending Hash",
  "pending sui anchor": "Pending Sui Anchor",
  prepared: "Prepared",
  "proof contract not configured": "Proof Contract Not Configured",
  "proof-object-pending": "Proof Pending",
  queued: "Queued",
  ready: "Ready",
  rerunning: "Re-running",
  "re-running": "Re-running",
  "re-running now": "Re-running",
  "runtime unavailable": "Runtime Unavailable",
  runtime_unavailable: "Runtime Unavailable",
  running: "Active",
  sealed: "Sealed",
  send_tip: "Available",
  skipped: "Skipped",
  "sui-mainnet": "Sui Mainnet",
  "sui-testnet": "Sui Testnet",
  stored: "Stored",
  tampered: "Tampered",
  "tampered trace detected": "Tampered Trace Detected",
  "transaction found": "Transaction Found",
  transaction_found: "Transaction Found",
  "transaction-pending": "Transaction Pending",
  unavailable: "Unavailable",
  unknown: "Unknown",
  used: "Data Used",
  verified: "Verified",
  "verification pending": "Verification Pending",
  "verification unavailable": "Verification Unavailable",
  "verified trace": "Verified Trace",
  "walrus-mainnet": "Walrus Mainnet",
  walrus_direct: "Walrus Direct",
  walrus_mainnet_upload_relay: "Walrus Mainnet Upload Relay",
  walrus_sdk_relay: "Walrus SDK Upload Relay",
  yes: "Yes",
};

const SUCCESS_STATES = new Set([
  "active",
  "anchored",
  "available",
  "certified",
  "reachable",
  "complete",
  "completed",
  "configured",
  "done",
  "found",
  "live",
  "matched",
  "passed",
  "ready",
  "send_tip",
  "sealed",
  "stored",
  "transaction found",
  "transaction_found",
  "used",
  "verified",
  "verified trace",
  "walrus verified",
  "sui anchored",
  "fully verified",
  "yes",
]);

const WARNING_STATES = new Set([
  "action needed",
  "cancelled",
  "anchored_pending_object",
  "contract pending",
  "configuration pending",
  "checking...",
  "error",
  "not anchored",
  "not checked",
  "not confirmed",
  "partial",
  "pending",
  "pending hash",
  "pending sui anchor",
  "preliminary",
  "prepared",
  "proof contract not configured",
  "proof-object-pending",
  "queued",
  "rerunning",
  "re-running",
  "transaction-pending",
  "verification pending",
]);

const ERROR_STATES = new Set([
  "deleted",
  "expired",
  "failed",
  "invalid_json",
  "missing api key",
  "missing_api_key",
  "missing",
  "mismatch",
  "no",
  "not verified",
  "package unavailable",
  "package_unavailable",
  "runtime unavailable",
  "runtime_unavailable",
  "tampered",
  "tampered trace detected",
  "unavailable",
  "verification unavailable",
]);

const NEUTRAL_STATES = new Set([
  "disabled",
  "local",
  "local_only",
  "local demo",
  "local fallback",
  "local phase",
  "local phase 1",
  "local_phase1",
  "not_configured",
  "not configured",
  "not used",
  "not required",
  "no_tip",
  "optional",
  "sample trace",
  "skipped",
  "unknown",
]);

function normalizeStatus(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bevm\b/gi, "EVM")
    .replace(/\bsui\b/gi, "Sui")
    .replace(/\brpc\b/gi, "RPC")
    .replace(/\bsdk\b/gi, "SDK")
    .replace(/\bapi\b/gi, "API")
    .replace(/\bjson\b/gi, "JSON")
    .replace(/\bwalrus\b/gi, "Walrus")
    .replace(/\bmcp\b/gi, "MCP")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatStatusLabel(status: string) {
  const trimmed = status.trim();
  const normalized = normalizeStatus(trimmed);
  return LABEL_OVERRIDES[normalized] ?? titleCase(trimmed);
}

export function getStatusBadgeVariant(status: string): StatusBadgeVariant {
  const normalized = normalizeStatus(status);
  const labelNormalized = normalizeStatus(formatStatusLabel(status));
  if (ERROR_STATES.has(normalized) || ERROR_STATES.has(labelNormalized)) return "error";
  if (WARNING_STATES.has(normalized) || WARNING_STATES.has(labelNormalized)) return "warning";
  if (SUCCESS_STATES.has(normalized) || SUCCESS_STATES.has(labelNormalized)) return "success";
  if (NEUTRAL_STATES.has(normalized) || NEUTRAL_STATES.has(labelNormalized)) return "neutral";
  return "neutral";
}

const variantStyles: Record<StatusBadgeVariant, string> = {
  success:
    "border-emerald-300/25 bg-emerald-300/[0.09] text-emerald-100 shadow-[0_0_24px_-18px_rgba(110,231,183,0.85)]",
  warning:
    "border-amber-200/25 bg-amber-300/[0.095] text-amber-100 shadow-[0_0_24px_-18px_rgba(251,191,36,0.8)]",
  error:
    "border-red-300/25 bg-red-400/[0.09] text-red-100 shadow-[0_0_24px_-18px_rgba(248,113,113,0.82)]",
  neutral:
    "border-indigo-200/15 bg-indigo-300/[0.055] text-indigo-100 shadow-[0_0_24px_-20px_rgba(165,180,252,0.75)]",
};

const defaultIcons: Record<StatusBadgeVariant, string> = {
  success: "solar:check-circle-bold-duotone",
  warning: "solar:info-circle-bold-duotone",
  error: "solar:danger-triangle-bold-duotone",
  neutral: "solar:shield-minimalistic-line-duotone",
};

const sizeClasses: Record<StatusBadgeSize, string> = {
  sm: "gap-1.5 px-2.5 py-1 text-[0.66rem]",
  md: "gap-2 px-3 py-1.5 text-xs",
};

export function StatusBadge({
  icon,
  label,
  size = "sm",
  status,
  variant,
}: {
  icon?: string;
  label?: string;
  size?: StatusBadgeSize;
  status: string;
  variant?: StatusBadgeVariant;
}) {
  const displayLabel = label ?? formatStatusLabel(status);
  const resolvedVariant = variant ?? getStatusBadgeVariant(status);
  const iconName = icon ?? defaultIcons[resolvedVariant];

  return (
    <span
      className={`inline-flex max-w-full min-w-0 items-center whitespace-nowrap rounded-full border font-semibold uppercase tracking-[0.12em] ${sizeClasses[size]} ${variantStyles[resolvedVariant]}`}
      title={displayLabel}
    >
      <iconify-icon icon={iconName} className="shrink-0 text-[1.05em]" />
      <span className="min-w-0 truncate">{displayLabel}</span>
    </span>
  );
}
