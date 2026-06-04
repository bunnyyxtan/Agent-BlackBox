import { KeyRound, Settings2 } from "lucide-react";

import { ReadinessPanel } from "@/components/blackbox/ReadinessPanel";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo, type Protocol } from "@/components/ui/ProtocolLogo";
import { formatStatusLabel, StatusBadge } from "@/components/ui/StatusBadge";
import { getNetworkConfig } from "@/lib/network-config";
import { getSessionStorageDiagnostics } from "@/lib/session-service";
import { getSuiProofRegistryConfig } from "@/lib/sui-proof";
import { getTatumSuiRpcConfig } from "@/lib/tatum-rpc";
import { getWalrusConfiguration, getWalrusNetworkLabel } from "@/lib/walrus";

const env = process.env;

export const dynamic = "force-dynamic";

function formatStorageMethod(provider?: string) {
  if (!provider || provider === "walrus_sdk_relay") return "Walrus SDK Upload Relay";
  if (provider === "walrus_direct") return "Walrus Direct Publisher";
  if (provider === "tatum_walrus") return "Tatum Walrus Adapter";
  if (provider === "local") return "Local Trace Store";
  return "Configured storage adapter";
}

const SETTINGS_BADGE_LABELS = new Set([
  "Agent Runtime",
  "Storage Method",
  "Sui network",
  "Sui Proof Contract",
  "Tatum API key present",
  "Tatum Sui RPC",
  "Tatum Sui RPC network",
  "Tatum Sui RPC network match",
  "Session storage backend",
  "Durable session storage",
  "Supabase URL present",
  "Supabase service role present",
  "Supabase table reachable",
  "Walrus network",
]);

function shouldRenderSettingsBadge(label: string, value: string) {
  if (SETTINGS_BADGE_LABELS.has(label)) return true;
  return /configuration pending/i.test(value);
}

export default async function SettingsPage() {
  const network = getNetworkConfig();
  const walrus = getWalrusConfiguration();
  const proofRegistry = getSuiProofRegistryConfig();
  const tatumRpc = getTatumSuiRpcConfig();
  const storageDiagnostics = await getSessionStorageDiagnostics();
  const rows = [
    { label: "Agent Runtime", value: env.OPENAI_API_KEY ? "Configured" : "Not Configured" },
    { label: "Tatum Sui RPC", value: tatumRpc.configured ? "Configured" : "Not Configured", protocol: "tatum" as Protocol },
    { label: "Tatum Sui RPC network", value: formatStatusLabel(tatumRpc.network), protocol: "tatum" as Protocol },
    { label: "Tatum Sui RPC URL host", value: tatumRpc.rpcHost, protocol: "tatum" as Protocol },
    { label: "Tatum Sui RPC network match", value: tatumRpc.rpcNetworkMismatch ? "Mismatch" : "Matched", protocol: "tatum" as Protocol },
    { label: "Tatum API key present", value: tatumRpc.apiKeyConfigured ? "Yes" : "No", protocol: "tatum" as Protocol },
    { label: "Session storage backend", value: storageDiagnostics.backend },
    { label: "Durable session storage", value: storageDiagnostics.durable ? "Enabled" : "Local Only" },
    { label: "Supabase URL present", value: storageDiagnostics.supabaseUrlPresent ? "Yes" : "No" },
    { label: "Supabase service role present", value: storageDiagnostics.supabaseServiceRolePresent ? "Yes" : "No" },
    {
      label: "Supabase table reachable",
      value: storageDiagnostics.tableReachable === null ? "Not Checked" : storageDiagnostics.tableReachable ? "Yes" : "No",
    },
    { label: "Storage Method", value: formatStorageMethod(walrus.provider), protocol: "walrus" as Protocol },
    { label: "Sui network", value: network.displayNetwork, protocol: "sui" as Protocol },
    { label: "Sui Proof Contract", value: proofRegistry.configured ? "Configured" : "Not Configured", protocol: "sui" as Protocol },
    { label: "Sui proof package ID", value: proofRegistry.packageId || "Configuration pending", protocol: "sui" as Protocol },
    { label: "Sui proof module", value: proofRegistry.moduleName, protocol: "sui" as Protocol },
    { label: "Sui explorer base", value: network.suiExplorerBaseUrl, protocol: "sui" as Protocol },
    { label: "Walrus network", value: getWalrusNetworkLabel(walrus.network), protocol: "walrus" as Protocol },
    { label: "Walrus Upload Relay", value: walrus.relayUrl || "Configuration pending", protocol: "walrus" as Protocol },
    { label: "Walrus Aggregator", value: walrus.aggregatorUrl || "Configuration pending", protocol: "walrus" as Protocol },
    { label: "Walrus storage epochs", value: env.WALRUS_STORAGE_EPOCHS ?? "1", protocol: "walrus" as Protocol },
  ];

  return (
    <>
      <div>
        <p className="eyebrow">Integration Controls</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Settings
        </h1>
        <p className="muted mt-2">Review the server-side integration posture without exposing secrets.</p>
      </div>

      <GlassCard className="mt-6 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4">
          <span className="rounded-lg border border-cyan/15 bg-cyan/[0.08] p-2 text-cyan">
            <Settings2 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Environment configuration</h2>
            <p className="mt-0.5 text-xs text-slate-500">Secret values are never rendered in the client.</p>
          </div>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map(({ label, protocol, value }) => (
            <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[13rem_1fr] sm:items-center" key={label}>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                {protocol && <ProtocolLogo protocol={protocol} size="sm" />}
                {label}
              </span>
              {shouldRenderSettingsBadge(label, value) ? (
                <div className="flex min-w-0 justify-start sm:justify-end">
                  <StatusBadge status={value} />
                </div>
              ) : (
                <span className="min-w-0 break-all font-mono text-xs text-slate-300 sm:text-right">{value}</span>
              )}
            </div>
          ))}
        </div>
      </GlassCard>

      <ReadinessPanel />

      <GlassCard className="mt-5 border-amber-200/15 bg-amber-200/[0.035] p-4">
        <div className="flex items-start gap-2">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-100" />
          <p className="text-xs leading-5 text-slate-400">
            Tatum API keys and RPC credentials remain server-side. Proof signing stays in the
            connected browser wallet and does not use private-key environment variables.
          </p>
        </div>
      </GlassCard>

      {!storageDiagnostics.durable ? (
        <GlassCard className="mt-5 border-amber-200/15 bg-amber-200/[0.035] p-4">
          <p className="text-xs leading-5 text-slate-400">
            Local session storage is for controlled evaluation only and is not serverless-safe. Configure Supabase
            for durable production session storage.
          </p>
        </GlassCard>
      ) : null}
    </>
  );
}

