"use client";

import { useEffect, useState } from "react";
import { Activity, ShieldCheck } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo, type Protocol } from "@/components/ui/ProtocolLogo";
import { formatStatusLabel, StatusBadge } from "@/components/ui/StatusBadge";

interface ReadinessPayload {
  data?: {
    agentRuntimeKeyPresent: boolean;
    tatumKeyPresent: boolean;
    tatumRpcConfigured: boolean;
    tatumRpcReachable: boolean;
    tatumRpcMessage: string;
    tatumMcpStatus: "disabled" | "configured" | "missing_api_key" | "package_unavailable" | "runtime_unavailable";
    tatumMcpMessage: string;
    tatumMcpApiKeyPresent: boolean;
    walrusRelayConfigured: boolean;
    walrusRelayReachable: boolean;
    walrusRelayTipRequirement: "send_tip" | "no_tip" | "unknown";
    walrusAggregatorConfigured: boolean;
    suiPackageConfigured: boolean;
    currentNetwork: string;
    walrusNetwork: string;
    lastAgentRunStatus: string;
    lastWalrusBlobHashStatus: string;
  };
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function formatWalrusRelayStatus(data: ReadinessPayload["data"]) {
  if (!data?.walrusRelayConfigured) return "Not Configured";
  return data.walrusRelayReachable ? "Reachable" : "Unavailable";
}

function formatWalrusRelayTip(data: ReadinessPayload["data"]) {
  if (!data?.walrusRelayConfigured) return "Not required";
  if (!data.walrusRelayReachable) return "Unavailable";
  if (data.walrusRelayTipRequirement === "send_tip") return "Available";
  if (data.walrusRelayTipRequirement === "no_tip") return "Not required";
  return "Unavailable";
}

function formatTatumMcpStatus(data: ReadinessPayload["data"]) {
  if (!data) return "Checking...";
  if (data.tatumMcpStatus === "configured") return "Configured";
  if (data.tatumMcpStatus === "missing_api_key") return "Missing API Key";
  if (data.tatumMcpStatus === "package_unavailable") return "Package Unavailable";
  if (data.tatumMcpStatus === "runtime_unavailable") return "Runtime Unavailable";
  return "Disabled";
}

function shouldRenderReadinessBadge(value: string) {
  return /^(yes|no|ready|failed|pending|checking\.\.\.|configured|not configured|reachable|unavailable|available|not required|matched|mismatch|missing api key|package unavailable|runtime unavailable|disabled|walrus verified|sui anchored|sample trace|prepared)$/i.test(value);
}

export function ReadinessPanel() {
  const [data, setData] = useState<ReadinessPayload["data"] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadReadiness() {
      try {
        const response = await fetch("/api/readiness", { cache: "no-store" });
        const payload = (await response.json()) as ReadinessPayload;
        if (!cancelled) setData(payload.data ?? null);
      } catch (readinessError) {
        if (!cancelled) {
          setError(readinessError instanceof Error ? readinessError.message : "Readiness status could not be loaded.");
        }
      }
    }
    void loadReadiness();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = data
    ? [
        { label: "Agent Runtime key present", value: yesNo(data.agentRuntimeKeyPresent) },
        { label: "Tatum key present", value: yesNo(data.tatumKeyPresent), protocol: "tatum" as Protocol },
        { label: "Tatum RPC reachable", value: yesNo(data.tatumRpcReachable), protocol: "tatum" as Protocol },
        { label: "Tatum MCP Tools", value: formatTatumMcpStatus(data), protocol: "tatum" as Protocol },
        { label: "Tatum MCP API key present", value: yesNo(data.tatumMcpApiKeyPresent), protocol: "tatum" as Protocol },
        { label: "Walrus Upload Relay", value: formatWalrusRelayStatus(data), protocol: "walrus" as Protocol },
        { label: "Walrus relay tip", value: formatWalrusRelayTip(data), protocol: "walrus" as Protocol },
        { label: "Walrus Aggregator", value: data.walrusAggregatorConfigured ? "Configured" : "Not Configured", protocol: "walrus" as Protocol },
        { label: "Sui package ID configured", value: yesNo(data.suiPackageConfigured), protocol: "sui" as Protocol },
        { label: "Current network", value: formatStatusLabel(data.currentNetwork), protocol: "sui" as Protocol },
        { label: "Walrus network", value: formatStatusLabel(data.walrusNetwork), protocol: "walrus" as Protocol },
        { label: "Last agent run status", value: data.lastAgentRunStatus },
        { label: "Last Walrus blob/hash status", value: data.lastWalrusBlobHashStatus, protocol: "walrus" as Protocol },
      ]
    : [
        { label: "Tatum RPC reachable", value: error ? "Unavailable" : "Checking...", protocol: "tatum" as Protocol },
        { label: "Tatum MCP Tools", value: error ? "Unavailable" : "Checking...", protocol: "tatum" as Protocol },
        { label: "Walrus Upload Relay", value: error ? "Unavailable" : "Checking...", protocol: "walrus" as Protocol },
        { label: "Walrus relay tip", value: error ? "Unavailable" : "Checking...", protocol: "walrus" as Protocol },
      ];

  return (
    <GlassCard className="mt-5 overflow-hidden border-indigo-400/15 bg-indigo-500/[0.025]">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-indigo-300/15 bg-indigo-300/[0.07] p-2 text-indigo-200">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Deployment readiness</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Server-side checks load after navigation and never print secrets.
            </p>
          </div>
        </div>
        <StatusBadge status={data ? "Ready" : error ? "Failed" : "Pending"} />
      </div>

      {data || !error ? (
        <div className="divide-y divide-white/[0.06]">
          {rows.map(({ label, protocol, value }) => (
            <div className="grid gap-1 px-5 py-3 sm:grid-cols-[13rem_1fr] sm:items-center" key={label}>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                {protocol && <ProtocolLogo protocol={protocol} size="sm" />}
                {label}
              </span>
              {shouldRenderReadinessBadge(value) ? (
                <StatusBadge status={value} />
              ) : (
                <span className="break-all font-mono text-xs text-slate-300">{value}</span>
              )}
            </div>
          ))}
          <div className="px-5 py-3">
            <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-300" />
              {data ? `${data.tatumRpcMessage} ${data.tatumMcpMessage}` : "Readiness checks are running..."}
            </p>
          </div>
        </div>
      ) : (
        <div className="px-5 py-5">
          <p className="text-xs leading-5 text-slate-500">
            {error || "Loading readiness checks..."}
          </p>
        </div>
      )}
    </GlassCard>
  );
}
