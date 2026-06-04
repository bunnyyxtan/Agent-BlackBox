import Link from "next/link";

import { AgentBlackBoxLogo } from "@/components/ui/AgentBlackBoxLogo";
import { ProtocolLogo } from "@/components/ui/ProtocolLogo";
import { APP_NAME } from "@/lib/constants";

const COPYRIGHT_YEAR = 2026;

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/5 bg-[#050507] pb-8 pt-12 sm:pt-16">
      {/* Subtle top border glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
      
      {/* Background radial */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-900/10 blur-[120px] rounded-[100%] pointer-events-none"></div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="mb-12 grid grid-cols-1 gap-10 md:mb-16 md:grid-cols-4 md:gap-12">
          {/* Brand Summary */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" prefetch className="group inline-flex items-center gap-3">
              <AgentBlackBoxLogo size="sm" />
              <span className="font-semibold tracking-tight text-white">{APP_NAME}</span>
            </Link>
            <p className="text-sm font-light text-zinc-400 max-w-sm leading-relaxed">
              The flight recorder for autonomous AI agents. Record, store, and verify hash-sealed traces with cryptographic certainty.
            </p>
            
            {/* Animated Status Strip */}
            <div className="mt-4 inline-flex max-w-full items-center gap-3 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-mono text-emerald-400/80 uppercase tracking-widest">Network Operational</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white">Platform</h4>
            <ul className="space-y-3">
              <li><Link href="/dashboard" prefetch className="text-sm font-light text-zinc-400 hover:text-indigo-400 transition-colors">Dashboard</Link></li>
              <li><Link href="/sessions/new" prefetch className="text-sm font-light text-zinc-400 hover:text-indigo-400 transition-colors">Agents</Link></li>
              <li><Link href="/verify/abx-delivery-verify" prefetch className="text-sm font-light text-zinc-400 hover:text-indigo-400 transition-colors">Verify Proof</Link></li>
              <li><Link href="/storage" prefetch className="text-sm font-light text-zinc-400 hover:text-indigo-400 transition-colors">Storage</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white">Resources</h4>
            <ul className="space-y-3">
              <li><Link href="/developer" prefetch className="text-sm font-light text-zinc-400 hover:text-indigo-400 transition-colors">Developers</Link></li>
              <li><a href="#" className="text-sm font-light text-zinc-400 hover:text-indigo-400 transition-colors">Documentation</a></li>
              <li><a href="#" className="text-sm font-light text-zinc-400 hover:text-indigo-400 transition-colors">GitHub</a></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-white/5 pt-8 md:flex-row md:items-center">
          <p className="text-xs font-light text-zinc-500">
            &copy; {COPYRIGHT_YEAR} Agent BlackBox. All rights reserved.
          </p>
          
          {/* Proof Stack */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <span className="text-xs font-mono text-zinc-600 uppercase tracking-widest">Powered by</span>
            <div className="flex items-center gap-4 text-zinc-400">
              <ProtocolLogo protocol="sui" size="sm" />
              <ProtocolLogo protocol="walrus" size="sm" />
              <ProtocolLogo protocol="tatum" size="sm" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
