import { formatStatusLabel, StatusBadge } from "@/components/ui/StatusBadge";
import { GlassCard } from "@/components/ui/GlassCard";
import { CopyButton } from "@/components/ui/CopyButton";
import { ProtocolLogo, type Protocol } from "@/components/ui/ProtocolLogo";
import { shortHash } from "@/lib/constants";
import { getSuiProofRegistryConfig } from "@/lib/sui-proof";
import { formatTatumRpcStatus } from "@/lib/tatum-rpc-labels";
import { getVerificationPresentation } from "@/lib/verification-presentation";
import type { AgentSession } from "@/types/blackbox";

function getProofAnchorStatus(session: AgentSession) {
  if (session.verification.suiProofFound) return "Found";
  if (
    session.proof.status === "verified" ||
    session.proof.status === "anchored"
  ) {
    return "Anchored";
  }
  if (session.proof.status === "anchored_pending_object") return "Pending Sui Anchor";
  if (session.proof.status === "failed") return "Failed";
  return "Not anchored";
}

function shouldShowTatumRpcCard(session: AgentSession) {
  return session.tatumRpc.status === "passed" || session.tatumRpc.status === "transaction_found";
}

export function VerificationGrid({ session }: { session: AgentSession }) {
  const networkLabel = session.proof.network === "sui-testnet" ? "Testnet" : "Mainnet";
  const localOnly = session.storage.storageProvider === "local";
  const proofRegistry = getSuiProofRegistryConfig();
  const localTraceLabel = "Local Trace";
  const walrusLabel = localOnly ? localTraceLabel : `Walrus ${networkLabel}`;
  const verificationPresentation = getVerificationPresentation(session);
  const hashStatus =
    verificationPresentation.state === "tampered"
      ? "Tampered"
      : verificationPresentation.state === "verified"
        ? "Matched"
        : verificationPresentation.status;
  const hashDetail =
    verificationPresentation.state === "tampered"
      ? "Canonical trace hash mismatch"
      : session.trace.traceHash;
  const expiryStatus = localOnly
    ? "Prepared"
    : session.storage.storageStatus === "expired"
      ? "Expired"
      : session.storage.noRenewal
        ? "Cancelled"
        : "Active";
  const baseItems: Array<{
    detail: string;
    icon: string;
    label: string;
    protocol?: Protocol;
    status: string;
  }> = [
    { label: `${walrusLabel} Blob Storage`, status: session.storage.storageStatus, icon: "solar:database-line-duotone", detail: session.storage.uploadJobId, protocol: "walrus" },
    { label: "Walrus Trace Blob", status: session.verification.walrusBlobAvailable ? "Available" : localOnly ? localTraceLabel : "Prepared", icon: "solar:cloud-storage-line-duotone", detail: session.storage.blobId, protocol: "walrus" },
    { label: `Direct ${walrusLabel} Read`, status: session.verification.directWalrusReadPassed ? "Passed" : localOnly ? localTraceLabel : "Prepared", icon: "solar:scan-line-duotone", detail: "Aggregator read path", protocol: "walrus" },
    { label: "Walrus Network", status: networkLabel, icon: "solar:global-line-duotone", detail: formatStatusLabel(session.storage.storageNetwork ?? `walrus-${networkLabel.toLowerCase()}`), protocol: "walrus" },
    {
      label: "Sui Proof Anchor",
      status: proofRegistry.configured ? getProofAnchorStatus(session) : "Proof contract not configured",
      icon: "solar:link-circle-line-duotone",
      detail: proofRegistry.configured ? session.proof.suiObjectId : "Mainnet package ID required",
      protocol: "sui",
    },
    {
      label: "Hash Integrity",
      status: hashStatus,
      icon: "solar:fingerprint-line-duotone",
      detail: hashDetail,
    },
    { label: "Expiry / Renewal", status: expiryStatus, icon: "solar:history-line-duotone", detail: session.storage.expiryDate, protocol: "walrus" },
  ];
  const items = shouldShowTatumRpcCard(session)
    ? [
        ...baseItems.slice(0, 5),
        {
          label: "Tatum RPC Check",
          status: formatTatumRpcStatus(session.tatumRpc.status),
          icon: "solar:server-square-line-duotone",
          detail: session.tatumRpc.message,
          protocol: "tatum" as const,
        },
        ...baseItems.slice(5),
      ]
    : baseItems;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-4">
      {items.map(({ label, status, icon, detail, protocol }, index) => {
        const dangerStatus = ["Failed", "Tampered", "Verification Unavailable"].includes(status);
        return (
          <GlassCard 
            key={label}
            className="group relative min-h-[10.5rem] overflow-visible p-5 transition-all duration-500 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-[0_0_20px_-5px_rgba(99,102,241,0.15)] animate-fade-in"
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
          >
            {/* Subtle glow background */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.02] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 rounded-2xl pointer-events-none" />

            <div className="relative z-10 flex min-h-full min-w-0 flex-col">
              <div className="mb-5 flex items-start justify-between gap-3">
                {protocol ? (
                  <ProtocolLogo
                    protocol={protocol}
                    size="lg"
                    className="transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
                    <iconify-icon 
                      icon={icon} 
                      className={`text-xl ${dangerStatus ? "text-red-400 group-hover:text-red-300" : "text-zinc-400 group-hover:text-indigo-400"} transition-colors duration-300`} 
                    />
                  </div>
                )}
                <StatusBadge status={status} />
              </div>
            
              <p className="min-w-0 text-sm font-medium tracking-tight text-white [overflow-wrap:anywhere]">{label}</p>
            
              <div className="mt-3 flex min-w-0 items-start gap-2">
                <p
                  className="min-w-0 flex-1 font-mono text-[0.68rem] leading-5 text-zinc-500 [overflow-wrap:anywhere]"
                  title={detail}
                >
                  {detail.length > 52 ? shortHash(detail, 18, 12) : detail}
                </p>
                {detail && detail !== "Aggregator read path" && (
                  <CopyButton value={detail} compact />
                )}
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
