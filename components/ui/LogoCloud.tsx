import { ProtocolLogo } from "@/components/ui/ProtocolLogo";

export function LogoCloud() {
  return (
    <div className="w-full py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <p className="eyebrow text-center mb-8">Proof Infrastructure Stack</p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md transition-all hover:bg-white/[0.04] hover:border-indigo-500/20 group">
            <div className="flex h-10 items-center justify-center gap-2 text-zinc-300 transition-colors group-hover:text-indigo-200">
              <ProtocolLogo protocol="sui" size="lg" />
              <span className="font-semibold text-lg tracking-tight">Sui</span>
            </div>
            <p className="text-xs text-zinc-500 mt-3 font-light text-center">Onchain Proof Registry</p>
          </div>

          <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md transition-all hover:bg-white/[0.04] hover:border-cyan-500/20 group">
            <div className="flex h-10 items-center justify-center gap-2 text-zinc-300 transition-colors group-hover:text-cyan-200">
              <ProtocolLogo protocol="walrus" size="lg" />
              <span className="font-semibold text-lg tracking-tight">Walrus</span>
            </div>
            <p className="text-xs text-zinc-500 mt-3 font-light text-center">Decentralized Blob Storage</p>
          </div>

          <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md transition-all hover:bg-white/[0.04] hover:border-violet-500/20 group">
            <div className="flex h-10 items-center justify-center gap-2 text-zinc-300 transition-colors group-hover:text-violet-200">
              <ProtocolLogo protocol="tatum" size="lg" />
              <span className="font-semibold text-lg tracking-tight">Tatum</span>
            </div>
            <p className="text-xs text-zinc-500 mt-3 font-light text-center">Sui RPC + Optional Upload Adapter</p>
          </div>
        </div>
      </div>
    </div>
  );
}
