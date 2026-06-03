import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo, type Protocol } from "@/components/ui/ProtocolLogo";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getWalrusConfiguration, getWalrusNetworkLabel } from "@/lib/walrus";

export function SystemIntegrityPanel() {
  const walrusNetworkLabel = getWalrusNetworkLabel(getWalrusConfiguration().network);
  const checks = [
    { label: `${walrusNetworkLabel} Blob Storage`, status: "Prepared", iconName: "solar:cloud-storage-line-duotone", protocol: "walrus" as Protocol },
    { label: `Direct ${walrusNetworkLabel} Verification`, status: "Prepared", iconName: "solar:database-line-duotone", protocol: "walrus" as Protocol },
    { label: "Sui Mainnet RPC via Tatum", status: "Prepared", iconName: "solar:server-line-duotone", protocol: "tatum" as Protocol },
    { label: "Etherscan V2 EVM Enrichment", status: "Optional", iconName: "solar:chart-line-duotone" },
  ];
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow">Integration Posture</p>
          <h2 className="mt-1 text-base font-medium text-white">System Integrity</h2>
        </div>
        <StatusBadge status="Ready" />
      </div>
      <div className="space-y-2">
        {checks.map(({ label, status, iconName, protocol }) => (
          <div
            className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.03]"
            key={label}
          >
            <span className="flex items-center gap-2.5 text-xs font-light text-zinc-400">
              {protocol ? (
                <ProtocolLogo protocol={protocol} size="sm" />
              ) : (
                <iconify-icon icon={iconName} className="text-lg text-indigo-300" />
              )}
              {label}
            </span>
            <StatusBadge status={status} />
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
