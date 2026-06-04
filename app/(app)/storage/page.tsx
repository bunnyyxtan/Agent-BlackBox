import { LockKeyhole } from "lucide-react";

import { StorageRelayStatusCard } from "@/components/blackbox/StorageRelayStatusCard";
import { StorageOperationsWalletScope } from "@/components/blackbox/WalletScopedSessions";
import { GlassCard } from "@/components/ui/GlassCard";
import { getWalrusConfiguration, getWalrusNetworkLabel } from "@/lib/walrus";

export const dynamic = "force-dynamic";

export default async function StoragePage() {
  const walrus = getWalrusConfiguration();
  const walrusNetworkLabel = getWalrusNetworkLabel(walrus.network);
  return (
    <>
      <div>
        <p className="eyebrow">Hybrid Evidence Storage</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Storage Operations
        </h1>
        <p className="muted mt-2 max-w-3xl">
          {walrusNetworkLabel} blob storage and direct Walrus reads make agent traces durable, replayable, and
          independently verifiable. Upload adapters remain replaceable infrastructure.
        </p>
      </div>

      <StorageRelayStatusCard
        aggregatorConfigured={Boolean(walrus.aggregatorUrl)}
        relayConfigured={walrus.relayConfigured}
        walrusNetworkLabel={walrusNetworkLabel}
      />

      <StorageOperationsWalletScope walrusNetworkLabel={walrusNetworkLabel} />

      <GlassCard className="mt-6 border-amber-200/15 bg-amber-200/[0.035] p-4">
        <div className="flex items-start gap-2">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-amber-100" />
          <p className="text-xs leading-5 text-slate-400">
            Walrus blobs are public by default. Encrypt sensitive trace bundles before production
            upload and keep decryption local to the verifier.
          </p>
        </div>
      </GlassCard>
    </>
  );
}

