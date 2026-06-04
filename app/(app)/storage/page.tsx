import { LockKeyhole } from "lucide-react";

import { StorageJobCard } from "@/components/blackbox/StorageJobCard";
import { StorageRelayStatusCard } from "@/components/blackbox/StorageRelayStatusCard";
import { SessionStoreWarning } from "@/components/blackbox/SessionStoreWarning";
import { WalrusVerificationPanel } from "@/components/blackbox/WalrusVerificationPanel";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo } from "@/components/ui/ProtocolLogo";
import { listSessionsSafe } from "@/lib/session-service";
import { getWalrusConfiguration, getWalrusNetworkLabel } from "@/lib/walrus";

export const dynamic = "force-dynamic";

export default async function StoragePage() {
  const { sessions, warning: sessionStoreWarning } = await listSessionsSafe();
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

      {sessionStoreWarning ? (
        <div className="mt-6">
          <SessionStoreWarning message={sessionStoreWarning} />
        </div>
      ) : null}

      <section className="mt-7">
        <div className="mb-3 flex items-center gap-2">
          <ProtocolLogo protocol="walrus" size="sm" />
          <div>
            <h2 className="text-base font-semibold text-white">{walrusNetworkLabel} Blob Storage</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Blob references, upload adapter metadata, expiry, and renewal lifecycle.
            </p>
          </div>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {sessions.map((session) => (
            <StorageJobCard
              expectedTraceHash={session.trace.traceHash}
              job={session.storage}
              key={session.storage.uploadJobId}
              verification={session.walrusVerification}
              walrusNetworkLabel={walrusNetworkLabel}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <ProtocolLogo protocol="walrus" size="sm" />
          <div>
            <h2 className="text-base font-semibold text-white">Direct {walrusNetworkLabel} Verification</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Blob IDs, Walrus object references, read status, hash comparison, and replay readiness.
            </p>
          </div>
        </div>
        <div className="grid gap-3 xl:grid-cols-3">
          {sessions.map((session) => (
            <WalrusVerificationPanel verification={session.walrusVerification} key={session.id} />
          ))}
        </div>
      </section>

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

