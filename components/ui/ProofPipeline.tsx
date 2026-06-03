"use client";

import { GlassCard } from "./GlassCard";
import { ProtocolLogo, type Protocol } from "./ProtocolLogo";

const STEPS = [
  {
    num: "01",
    icon: "solar:cpu-bolt-line-duotone",
    title: "Use Agent",
    desc: "Choose an agent and enter a task or upload files.",
    color: "text-indigo-300",
    glow: "group-hover:shadow-[0_0_30px_-5px_rgba(129,140,248,0.4)]"
  },
  {
    num: "02",
    icon: "solar:document-add-line-duotone",
    title: "Capture Trace",
    desc: "Agent BlackBox records the intent, inputs, tool calls, and final output as the session runs.",
    color: "text-indigo-400",
    glow: "group-hover:shadow-[0_0_30px_-5px_rgba(129,140,248,0.4)]"
  },
  {
    num: "03",
    icon: "solar:cloud-upload-line-duotone",
    title: "Store on Walrus",
    desc: "The trace bundle is stored as a Walrus blob and receives a replayable blob reference.",
    color: "text-cyan-400",
    glow: "group-hover:shadow-[0_0_30px_-5px_rgba(34,211,238,0.4)]",
    protocol: "walrus" as Protocol,
  },
  {
    num: "04",
    icon: "solar:anchor-line-duotone",
    title: "Anchor on Sui",
    desc: "Trace hash, blob ID, job ID, and owner are anchored as lightweight proof metadata.",
    color: "text-cyan-500",
    glow: "group-hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.4)]",
    protocol: "sui" as Protocol,
  },
  {
    num: "05",
    icon: "solar:verified-check-line-duotone",
    title: "Verify Proof",
    desc: "The app reads the Walrus blob, recomputes hashes, and verifies the Sui proof through Tatum RPC.",
    color: "text-emerald-400",
    glow: "group-hover:shadow-[0_0_30px_-5px_rgba(52,211,153,0.4)]",
    protocol: "tatum" as Protocol,
  },
];

export function ProofPipeline() {
  return (
    <div className="relative">
      {/* Horizontal connecting line hidden on mobile, visible on lg */}
      <div className="absolute top-24 left-10 right-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent hidden lg:block" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {STEPS.map((step, i) => (
          <GlassCard
            key={step.num}
            className={`group relative p-7 overflow-hidden transition-all duration-500 hover:-translate-y-2 ${step.glow}`}
            style={{ transitionDelay: `${i * 0.05}s` }}
          >
            {/* Soft background glow on hover */}
            <div className="absolute -inset-2 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2rem]" />
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <span className="font-mono text-xs text-zinc-600 bg-[#050507] px-2 py-1 rounded-md border border-white/5">{step.num}</span>
                {step.protocol ? (
                  <ProtocolLogo
                    protocol={step.protocol}
                    size="lg"
                    className="transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
                  />
                ) : (
                  <div className={`h-10 w-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                    <iconify-icon
                      icon={step.icon}
                      className={`text-2xl ${step.color} transition-colors`}
                    />
                  </div>
                )}
              </div>
              
              <h3 className="text-base font-medium text-white tracking-tight mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-400 transition-all">
                {step.title}
              </h3>
              <p className="text-sm font-light text-zinc-500 leading-relaxed mt-auto group-hover:text-zinc-400 transition-colors">
                {step.desc}
              </p>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
