"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "./GlassCard";
import { ProtocolLogo, type Protocol } from "./ProtocolLogo";

const STEPS = [
  { id: 1, label: "Task Received", icon: "solar:inbox-in-line-duotone", color: "text-zinc-300" },
  { id: 2, label: "Agent Planning", icon: "solar:brain-line-duotone", color: "text-indigo-400" },
  { id: 3, label: "Tool Calls Recorded", icon: "solar:settings-bold-duotone", color: "text-indigo-400" },
  { id: 4, label: "Output Generated", icon: "solar:document-text-line-duotone", color: "text-indigo-300" },
  { id: 5, label: "Trace Sealed", icon: "solar:lock-keyhole-line-duotone", color: "text-zinc-300" },
  { id: 6, label: "Walrus Stored", icon: "solar:box-line-duotone", color: "text-cyan-400", protocol: "walrus" as Protocol },
  { id: 7, label: "Sui Anchored", icon: "solar:waterdrop-line-duotone", color: "text-cyan-500", protocol: "sui" as Protocol },
  { id: 8, label: "Verified", icon: "solar:check-circle-bold-duotone", color: "text-emerald-400" },
];

export function LiveAgentProcess() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <GlassCard className="p-5 sm:p-6 w-full max-w-sm relative overflow-hidden group">
      {/* Soft background glow based on current step */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[50px] transition-all duration-700" />
      
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400">Live Session</h3>
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
      </div>

      <div className="relative space-y-4">
        {/* Animated trace line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/5">
          <div 
            className="w-full bg-gradient-to-b from-indigo-500/0 via-indigo-400 to-cyan-400/0 transition-all duration-700 ease-out"
            style={{ 
              height: '30%',
              transform: `translateY(${activeStep * (100 / STEPS.length)}%)` 
            }}
          />
        </div>

        {STEPS.map((step, index) => {
          const isActive = index === activeStep;
          const isPast = index < activeStep;

          return (
            <div key={step.id} className="relative flex items-center gap-4 pl-8">
              {/* Status Dot */}
              <div 
                className={`absolute left-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-500 bg-[#050507]
                  ${isActive ? 'border-indigo-400 scale-110 shadow-[0_0_15px_-3px_rgba(129,140,248,0.5)]' : 
                    isPast ? 'border-white/20' : 'border-white/5'}`}
              >
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>}
                {isPast && <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>}
              </div>

              {/* Step Content */}
              <div className={`flex items-center gap-3 transition-all duration-500 ${isActive ? 'opacity-100 translate-x-1' : isPast ? 'opacity-50' : 'opacity-20'}`}>
                {step.protocol ? (
                  <ProtocolLogo
                    protocol={step.protocol}
                    size="sm"
                    className={isActive ? "" : "opacity-70 grayscale"}
                  />
                ) : (
                  <iconify-icon icon={step.icon} className={`text-lg ${isActive ? step.color : 'text-zinc-500'}`}></iconify-icon>
                )}
                <span className={`text-sm ${isActive ? 'font-medium text-white' : 'font-light text-zinc-400'}`}>
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
