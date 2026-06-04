import type { AgentMode, AgentSession, SessionListItem, StorageStatus } from "@/types/blackbox";
import { buildSuiExplorerUrl } from "@/lib/sui-explorer";

export const APP_NAME = "Agent BlackBox";
export const APP_TAGLINE = "The flight recorder for autonomous AI agents.";
export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  sessions: "/sessions",
  newSession: "/sessions/new",
  storage: "/storage",
  settings: "/settings",
  developer: "/developer",
  developers: "/developers",
} as const;

export const ENV_NAMES = [
  "NEXT_PUBLIC_APP_NAME",
  "SUI_EXPLORER_BASE_URL",
  "NEXT_PUBLIC_SUI_NETWORK",
  "NEXT_PUBLIC_SUI_EXPLORER_BASE_URL",
  "NEXT_PUBLIC_SUI_EXPLORER_URL",
  "SUI_NETWORK",
  "SUI_RPC_URL",
  "OPENAI_API_KEY",
  "TATUM_API_KEY",
  "TATUM_SUI_RPC_URL",
  "TATUM_STORAGE_API_URL",
  "TATUM_STORAGE_PROVIDER",
  "STORAGE_PROVIDER",
  "STORAGE_ADAPTER",
  "NEXT_PUBLIC_STORAGE_PROVIDER",
  "WALRUS_NETWORK",
  "WALRUS_UPLOAD_RELAY_URL",
  "WALRUS_AGGREGATOR_URL",
  "WALRUS_STORAGE_EPOCHS",
  "SUI_PROOF_PACKAGE_ID",
  "NEXT_PUBLIC_SUI_PROOF_PACKAGE_ID",
  "SUI_PROOF_MODULE",
  "NEXT_PUBLIC_SUI_PROOF_MODULE",
  "SUI_PROOF_CREATE_FUNCTION",
  "NEXT_PUBLIC_SUI_PROOF_CREATE_FUNCTION",
  "NEXT_PUBLIC_AGENT_BLACKBOX_PACKAGE_ID",
  "NEXT_PUBLIC_AGENT_BLACKBOX_MODULE",
  "NEXT_PUBLIC_AGENT_BLACKBOX_CREATE_FUNCTION",
] as const;

export const STORAGE_STATES: StorageStatus[] = [
  "prepared",
  "queued",
  "pending",
  "stored",
  "local_only",
  "not_configured",
  "unavailable",
  "certified",
  "expired",
  "cancelled",
  "deleted",
];

export const AGENT_MODE_LABELS: Record<AgentMode, string> = {
  research: "Research Agent",
  risk_review: "Risk Review Agent",
  delivery_proof: "Delivery Proof Agent",
  onchain_monitor: "Sui Onchain Analyzer",
};

export function getSuiExplorerObjectUrl(objectId: string) {
  return buildSuiExplorerUrl("object", objectId) ?? "";
}

export function getSuiExplorerTxUrl(digest: string) {
  return buildSuiExplorerUrl("transaction", digest) ?? "";
}

export function shortHash(value: string, start = 8, end = 6) {
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function formatDate(value: string) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function getSessionEvidenceStatus(session: AgentSession | SessionListItem) {
  if (session.isSample) return "Sample Trace";
  if (
    session.verification.directWalrusReadPassed &&
    session.verification.hashMatched === true &&
    session.proof.status === "verified"
  ) {
    return "Fully Verified";
  }
  if (session.proof.status === "anchored_pending_object") {
    return "Pending Sui Anchor";
  }
  if (session.proof.status === "anchored") {
    return "Sui Anchored";
  }
  if (
    session.storage.storageProvider !== "local" &&
    session.verification.directWalrusReadPassed &&
    session.storage.hashMatched === true
  ) {
    return "Walrus Verified";
  }
  if (session.storage.storageProvider === "local") return "Local Trace";
  return "Prepared";
}
