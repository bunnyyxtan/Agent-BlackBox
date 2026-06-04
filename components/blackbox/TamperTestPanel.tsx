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
  realVerificationStatus,
  onSimulate,
}: {
  tampered: boolean;
  loading: boolean;
  error: string;
  result: TamperSimulationResult | null;
  realVerificationStatus: string;
  onSimulate: () => void | Promise<void>;
}) {
  const realStatusVariant = realVerificationStatus.toLowerCase().includes("verified") ? "success" : "warning";

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
          className={`flex shrink-0 items-center justify-center rounded-2xl border p-3 transition-all duration-500 ${
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
            Tamper Simulation
          </h3>
          <p className="mt-1 text-xs font-light leading-relaxed text-zinc-400 [overflow-wrap:anywhere]">
            Test what would happen if the sealed trace were modified locally. This does not change the original proof.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-indigo-300/15 bg-indigo-300/[0.055] px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.13em] text-indigo-100">
              Local simulation only
            </span>
            {!tampered && <StatusBadge status="Not run" label="Status: Not run" variant="neutral" size="sm" />}
          </div>

          {!tampered && (
            <p className="mt-3 text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">
              This test intentionally mutates a temporary local copy to prove that altered evidence would fail verification.
            </p>
          )}

          {tampered && (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge
                  status="Simulation Result"
                  label="Simulation Result: Tamper Would Be Detected"
                  variant="warning"
                  size="sm"
                />
                <StatusBadge status="Original Proof: Unchanged" variant="success" size="sm" />
                <StatusBadge
                  status={realVerificationStatus}
                  label={`Real Verification Status: ${realVerificationStatus}`}
                  variant={realStatusVariant}
                  size="sm"
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-amber-50/75 [overflow-wrap:anywhere]">
                A temporary local copy was modified and its hash no longer matches the sealed proof hash. The original session and proof remain unchanged.
              </p>
              {result && (
                <div className="mt-3 space-y-2 rounded-xl border border-amber-200/15 bg-black/20 p-3">
                  <div>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-amber-100/50">
                      Original sealed hash
                    </p>
                    <p className="mt-1 font-mono text-[0.68rem] leading-relaxed text-amber-100/80 [overflow-wrap:anywhere]" title={result.originalTraceHash}>
                      {result.originalTraceHash}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-amber-100/50">
                      Simulated modified hash
                    </p>
                    <p className="mt-1 font-mono text-[0.68rem] leading-relaxed text-amber-100/80 [overflow-wrap:anywhere]" title={result.tamperedTraceHash}>
                      {result.tamperedTraceHash}
                    </p>
                  </div>
                  <p className="text-[0.62rem] text-amber-100/45">
                    Short view: sealed {shortHash(result.originalTraceHash, 10, 8)} / simulated{" "}
                    {shortHash(result.tamperedTraceHash, 10, 8)}
                  </p>
                </div>
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
          {loading ? "Running simulation..." : tampered ? "Reset Simulation" : "Run Tamper Simulation"}
        </button>
      </div>
    </GlassCard>
  );
}
