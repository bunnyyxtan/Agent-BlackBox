import { AlertTriangle } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";

export function SessionStoreWarning({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <GlassCard className="border-amber-200/15 bg-amber-200/[0.035] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-100" />
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-100">
            Session archive notice
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{message}</p>
        </div>
      </div>
    </GlassCard>
  );
}
