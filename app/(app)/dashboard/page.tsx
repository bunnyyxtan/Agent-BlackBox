import Link from "next/link";

import { SystemIntegrityPanel } from "@/components/blackbox/SystemIntegrityPanel";
import { DashboardWalletScope } from "@/components/blackbox/WalletScopedSessions";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
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
          className="group flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-900 transition-all hover:bg-indigo-100 hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.5)] sm:w-auto"
        >
          <iconify-icon icon="solar:play-circle-line-duotone" className="text-lg group-hover:scale-110 transition-transform" />
          Use Agent
        </Link>
      </div>

      <DashboardWalletScope />

      <div className="mt-5">
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
