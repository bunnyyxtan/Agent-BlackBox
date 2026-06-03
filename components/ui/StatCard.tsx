import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo, type Protocol } from "@/components/ui/ProtocolLogo";

interface StatCardProps {
  label: string;
  value: string | number;
  detail: string;
  icon: string;
  protocol?: Protocol;
}

export function StatCard({ label, value, detail, icon, protocol }: StatCardProps) {
  return (
    <GlassCard className="group relative p-6 transition-all duration-500 hover:-translate-y-1 hover:border-indigo-500/30 hover:bg-white/[0.04]">
      {/* Soft background glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2rem]" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <p className="text-[0.65rem] font-medium uppercase tracking-widest text-zinc-500 group-hover:text-indigo-300 transition-colors">{label}</p>
          {protocol ? (
            <ProtocolLogo
              protocol={protocol}
              size="md"
              className="transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
              <iconify-icon icon={icon} className="text-lg text-zinc-500 group-hover:text-indigo-400 transition-colors" />
            </div>
          )}
        </div>
        <p className="font-serif text-4xl font-light tracking-tight text-white mb-2">{value}</p>
        <p className="text-xs font-light text-zinc-500">{detail}</p>
      </div>
    </GlassCard>
  );
}
