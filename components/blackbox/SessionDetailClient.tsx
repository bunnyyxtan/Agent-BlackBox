"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  ExternalLink,
  Fingerprint,
  Link2,
  RadioTower,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AgentReportPanel } from "@/components/blackbox/AgentReportPanel";
import { TraceTimeline } from "@/components/blackbox/TraceTimeline";
import { CopyButton } from "@/components/ui/CopyButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo } from "@/components/ui/ProtocolLogo";
import { formatStatusLabel, StatusBadge } from "@/components/ui/StatusBadge";
import { AGENT_MODE_LABELS, formatDate, getSessionEvidenceStatus, shortHash } from "@/lib/constants";
import { buildSuiExplorerUrl } from "@/lib/sui-explorer";
import { formatProofStatus, formatTatumRpcStatus } from "@/lib/tatum-rpc-labels";
import type { AgentSession } from "@/types/blackbox";

const AnchorProofPanel = dynamic<{ session: AgentSession }>(
  () =>
    import("@/components/blackbox/AnchorProofPanel")
      .then((module) => module.AnchorProofPanel)
      .catch(() => ProofVerificationUnavailablePanel),
  {
    ssr: false,
    loading: () => <ProofVerificationLoadingPanel />,
  },
);

function formatPendingPlaceholder(value: string) {
  return value.includes("pending") ? formatStatusLabel(value) : value;
}

function EvidenceRow({ badge = false, label, value }: { badge?: boolean; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 border-b border-white/[0.06] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="flex min-w-0 items-center justify-between gap-2 sm:justify-end">
        <span className="min-w-0 font-mono text-xs text-slate-300 [overflow-wrap:anywhere]" title={badge ? formatStatusLabel(value) : value}>
          {badge ? <StatusBadge status={value} size="sm" /> : value.length > 34 ? shortHash(value, 12, 9) : value}
        </span>
        <CopyButton value={value} compact />
      </span>
    </div>
  );
}

function ProofVerificationLoadingPanel() {
  return (
    <GlassCard className="border-cyan/15 bg-cyan/[0.025] p-5">
      <p className="eyebrow">Wallet-Signed Sui Action</p>
      <h2 className="mt-2 text-base font-semibold text-white">Anchor Proof on Sui</h2>
      <p className="mt-3 text-xs leading-5 text-slate-400">
        Loading proof verification controls...
      </p>
    </GlassCard>
  );
}

