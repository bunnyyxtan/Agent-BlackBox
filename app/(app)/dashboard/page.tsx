import Link from "next/link";

import { DashboardWalletScope } from "@/components/blackbox/WalletScopedSessions";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <p className="font-mono text-xs text-indigo-400 tracking-widest uppercase mb-2">Your Workspace</p>
          <h1 className="text-3xl font-light tracking-tight text-white sm:text-4xl">
            Agent BlackBox
          </h1>
          <p className="text-sm font-light text-zinc-500 mt-2 leading-relaxed">Your verified AI proof workspace.</p>
        </div>
        <Link 
          href="/sessions/new" 
          prefetch
          className="group flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-900 transition-all hover:bg-indigo-100 hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.5)] sm:w-auto"
        >
          <iconify-icon icon="solar:play-circle-line-duotone" className="text-lg group-hover:scale-110 transition-transform" />
          Start New Proof
        </Link>
      </div>

      <DashboardWalletScope />
    </>
  );
}
