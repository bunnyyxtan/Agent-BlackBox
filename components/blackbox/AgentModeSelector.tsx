"use client";

import { AGENT_MODE_LABELS } from "@/lib/constants";
import type { AgentMode } from "@/types/blackbox";

const modes: {
  id: AgentMode;
  icon: string;
  simpleMeaning: string;
  useFor: string;
  needs: string;
  output: string;
}[] = [
  {
    id: "research",
    icon: "solar:minimalistic-magnifer-line-duotone",
    simpleMeaning: "Finds and explains.",
    useFor: "Investigating a project, market, protocol, company, topic, claim, or document.",
    needs: "Topic, question, links, notes, or attached evidence.",
    output: "Research brief, key findings, evidence summary, assumptions, limitations, next actions.",
  },
  {
    id: "risk_review",
    icon: "solar:shield-warning-line-duotone",
    simpleMeaning: "Checks what could go wrong.",
    useFor: "Reviewing a transaction, process, report, project, agreement, claim, or workflow.",
    needs: "Context, claim, process, report text, transaction details, or evidence files.",
    output: "Risk rating, issue list, severity ranking, missing info, mitigation steps.",
  },
  {
    id: "delivery_proof",
    icon: "solar:verified-check-line-duotone",
    simpleMeaning: "Proves work was delivered.",
    useFor: "Creating proof of task completion, client delivery, handoff, submission, milestone, or acceptance.",
    needs: "Delivery description, files, links, timestamps, acceptance notes, client/project name.",
    output: "Sealed delivery receipt, evidence bundle, acceptance trail, proof strength, next steps.",
  },
  {
    id: "onchain_monitor",
    icon: "solar:radar-line-duotone",
    simpleMeaning: "Analyzes Sui wallet and proof data.",
    useFor: "Analyzing Sui wallets, token holdings, transactions, objects, and packages with a sealed trace.",
    needs: "Sui wallet address, transaction digest, object ID, or package ID.",
    output: "Sui holdings report, risk signals, RPC evidence, and sealed proof metadata.",
  },
];

export function AgentModeSelector({
  value,
  onChange,
}: {
  value: AgentMode;
  onChange: (mode: AgentMode) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {modes.map(({ id, icon, simpleMeaning, useFor, needs, output }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`group relative flex min-h-44 flex-col items-start rounded-2xl border p-4 text-left transition-all duration-300 sm:p-5 ${
              selected
                ? "border-indigo-500/50 bg-indigo-500/[0.08] shadow-[0_0_30px_-5px_rgba(99,102,241,0.2)]"
                : "border-white/10 bg-white/[0.02] hover:border-indigo-500/30 hover:bg-white/[0.04]"
            }`}
          >
            {selected && (
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-transparent" />
            )}

            <div className="relative z-10 flex h-full w-full flex-col">
              <div className="mb-2 flex items-center gap-3 pr-8 text-sm font-medium text-white">
                <iconify-icon
                  icon={icon}
                  className={`text-2xl transition-colors ${
                    selected ? "text-indigo-400" : "text-zinc-500 group-hover:text-indigo-300"
                  }`}
                />
                {AGENT_MODE_LABELS[id]}
              </div>
              <p className="mb-4 text-xs font-light leading-relaxed text-zinc-400">
                {simpleMeaning}
              </p>

              <div className="mt-auto grid w-full gap-2 border-t border-white/5 pt-3">
                {[
                  ["Use", useFor],
                  ["Needs", needs],
                  ["Creates", output],
                ].map(([label, text]) => (
                  <div key={label}>
                    <p
                      className={`font-mono text-[0.62rem] uppercase tracking-widest transition-colors ${
                        selected ? "text-indigo-300" : "text-zinc-600 group-hover:text-zinc-400"
                      }`}
                    >
                      {label}
                    </p>
                    <p className="mt-1 text-xs font-light leading-snug text-zinc-500">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`absolute right-4 top-4 flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
                selected ? "border-indigo-400" : "border-white/10 group-hover:border-white/20"
              }`}
            >
              {selected && <div className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
