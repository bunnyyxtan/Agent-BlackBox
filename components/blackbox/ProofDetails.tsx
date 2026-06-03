import { CopyButton } from "@/components/ui/CopyButton";
import { formatStatusLabel, StatusBadge } from "@/components/ui/StatusBadge";
import { AGENT_MODE_LABELS, formatDate } from "@/lib/constants";
import { getProofExplorerUrl, getSuiProofRegistryConfig } from "@/lib/sui-proof";
import {
  formatProofMode,
  formatProofStatus,
  formatTatumRpcStatus,
} from "@/lib/tatum-rpc-labels";
import type { AgentSession } from "@/types/blackbox";

interface ProofDetailsProps {
  session: AgentSession;
}

function formatPendingPlaceholder(value: string) {
  return value.includes("pending") ? formatStatusLabel(value) : value;
}

const STATUS_ROW_LABELS = new Set([
  "Anchored At",
  "Network",
  "Proof Mode",
  "Proof Status",
  "Storage Network",
  "Storage Provider",
  "Storage Status",
  "Tatum RPC Status",
  "Upload Adapter",
]);

function shouldRenderBadge(label: string, value: string) {
  if (STATUS_ROW_LABELS.has(label)) return true;
  if (label === "Owner Wallet") return value === "Local Check";
  if (label === "Proof Package ID") return /not configured/i.test(value);
  if (label === "Sui Object ID" || label === "Sui Transaction Digest") return /pending/i.test(value);
  if (label === "Upload Relay") return value === "Not used";
  return false;
}

export function ProofDetails({ session }: ProofDetailsProps) {
  const explorerUrl = getProofExplorerUrl(session.proof);
  const proofNetwork = formatStatusLabel(session.proof.network);
  const proofRegistry = getSuiProofRegistryConfig();
  const showTatumRpcDetails =
    session.tatumRpc.status === "passed" || session.tatumRpc.status === "transaction_found";
  const rows = [
    ["Session ID", session.id],
    ["Agent Mode", AGENT_MODE_LABELS[session.agentMode]],
    ["Owner Wallet", session.proof.owner ?? "Local Check"],
    ["Input Hash", session.trace.inputHash],
    ["Trace Hash", session.trace.traceHash],
    ["Result Hash", session.trace.resultHash],
    ["Walrus Upload Job ID", session.storage.uploadJobId],
    ["Upload Adapter", formatStatusLabel(session.storage.uploadAdapter)],
    ["Storage Provider", formatStatusLabel(session.storage.storageProvider)],
    ["Storage Network", formatStatusLabel(session.storage.storageNetwork ?? "walrus-mainnet")],
    ["Upload Relay", session.storage.relayUrl ?? "Not used"],
    ["Storage Status", formatStatusLabel(session.storage.storageStatus)],
    ["Storage Expiry", formatDate(session.storage.expiryDate)],
    ["Walrus Blob ID", session.storage.blobId],
    ["Walrus Object ID", session.storage.blobObjectId],
    ["Proof Status", formatProofStatus(session.proof.status)],
    ["Proof Package ID", proofRegistry.configured ? session.proof.packageId : "Proof contract not configured"],
    ["Proof Module", session.proof.moduleName],
    ["Create Function", session.proof.createFunction],
    ["Sui Object ID", formatPendingPlaceholder(session.proof.suiObjectId)],
    ["Sui Transaction Digest", formatPendingPlaceholder(session.proof.transactionDigest)],
    ["Proof Mode", formatProofMode(session.proof.proofMode)],
    ["Anchored At", session.proof.anchoredAt ? formatDate(session.proof.anchoredAt) : "Not anchored"],
    ...(showTatumRpcDetails
      ? [
          ["Tatum RPC Status", formatTatumRpcStatus(session.tatumRpc.status)],
          ["Tatum RPC Checked At", formatDate(session.tatumRpc.checkedAt)],
          ["Mismatch Reasons", session.tatumRpc.mismatchReasons?.join(" ") || "None reported"],
        ]
      : []),
    ["Network", proofNetwork],
    ["Verification Time", formatDate(session.verification.checkedAt)],
  ];

  return (
    <>
      <div className="rounded-xl border border-white/[0.08]">
        {rows.map(([label, value], index) => (
          <div
            className={`grid min-w-0 gap-1 px-3 py-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3 ${
              index % 2 === 0 ? "bg-white/[0.025]" : "bg-transparent"
            }`}
            key={label}
          >
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-slate-500">
              {label}
            </span>
            <span className="min-w-0 max-w-full font-mono text-xs leading-5 text-slate-300 [overflow-wrap:anywhere]" title={value}>
              {shouldRenderBadge(label, value) ? <StatusBadge status={value} size="sm" /> : value}
            </span>
            <CopyButton value={value} compact />
          </div>
        ))}
      </div>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.13em] text-cyan transition hover:text-white"
        >
          Open Sui transaction
        </a>
      )}
    </>
  );
}
