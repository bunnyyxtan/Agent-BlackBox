import { Fingerprint, ScanLine } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo } from "@/components/ui/ProtocolLogo";
import { formatStatusLabel, StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, shortHash } from "@/lib/constants";
import type { WalrusVerification } from "@/types/blackbox";

export function WalrusVerificationPanel({
  verification,
}: {
  verification: WalrusVerification;
}) {
  const rows = [
    { label: "Network", value: formatStatusLabel(verification.walrusNetwork ?? "mainnet"), protocol: true },
    { label: "Blob ID", value: shortHash(verification.blobId, 12, 10), protocol: true },
    { label: "Walrus Object ID", value: shortHash(verification.objectId, 12, 10), icon: ScanLine },
    { label: "Hash Comparison", value: verification.readStatus === "unknown" ? "Prepared" : verification.hashMatched ? "Matched" : "Failed", icon: Fingerprint },
    { label: "Checked At", value: formatDate(verification.checkedAt), icon: ScanLine },
  ];

  return (
    <GlassCard className="min-w-0 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ProtocolLogo protocol="walrus" size="md" />
          <div className="min-w-0">
            <p className="eyebrow">Blob-Level Evidence</p>
            <h3 className="mt-2 text-base font-semibold text-white">Direct Walrus Verification</h3>
          </div>
        </div>
        <StatusBadge status={verification.readStatus} />
      </div>
      <div className="mt-5 space-y-2">
        {rows.map(({ label, value, icon: Icon, protocol }) => (
          <div
            className="flex flex-col gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            key={label}
          >
            <span className="flex items-center gap-2 text-xs text-slate-500">
              {protocol ? (
                <ProtocolLogo protocol="walrus" size="sm" />
              ) : Icon ? (
                <Icon className="h-3.5 w-3.5 text-cyan" />
              ) : null}
              {label}
            </span>
            <span className="font-mono text-xs text-slate-300 [overflow-wrap:anywhere]">{value}</span>
          </div>
        ))}
      </div>
      {verification.error && <p className="mt-4 text-xs leading-5 text-amber-100/75">{verification.error}</p>}
      <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-slate-500">Replay readiness</span>
        <StatusBadge
          status={verification.readStatus === "available" && verification.hashMatched ? "Ready" : "Prepared"}
        />
      </div>
    </GlassCard>
  );
}
