import { ArrowUpRight, Clock3, Fingerprint } from "lucide-react";
import Link from "next/link";

import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AGENT_MODE_LABELS, formatDate, getSessionEvidenceStatus, shortHash } from "@/lib/constants";
import type { AgentSession } from "@/types/blackbox";

export function SessionCard({ session }: { session: AgentSession }) {
  return (
    <GlassCard className="card-hover flex h-full min-w-0 flex-col p-5 transition hover:border-indigo-500/30 hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{AGENT_MODE_LABELS[session.agentMode]}</p>
          <h3 className="mt-2 text-sm font-medium text-white [overflow-wrap:anywhere]">{session.title}</h3>
          {session.isSample ? (
            <p className="mt-2 text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-cyan/80">
              Sample Session
            </p>
          ) : null}
        </div>
        <StatusBadge status={getSessionEvidenceStatus(session)} />
      </div>
      <div className="mt-5 grid gap-2 text-xs font-light text-zinc-500 sm:grid-cols-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          {formatDate(session.createdAt)}
        </span>
        <span className="mono flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]">
          <Fingerprint className="h-3.5 w-3.5" />
          {shortHash(session.trace.traceHash)}
        </span>
      </div>
      <div className="mt-auto border-t border-white/5 pt-4">
        <Link
          href={`/sessions/${session.id}`}
          prefetch
          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-200 transition-colors uppercase tracking-[0.1em]"
        >
          Inspect Trace
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </GlassCard>
  );
}