function ProofVerificationUnavailablePanel(_props: { session?: AgentSession }) {
  return (
    <GlassCard className="border-amber-300/15 bg-amber-300/[0.035] p-5">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-200/80" />
        <div>
          <p className="eyebrow">Verification Unavailable</p>
          <h2 className="mt-2 text-base font-semibold text-white">
            Proof verification module could not be loaded in this build.
          </h2>
          <p className="mt-3 text-xs leading-5 text-amber-100/75">
            The session report and sealed trace metadata remain available. Rebuild the app after
            clearing the Next.js cache to restore proof controls.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

export function SessionDetailClient({ session }: { session: AgentSession }) {
  const [proofUrl, setProofUrl] = useState(`/verify/${session.id}`);
  const suiTransactionUrl = buildSuiExplorerUrl(
    "transaction",
    session.proof.transactionDigest,
    session.proof.network,
  );

  useEffect(() => {
    setProofUrl(`${window.location.origin}/verify/${session.id}`);
  }, [session.id]);

  function exportTrace() {
    const blob = new Blob([JSON.stringify(session.trace, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${session.id}-trace.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const actionButtonBase =
    "inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-full px-4 text-center text-[0.7rem] font-semibold uppercase tracking-[0.12em] transition sm:px-5";
  const primaryActionClass = `${actionButtonBase} bg-white text-zinc-950 hover:bg-indigo-100 hover:shadow-[0_0_32px_-10px_rgba(255,255,255,0.72)]`;
  const secondaryActionClass = `${actionButtonBase} border border-white/10 bg-white/[0.025] text-zinc-300 hover:border-white/20 hover:bg-white/[0.055]`;
  const utilityActionClass = `${actionButtonBase} border border-white/[0.08] bg-black/20 px-3 text-zinc-400 hover:border-cyan/25 hover:bg-cyan/[0.045] hover:text-cyan sm:px-4`;

  return (
    <div>
      <div className="rounded-[1.65rem] border border-white/[0.08] bg-white/[0.025] p-5 shadow-[0_24px_90px_-70px_rgba(99,102,241,0.9)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 max-w-4xl">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="eyebrow">BlackBox Session</p>
              <span
                className="rounded-full border border-white/[0.08] bg-black/25 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500"
                title={session.id}
              >
                {shortHash(session.id, 12, 6)}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white [overflow-wrap:anywhere] sm:text-3xl">
              {session.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={getSessionEvidenceStatus(session)} />
              <StatusBadge status={AGENT_MODE_LABELS[session.agentMode]} />
              <span className="text-xs text-slate-500">{formatDate(session.createdAt)}</span>
              {session.rerunOf && (
                <Link
                  href={`/sessions/${session.rerunOf}`}
                  className="inline-flex items-center rounded-full border border-cyan/15 bg-cyan/[0.035] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-cyan transition hover:border-cyan/30 hover:text-white"
                >
                  Re-run of {shortHash(session.rerunOf, 9, 4)}
                </Link>
              )}
            </div>
          </div>

          <div className="w-full shrink-0 xl:w-auto xl:max-w-[34rem]">
            <div className="rounded-[1.35rem] border border-white/[0.07] bg-black/25 p-2.5">
              <div className="grid gap-2 sm:grid-cols-2 xl:justify-end">
                <Link href={`/verify/${session.id}`} className={primaryActionClass}>
                  Open Verification Page
                  <ArrowUpRight className="h-4 w-4 shrink-0" />
                </Link>
                <Link href={`/sessions/new?rerun=${encodeURIComponent(session.id)}`} className={secondaryActionClass}>
                  <RotateCcw className="h-4 w-4 shrink-0" />
                  Re-run Agent
                </Link>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <CopyButton value={proofUrl} label="Copy Proof Link" className={utilityActionClass} />
                <button type="button" className={utilityActionClass} onClick={exportTrace}>
                  <Download className="h-4 w-4 shrink-0" />
                  Export Trace JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AgentReportPanel session={session} anchorProofAction={<AnchorProofPanel session={session} />} />

      <div className="mt-6 rounded-[1.35rem] border border-white/[0.07] bg-white/[0.018] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Detailed Proof Metadata</p>
            <h2 className="mt-2 text-base font-semibold text-white">Sealed Trace Fingerprints</h2>
          </div>
          <StatusBadge status={getSessionEvidenceStatus(session)} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Input Hash", value: session.trace.inputHash, icon: Fingerprint },
            { label: "Trace Hash", value: session.trace.traceHash, icon: CheckCircle2 },
            { label: "Result Hash", value: session.trace.resultHash, icon: Link2 },
            { label: "Owner Wallet", value: session.ownerAddress ?? "Local Check", icon: RadioTower },
          ].map(({ label, value, icon: Icon }) => (
            <GlassCard className="min-w-0 p-4" key={label}>
              <Icon className="h-4 w-4 text-cyan" />
              <p className="mt-4 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {label}
              </p>
              <p className="mt-1.5 font-mono text-xs text-slate-200 [overflow-wrap:anywhere]" title={value}>
                {shortHash(value, 12, 8)}
              </p>
            </GlassCard>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Replay Evidence</p>
              <h2 className="mt-2 text-base font-semibold text-white">Forensic Timeline</h2>
            </div>
            <span className="font-mono text-xs text-slate-600">
              {session.trace.timeline.length} events
            </span>
          </div>
          <div className="mt-6">
            <TraceTimeline items={session.trace.timeline} />
          </div>
        </GlassCard>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
          <GlassCard className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <ProtocolLogo protocol="walrus" size="md" />
                <div>
                  <p className="eyebrow">Walrus Storage</p>
                  <h2 className="mt-2 text-base font-semibold text-white">Blob Storage Reference</h2>
                </div>
              </div>
              <StatusBadge status={session.storage.storageStatus} />
            </div>
            <div className="mt-4">
              {session.storage.warning && (
                <p className="mb-3 rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-3 py-2 text-xs leading-5 text-amber-100/75">
                  {session.storage.warning}
                </p>
              )}
              <EvidenceRow label="Walrus Upload Job ID" value={session.storage.uploadJobId} />
              <EvidenceRow badge label="Provider" value={session.storage.storageProvider} />
              <EvidenceRow badge label="Upload adapter" value={session.storage.uploadAdapter} />
              <EvidenceRow badge label="Storage network" value={session.storage.storageNetwork ?? "walrus-mainnet"} />
              <EvidenceRow
                badge={!session.storage.relayUrl}
                label="Upload relay"
                value={session.storage.relayUrl ?? "Not used"}
              />
              <EvidenceRow label="Storage expiry" value={formatDate(session.storage.expiryDate)} />
              <EvidenceRow label="Walrus Blob ID" value={session.storage.blobId} />
              <EvidenceRow label="Walrus Object ID" value={session.storage.blobObjectId} />
              <div className="flex items-center justify-between gap-2 py-3">
                <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <ProtocolLogo protocol="walrus" size="sm" />
                  Direct Walrus read status
                </span>
                <StatusBadge status={session.walrusVerification.readStatus} />
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <ProtocolLogo protocol="sui" size="md" />
                <div>
                  <p className="eyebrow">Sui Evidence</p>
                  <h2 className="mt-2 text-base font-semibold text-white">Proof Anchor</h2>
                </div>
              </div>
              <StatusBadge status={formatProofStatus(session.proof.status)} />
            </div>
            <div className="mt-4">
              <EvidenceRow
                badge={session.proof.suiObjectId.includes("pending")}
                label="Sui proof object"
                value={formatPendingPlaceholder(session.proof.suiObjectId)}
              />
              <EvidenceRow
                badge={session.proof.transactionDigest.includes("pending")}
                label="Transaction digest"
                value={formatPendingPlaceholder(session.proof.transactionDigest)}
              />
              <div className="flex items-center justify-between gap-2 py-3">
                <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <ProtocolLogo protocol="tatum" size="sm" />
                  Tatum RPC verification
                </span>
                <StatusBadge status={formatTatumRpcStatus(session.tatumRpc.status)} />
              </div>
            </div>
            {suiTransactionUrl ? (
              <a
                href={suiTransactionUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-cyan transition hover:text-white"
              >
                Open Sui transaction
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <div className="mt-3">
                <StatusBadge status="Transaction Pending" size="sm" />
              </div>
            )}
            <Link
              href={`/verify/${session.id}`}
              className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-cyan transition hover:text-white"
            >
              Inspect proof bundle
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </GlassCard>
          <GlassCard className="border-cyan/15 bg-cyan/[0.035] p-4">
            <div className="flex items-start gap-2">
              <ProtocolLogo protocol="walrus" size="sm" />
              <p className="text-xs leading-5 text-slate-400">
                Walrus Mainnet storage is created through the SDK Upload Relay with the connected
                wallet paying storage and gas. Direct aggregator reads provide independent replay and
                integrity checks.
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
