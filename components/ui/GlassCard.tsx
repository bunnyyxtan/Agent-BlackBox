import type { HTMLAttributes, PropsWithChildren } from "react";

type GlassCardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export function GlassCard({ className = "", children, ...props }: GlassCardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
