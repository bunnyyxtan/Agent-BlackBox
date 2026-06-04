"use client";

import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { ProofDetails } from "@/components/blackbox/ProofDetails";
import { TamperTestPanel } from "@/components/blackbox/TamperTestPanel";
import { TraceTimeline } from "@/components/blackbox/TraceTimeline";
import { VerificationGrid } from "@/components/blackbox/VerificationGrid";
import { GlassCard } from "@/components/ui/GlassCard";
import { readJsonResponse } from "@/lib/http/safe-json";
import { getVerificationPresentation } from "@/lib/verification-presentation";
import type { AgentSession, TamperSimulationResult } from "@/types/blackbox";

export function VerifySessionClient({ session }: { session: AgentSession }) {
  const [liveSession, setLiveSession] = useState(session);
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckError, setRecheckError] = useState("");
  const [tamperResult, setTamperResult] = useState<TamperSimulationResult | null>(null);
  const [tamperLoading, setTamperLoading] = useState(false);
  const [tamperError, setTamperError] = useState("");
  const simulationTampered = Boolean(tamperResult);
  const verificationPresentation = getVerificationPresentation(liveSession);
  const verified = verificationPresentation.state === "verified";
  const realVerificationStatus = verified ? "Still Verified" : verificationPresentation.status;
  const warning = verificationPresentation.state === "pending";
  const tamperState = verificationPresentation.state === "tampered";
  const headerClass = tamperState
    ? "border-rose-300/25 bg-rose-300/[0.045]"
    : verified
      ? "border-emerald-300/20 bg-emerald-300/[0.035]"
      : "border-amber-300/20 bg-amber-300/[0.035]";
  const iconClass = tamperState
    ? "border-rose-300/20 bg-rose-300/10 text-rose-200"
    : verified
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
      : "border-amber-300/20 bg-amber-300/10 text-amber-200";
  const titleClass = tamperState ? "text-rose-100" : "text-white";

  async function recheckProof() {
    setRecheckLoading(true);
    setRecheckError("");
    setTamperResult(null);
    setTamperError("");
    try {
      const response = await fetch(`/api/verify/${liveSession.id}/recheck`, {
        method: "POST",
      });
      const payload = await readJsonResponse<{
        data?: { session: AgentSession };
        message?: string;
      }>(response, `POST /api/verify/${liveSession.id}/recheck`);
      if (!response.ok || !payload.data?.session) {
        throw new Error(payload.message ?? "Proof verification could not be rerun.");
      }
      setLiveSession(payload.data.session);
    } catch (requestError) {
      setRecheckError(
        requestError instanceof Error ? requestError.message : "Proof verification could not be rerun.",
      );
    } finally {
      setRecheckLoading(false);
    }
  }

  async function toggleTamper() {
    if (simulationTampered) {
      setTamperResult(null);
      setTamperError("");
      return;
    }
    setTamperLoading(true);
    setTamperError("");
    try {
      const response = await fetch(`/api/verify/${liveSession.id}/tamper-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await readJsonResponse<{
        data?: TamperSimulationResult;
        message?: string;
      }>(response, `POST /api/verify/${liveSession.id}/tamper-test`);
      if (!response.ok || !payload.data) {
        throw new Error(payload.message ?? "Tamper simulation could not be completed.");
      }
      setTamperResult(payload.data);
    } catch (requestError) {
      setTamperError(
        requestError instanceof Error ? requestError.message : "Tamper simulation could not be completed.",
      );
    } finally {
      setTamperLoading(false);
    }
  }

  return (
    <div>
      <GlassCard
        className={`overflow-visible p-5 sm:p-7 ${headerClass}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`shrink-0 rounded-xl border p-2.5 ${iconClass}`}
            >
              {verified ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className="eyebrow">Independent Verification Report</p>
              <h1 className={`mt-2 text-xl font-semibold [overflow-wrap:anywhere] sm:text-2xl ${titleClass}`}>
                {verificationPresentation.title}
              </h1>
              <p className={`mt-2 text-sm ${warning ? "text-amber-100/75" : "text-slate-400"}`}>
                {verificationPresentation.description}
              </p>
            </div>
          </div>
          <div className="min-w-0 text-left sm:text-right">
            <p className="font-mono text-xs text-slate-500 [overflow-wrap:anywhere]">{liveSession.id}</p>
            <p className="mt-1 text-xs text-slate-600 [overflow-wrap:anywhere]">{liveSession.title}</p>
            <button
              type="button"
              onClick={recheckProof}
              disabled={recheckLoading}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-cyan/15 bg-cyan/[0.035] px-4 text-xs font-semibold uppercase tracking-[0.13em] text-cyan transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:border-0 sm:bg-transparent sm:px-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${recheckLoading ? "animate-spin" : ""}`} />
              {recheckLoading ? "Rechecking Proof..." : "Recheck Proof"}
            </button>
            {recheckError && <p className="mt-2 max-w-xs text-xs text-red-300">{recheckError}</p>}
          </div>
        </div>
      </GlassCard>

      <div className="mt-5">
        {liveSession.isSample ? (
          <GlassCard className="mb-5 border-cyan/15 bg-cyan/[0.035] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan">
              Sample Trace
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              This verification page is using curated sample data for public presentation. It does not claim a wallet-signed Walrus or Sui proof.
            </p>
          </GlassCard>
        ) : null}
        <VerificationGrid session={liveSession} />
      </div>

      <div className="mt-5 space-y-5 overflow-visible">
        <GlassCard className="min-w-0 p-5">
          <p className="eyebrow">Proof Bundle</p>
          <h2 className="mt-2 text-base font-semibold text-white">Proof details</h2>
          <div className="mt-5">
            <ProofDetails session={liveSession} />
          </div>
        </GlassCard>
        <TamperTestPanel
          tampered={simulationTampered}
          loading={tamperLoading}
          error={tamperError}
          result={tamperResult}
          realVerificationStatus={realVerificationStatus}
          onSimulate={toggleTamper}
        />
      </div>

      <GlassCard className="mt-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Agent Replay</p>
            <h2 className="mt-2 text-base font-semibold text-white">Chronological forensic timeline</h2>
          </div>
          <span className="font-mono text-xs text-slate-600">{liveSession.trace.timeline.length} events</span>
        </div>
        <div className="mt-6">
          <TraceTimeline items={liveSession.trace.timeline} />
        </div>
      </GlassCard>
    </div>
  );
}
