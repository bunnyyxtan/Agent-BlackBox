import { SessionCard } from "@/components/blackbox/SessionCard";
import { GlassCard } from "@/components/ui/GlassCard";
import type { AgentSession } from "@/types/blackbox";

export function SessionsListClient({ sessions, limit }: { sessions: AgentSession[]; limit?: number }) {
  if (sessions.length === 0) {
    return (
      <GlassCard className="p-5">
        <p className="text-sm text-slate-400">No recorded sessions yet. Start an agent session to create the first trace.</p>
      </GlassCard>
    );
  }
  return (
    <div className="grid items-stretch gap-4 md:grid-cols-2">
      {sessions.slice(0, limit).map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}
