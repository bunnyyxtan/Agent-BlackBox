import Link from "next/link";

import { AgentBlackBoxLogo } from "@/components/ui/AgentBlackBoxLogo";
import { ProtocolLogo } from "@/components/ui/ProtocolLogo";
import { APP_NAME } from "@/lib/constants";
import { getNetworkConfig } from "@/lib/network-config";

export function Navbar() {
  const network = getNetworkConfig();

  return (
    <header className="sticky top-0 z-40 h-20 border-b border-white/5 bg-[#050507]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-full w-full max-w-[94rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          {/* Mobile Only Logo */}
          <Link href="/" prefetch className="flex lg:hidden items-center gap-3">
            <AgentBlackBoxLogo size="md" />
            <span>
              <span className="block text-sm font-medium tracking-tight text-white">Agent <span className="text-indigo-400">BlackBox</span></span>
              <span className="hidden text-[0.6rem] uppercase tracking-[0.22em] text-slate-500 sm:block">
                Verifiable Agent Infrastructure
              </span>
            </span>
          </Link>

          {/* Desktop Only Context */}
          <span className="hidden lg:inline-flex items-center text-xs text-zinc-500 font-mono tracking-wider uppercase">
            <span className="font-medium text-zinc-300 mr-2">{APP_NAME}</span> / <span className="ml-2 text-indigo-300">Mainnet Proof Console</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1 text-[0.66rem] font-medium uppercase tracking-[0.16em] text-zinc-400">
            <ProtocolLogo protocol="sui" size="sm" />
            {network.rpcNetworkMismatch ? "RPC network mismatch" : network.displayNetwork}
          </span>
        </div>
      </div>
    </header>
  );
}
