import React from "react";

export function AnimatedBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-ink selection:bg-indigo-500/30">
      {/* 
        1. Base Texture / Grain
        A subtle noise layer to give the dark background some physical depth 
      */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-20 mix-blend-overlay grain"></div>

      {/* 
        2. Dynamic Cursor Field
        Follows the mouse position (set via CSS variables in CursorGlow) 
      */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{
          background: "radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(99, 102, 241, 0.08), transparent 40%)",
        }}
      />

      {/* 
        3. Ambient Glows
        Static/floating soft radial gradients for premium depth 
      */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden flex items-center justify-center">
        <div className="absolute top-[-10%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-indigo-900/10 blur-[120px] animate-float"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-cyan-900/5 blur-[150px] animate-pulse-glow"></div>
      </div>

      {/* Main Content Layer */}
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
}
