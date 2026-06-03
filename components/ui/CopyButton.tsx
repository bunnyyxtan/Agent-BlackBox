"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({
  className,
  value,
  label = "Copy",
  compact = false,
}: {
  className?: string;
  value: string;
  label?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        (compact
          ? "inline-flex min-h-8 items-center gap-1 rounded-full px-1 text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-cyan transition hover:text-white sm:min-h-0 sm:px-0"
          : "button-secondary")
      }
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}
