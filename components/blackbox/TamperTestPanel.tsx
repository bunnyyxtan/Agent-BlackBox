"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { shortHash } from "@/lib/constants";
import type { TamperSimulationResult } from "@/types/blackbox";

export function TamperTestPanel({
  tampered,
  loading,
  error,
  result,
  onSimulate,
}: {
  tampered: boolean;
  loading: boolean;
  error: string;
  result: TamperSimulationResult | null;
  onSimulate: () => void | Promise<void>;
}) {
  return (
    <GlassCard
      className={`relative overflow-visible p-6 transition-all duration-500 
        ${tampered ? "border-amber-300/30 bg-amber-300/[0.055] shadow-[0_0_30px_-8px_rgba(251,191,36,0.25)]" : "border-white/10"}`
      }
    >
      {tampered && (
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
        </div>
      )}

      <div className="relative z-10 flex flex-col items-start gap-5">
        <div
          className={`shrink-0 rounded-2xl border p-3 flex items-center justify-center transition-all duration-500 ${
            tampered
              ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
              : "border-indigo-500/20 bg-indigo-500/10 text-indigo-400"
          }`}
        >
          <iconify-icon 
            icon={tampered ? "solar:shield-warning-bold-duotone" : "solar:shield-check-line-duotone"} 
            className="text-2xl"
          />
        </div>
        
        <div className="min-w-0 flex-1">
          <h3 className={`text-base font-medium tracking-tight ${tampered ? "text-amber-50" : "text-white"}`}>
            Tamper Resistance Test
          </h3>
          <p className="mt-1 text-xs font-light leading-relaxed text-zinc-400 [overflow-wrap:anywhere]">
            Run a local trace mutation without changing the sealed session or real proof status.
          </p>
          {tampered && (
            <>
              <div className="mt-3">
                <StatusBadge status="Tampered" label="Simulation: Tamper Detected" variant="warning" size="sm" />
              </div>
              <p className="mt-2 text-xs leading-5 text-amber-50/75 [overflow-wrap:anywhere]">
                This is a local simulation only. The original sealed proof remains unchanged.
              </p>
              {result && (
                <p className="mt-2 font-mono text-[0.64rem] leading-relaxed text-amber-100/80 [overflow-wrap:anywhere]">
                  Sealed {shortHash(result.originalTraceHash, 10, 8)} / modified{" "}
                  {shortHash(result.tamperedTraceHash, 10, 8)}
                </p>
              )}
            </>
          )}
          {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        </div>

        <button 
          type="button" 
          className={`flex max-w-full shrink-0 items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-xs font-medium transition-all duration-300 ${
            tampered 
              ? "border-amber-300/30 bg-amber-300/10 text-amber-50 hover:bg-amber-300/15 hover:shadow-[0_0_20px_-8px_rgba(251,191,36,0.35)]"
              : "border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08] hover:border-white/20"
          }`} 
          onClick={onSimulate}
          disabled={loading}
        >
          <iconify-icon icon="solar:restart-line-duotone" className="text-sm" />
          {loading ? "Recomputing..." : tampered ? "Reset Simulation" : "Simulate Tamper"}
        </button>
      </div>
    </GlassCard>
  );
}
