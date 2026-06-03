import Link from "next/link";

import { SessionsListClient } from "@/components/blackbox/SessionsListClient";
import { SystemIntegrityPanel } from "@/components/blackbox/SystemIntegrityPanel";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatCard } from "@/components/ui/StatCard";
import { listSessions } from "@/lib/session-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const sessions = await listSessions();
  const walrusStored = sessions.filter(
    (session) => session.storage.storageProvider !== "local" && session.verification.directWalrusReadPassed,
  ).length;
  const suiAnchored = sessions.filter(
    (session) => session.proof.status === "anchored" || session.proof.status === "anchored_pending_object" || session.proof.status === "verified",
  ).length;
  const fullyVerified = sessions.filter(
    (session) => session.verification.directWalrusReadPassed && session.verification.tatumRpcPassed,
  ).length;
  return (
    <>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <p className="font-mono text-xs text-indigo-400 tracking-widest uppercase mb-2">Operations Overview</p>
          <h1 className="text-3xl font-light tracking-tight text-white sm:text-4xl">
            BlackBox Dashboard
          </h1>
          <p className="text-sm font-light text-zinc-500 mt-2 leading-relaxed">Monitor recorded sessions, storage certification, and proof integrity.</p>
        </div>
        <Link 
          href="/sessions/new" 
          prefetch
          className="group flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-900 transition-all hover:bg-indigo-100 hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.5)]"
        >
          <iconify-icon icon="solar:play-circle-line-duotone" className="text-lg group-hover:scale-110 transition-transform" />
          Use Agent
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Sessions"
          value={sessions.length}
          detail="Replayable agent records"
          icon="solar:document-text-line-duotone"
        />
        <StatCard
          label="Stored Blobs"
          value={walrusStored}
          detail="Walrus readback matched"
          icon="solar:database-line-duotone"
          protocol="walrus"
        />
        <StatCard
          label="Sui Anchors"
          value={suiAnchored}
          detail="Onchain proof references"
          icon="solar:waterdrop-line-duotone"
          protocol="sui"
        />
        <StatCard
          label="Fully Verified"
          value={fullyVerified}
          detail="Walrus and Sui checks passed"
          icon="solar:verified-check-bold-duotone"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_21rem]">
        <div className="xl:pt-6">
          <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-white/5 pb-4">
            <h2 className="text-sm font-medium text-white">Recent sessions</h2>
            <Link
              href="/sessions"
              prefetch
              className="text-xs font-medium uppercase tracking-[0.1em] text-indigo-300 transition-colors hover:text-indigo-200"
            >
              View all
            </Link>
          </div>
          <SessionsListClient sessions={sessions} limit={4} />
        </div>
        <SystemIntegrityPanel />
      </div>

      <GlassCard className="mt-5 p-5">
        <p className="text-xs font-light leading-relaxed text-zinc-500">
          Agent BlackBox stores trace bundles on Walrus, reads blobs directly for integrity checks,
          anchors lightweight proof metadata on Sui, and verifies proof reads through Tatum Sui RPC.
        </p>
      </GlassCard>
    </>
  );
}

