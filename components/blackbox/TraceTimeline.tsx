import { formatDate } from "@/lib/constants";
import type { TraceTimelineItem } from "@/types/blackbox";

export function TraceTimeline({
  items,
  compact = false,
}: {
  items: TraceTimelineItem[];
  compact?: boolean;
}) {
  return (
    <div className="relative py-2">
      {/* Animated trace line */}
      <div className="absolute left-[15px] top-4 bottom-4 w-px bg-white/5">
        <div className="w-full h-full bg-gradient-to-b from-indigo-500/0 via-indigo-500/50 to-emerald-500/0 animate-pulse" />
      </div>

      <ol className="relative space-y-0">
        {items.map((item, index) => {
          const isComplete = item.status === "complete";
          
          return (
            <li className="relative flex gap-4 pb-6 last:pb-0 group" key={item.id}>
              {/* Status Dot */}
              <div 
                className={`relative z-10 mt-1 h-8 w-8 shrink-0 rounded-full border-2 flex items-center justify-center transition-all duration-300 bg-[#050507]
                  ${isComplete ? 'border-emerald-500/30 text-emerald-400 group-hover:border-emerald-400/50 group-hover:shadow-[0_0_15px_-3px_rgba(52,211,153,0.4)]' : 
                    'border-indigo-500/30 text-indigo-400 group-hover:border-indigo-400/50 group-hover:shadow-[0_0_15px_-3px_rgba(129,140,248,0.4)]'}`}
              >
                <iconify-icon 
                  icon={isComplete ? "solar:check-circle-bold-duotone" : "solar:record-circle-line-duotone"} 
                  className="text-lg"
                />
              </div>

              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
                  <p className={`min-w-0 text-sm font-medium tracking-tight transition-colors [overflow-wrap:anywhere] ${isComplete ? 'text-zinc-200 group-hover:text-white' : 'text-indigo-200 group-hover:text-indigo-100'}`}>
                    {item.label}
                  </p>
                  <span className="font-mono text-[0.65rem] text-zinc-600 group-hover:text-zinc-400 transition-colors">
                    {formatDate(item.timestamp)}
                  </span>
                </div>
                {!compact && (
                  <p className="mt-1.5 text-xs font-light leading-relaxed text-zinc-500 transition-colors [overflow-wrap:anywhere] group-hover:text-zinc-400">
                    {item.description}
                  </p>
                )}
                
                {/* Optional Metadata Pill */}
                {item.metadata && Object.keys(item.metadata).length > 0 && !compact && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(item.metadata).map(([key, val]) => (
                      <span key={key} className="inline-flex max-w-full items-center gap-1 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1 font-mono text-[0.6rem] text-zinc-400 [overflow-wrap:anywhere]">
                        <span className="text-zinc-600">{key}:</span> {String(val)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
