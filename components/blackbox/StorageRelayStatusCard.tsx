"use client";

import { useEffect, useState } from "react";

import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo } from "@/components/ui/ProtocolLogo";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { readJsonResponse } from "@/lib/http/safe-json";

interface RelayStatusPayload {
  data?: {
    relayReachable?: boolean;
    tipRequirement?: string;
    error?: string;
  };
  message?: string;
}

interface StorageRelayStatusCardProps {
  aggregatorConfigured: boolean;
  relayConfigured: boolean;
  walrusNetworkLabel: string;
}

export function StorageRelayStatusCard({
  aggregatorConfigured,
  relayConfigured,
  walrusNetworkLabel,
}: StorageRelayStatusCardProps) {
  const [checking, setChecking] = useState(relayConfigured);
  const [relayReachable, setRelayReachable] = useState<boolean | null>(relayConfigured ? null : false);
  const [tipRequirement, setTipRequirement] = useState(relayConfigured ? "checking" : "unknown");
  const [message, setMessage] = useState(
    relayConfigured
      ? "Checking Walrus upload relay after page load."
      : "Walrus Mainnet upload relay is not configured.",
  );

  useEffect(() => {
    if (!relayConfigured) return;
    let cancelled = false;

    async function loadRelayStatus() {
      try {
        const response = await fetch("/api/storage/relay-status", { cache: "no-store" });
        const payload = await readJsonResponse<RelayStatusPayload>(response, "GET /api/storage/relay-status");
        if (cancelled) return;
        setRelayReachable(Boolean(payload.data?.relayReachable));
        setTipRequirement(payload.data?.tipRequirement ?? "unknown");
        setMessage(payload.data?.error ?? payload.message ?? "Walrus upload relay status loaded.");
      } catch (error) {
        if (cancelled) return;
        setRelayReachable(false);
        setTipRequirement("unknown");
        setMessage(error instanceof Error ? error.message : "Walrus upload relay status could not be loaded.");
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void loadRelayStatus();
    return () => {
      cancelled = true;
    };
  }, [relayConfigured]);

  const relayStatus = checking ? "Checking" : relayReachable ? "Reachable" : relayConfigured ? "Not Confirmed" : "Missing";
  const aggregatorStatus = aggregatorConfigured ? "Configured" : "Missing";
  const tipStatus = checking
    ? "Checking"
    : tipRequirement === "no_tip"
      ? "Not Required"
      : tipRequirement === "send_tip"
        ? "Available"
        : "Unknown";

  return (
    <GlassCard className="mt-6 border-cyan/15 bg-cyan/[0.04] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <ProtocolLogo protocol="walrus" size="md" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">Walrus SDK Relay architecture</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Agent BlackBox stores trace bundles on {walrusNetworkLabel} through the official SDK
            Upload Relay. Connected wallets pay storage and gas; relay status loads after navigation
            so the storage page is never blocked by network checks.
          </p>
          <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-3">
            <span className="flex flex-wrap items-center gap-2">
              Upload Relay:
              <StatusBadge status={relayStatus} size="sm" />
            </span>
            <span className="flex flex-wrap items-center gap-2">
              Aggregator:
              <StatusBadge status={aggregatorStatus} size="sm" />
            </span>
            <span className="flex flex-wrap items-center gap-2">
              Tip:
              <StatusBadge status={tipStatus} size="sm" />
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-cyan/80 [overflow-wrap:anywhere]">{message}</p>
        </div>
      </div>
    </GlassCard>
  );
}
