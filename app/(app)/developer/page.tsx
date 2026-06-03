import { Braces, Boxes, Database, Network, Waves } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo } from "@/components/ui/ProtocolLogo";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getTatumMcpStatus } from "@/lib/mcp/tatum-mcp";
import { getUploadRelayTipConfig } from "@/lib/storage-adapters/walrus-sdk-relay";
import { checkTatumSuiRpcReachability, getTatumSuiRpcConfig } from "@/lib/tatum-rpc";
import { getWalrusConfiguration, getWalrusNetworkLabel } from "@/lib/walrus";

export const dynamic = "force-dynamic";

const architecture = [
  {
    title: "Walrus SDK Relay Storage",
    detail: "Canonical Mainnet blob storage through the official SDK Upload Relay with wallet-paid storage and gas.",
    icon: Database,
  },
  {
    title: "Direct Walrus",
    detail: "Aggregator read, availability, replay, and trace-hash comparison using Blob ID and Object ID.",
    icon: Waves,
  },
  {
    title: "Sui Proof Registry",
    detail: "Owned proof object with wallet signing, explicit pending-object state, and mainnet-ready anchor status.",
    icon: Boxes,
  },
  {
    title: "Tatum Sui RPC",
    detail: "Read-only, allowlisted proof object, transaction, and event verification through Tatum RPC.",
    icon: Network,
  },
  {
    title: "Tatum MCP",
    detail: "Active EVM and multichain analyzer provider through Tatum Blockchain MCP tools.",
    icon: Braces,
  },
];

const apiRoutes = [
  "POST /api/agent/run",
  "POST /api/agent/prepare",
  "POST /api/storage/upload",
  "GET  /api/storage/relay-status",
  "GET  /api/storage/status/[uploadJobId]",
  "GET  /api/storage/list",
  "POST /api/storage/cancel-renewal",
  "POST /api/storage/delete",
  "GET  /api/storage/read/[blobId]",
  "POST /api/storage/verify/[blobId]",
  "GET  /api/walrus/read/[blobId]",
  "POST /api/walrus/verify/[blobId]",
  "POST /api/tatum/rpc",
  "POST /api/sui/verify-proof",
  "POST /api/sessions/[id]/proof-anchor",
  "POST /api/sessions/[id]/storage-finalize",
  "GET  /api/verify/[id]",
  "POST /api/mcp/verify",
];

const integrationChecklist = [
  "Walrus Mainnet storage uses the official SDK Upload Relay.",
  "Live Walrus Blob ID and available Object ID references are persisted.",
  "Direct aggregator reads and trace hashes are verified as the canonical storage proof path.",
  "Tatum Sui RPC is exposed through a read-only allowlisted server route.",
  "Sui proof anchors are signed in the browser by the connected wallet.",
  "Digest-only anchors remain pending until object or event verification succeeds.",
  "Proof verification compares session ID, owner, hashes, Walrus Blob ID, object, transaction, and event fields.",
  "EVM and multichain analysis use Tatum Blockchain MCP only when explicitly enabled.",
];

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function getTatumRpcStatus(
  tatumRpc: ReturnType<typeof getTatumSuiRpcConfig>,
  reachability: Awaited<ReturnType<typeof checkTatumSuiRpcReachability>>,
) {
  if (!tatumRpc.apiKeyConfigured) return "Missing API Key";
  if (tatumRpc.rpcNetworkMismatch) return "Mismatch";
  if (!tatumRpc.rpcUrlConfigured) return "Not Configured";
  return reachability.reachable ? "Ready" : "Unavailable";
}

export default async function DeveloperPage() {
  const [tatumMcp, tatumRpcReachability, walrusRelay] = await Promise.all([
    getTatumMcpStatus(),
    checkTatumSuiRpcReachability(),
    getUploadRelayTipConfig(),
  ]);
  const tatumRpc = getTatumSuiRpcConfig();
  const walrus = getWalrusConfiguration();
  const tatumRpcRows = [
    ["Status", getTatumRpcStatus(tatumRpc, tatumRpcReachability)],
    ["Network", tatumRpc.network === "sui-mainnet" ? "Sui Mainnet" : "Sui Testnet"],
    ["RPC host", tatumRpc.rpcHost],
    ["API key present", yesNo(tatumRpc.apiKeyConfigured)],
    ["Read allowlist", "sui_getObject, sui_getTransactionBlock, suix_queryEvents"],
    ["Last check", tatumRpcReachability.checkedAt],
    ["Last result", tatumRpcReachability.message],
  ];
  const walrusRows = [
    ["Storage method", "Walrus SDK Upload Relay"],
    ["Network", getWalrusNetworkLabel(walrus.network)],
    ["Upload relay", walrus.relayUrl || "Not Configured"],
    ["Aggregator", walrus.aggregatorUrl || "Not Configured"],
    ["Relay reachable", walrusRelay.reachable ? "Reachable" : "Unavailable"],
    ["Relay tip", walrusRelay.tipRequirement === "send_tip" ? "Available" : walrusRelay.tipRequirement === "no_tip" ? "Not Required" : "Unavailable"],
    ["Last check", walrusRelay.checkedAt],
  ];

  return (
    <>
      <div>
        <p className="eyebrow">Implementation Blueprint</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Developer Architecture
        </h1>
        <p className="muted mt-2 max-w-3xl">
          The browser wallet signs Sui Mainnet anchors, digest-only results remain visibly pending,
          and read-only Tatum RPC reports full success only after the complete proof bundle matches.
        </p>
      </div>

      <section className="mt-7">
        <h2 className="text-base font-semibold text-white">Architecture layers</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {architecture.map(({ title, detail, icon: Icon }) => (
            <GlassCard className="p-4" key={title}>
              <Icon className="h-4 w-4 text-cyan" />
              <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">{detail}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <GlassCard className="p-5">
          <p className="eyebrow">Server Boundary</p>
          <h2 className="mt-2 text-base font-semibold text-white">API routes</h2>
          <div className="mt-4 space-y-1.5">
            {apiRoutes.map((route) => (
              <div
                className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 font-mono text-xs text-slate-400 [overflow-wrap:anywhere]"
                key={route}
              >
                {route}
              </div>
            ))}
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="eyebrow">Operational Readiness</p>
          <h2 className="mt-2 text-base font-semibold text-white">Integration checklist</h2>
          <ol className="mt-4 space-y-2">
            {integrationChecklist.map((item, index) => (
              <li className="flex gap-3 text-xs leading-5 text-slate-400" key={item}>
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-cyan/20 bg-cyan/[0.07] font-mono text-[0.65rem] text-cyan">
                  {index + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </GlassCard>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <GlassCard className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <ProtocolLogo protocol="tatum" size="md" />
              <div>
                <p className="eyebrow">Tatum Sui RPC Diagnostics</p>
                <h2 className="mt-1 text-base font-semibold text-white">Proof-read readiness</h2>
              </div>
            </div>
            <div className="flex shrink-0 justify-start sm:justify-end">
              <StatusBadge status={getTatumRpcStatus(tatumRpc, tatumRpcReachability)} />
            </div>
          </div>
          <dl className="mt-4 space-y-3 text-xs">
            {tatumRpcRows.map(([label, value]) => (
              <div className="flex flex-col gap-1 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3" key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-mono text-slate-300 [overflow-wrap:anywhere] sm:max-w-[70%] sm:text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>

        <GlassCard className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <ProtocolLogo protocol="walrus" size="md" />
              <div>
                <p className="eyebrow">Walrus Proof Storage</p>
                <h2 className="mt-1 text-base font-semibold text-white">Blob-read readiness</h2>
              </div>
            </div>
            <div className="flex shrink-0 justify-start sm:justify-end">
              <StatusBadge status={walrus.relayConfigured && walrus.aggregatorUrl ? "Configured" : "Not Configured"} />
            </div>
          </div>
          <dl className="mt-4 space-y-3 text-xs">
            {walrusRows.map(([label, value]) => (
              <div className="flex flex-col gap-1 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3" key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-mono text-slate-300 [overflow-wrap:anywhere] sm:max-w-[70%] sm:text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <GlassCard className="p-5">
          <p className="eyebrow">Data Model</p>
          <h2 className="mt-2 text-base font-semibold text-white">AgentSession evidence bundle</h2>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            Session metadata, input files, deterministic AgentTrace, StorageReference,
            WalrusVerification, ProofMetadata, TatumRpcVerification, and VerificationResult are kept
            as typed boundaries. Local JSON session storage is intended for controlled evaluation and is not serverless-safe.
          </p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="eyebrow">Tatum MCP Diagnostics</p>
          <h2 className="mt-2 text-base font-semibold text-white">EVM provider status</h2>
          <dl className="mt-4 space-y-3 text-xs">
            {[
              ["Status", tatumMcp.message],
              ["Node version", tatumMcp.nodeVersion ?? "Not available"],
              ["MCP enabled", tatumMcp.enabled ? "Yes" : "No"],
              ["API key present", tatumMcp.apiKeyPresent ? "Yes" : "No"],
              ["Package available", tatumMcp.status === "package_unavailable" ? "No" : "Yes"],
              ["Command", tatumMcp.command],
              ["Package", tatumMcp.packageName],
              ["Server", tatumMcp.serverName],
              ...(tatumMcp.availableTools?.length
                ? [["Available tools", tatumMcp.availableTools.join(", ")]]
                : []),
              ["Last check", tatumMcp.checkedAt],
              ...(tatumMcp.details ? [["Last safe error", tatumMcp.details]] : []),
            ].map(([label, value]) => (
              <div className="flex flex-col gap-1 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3" key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-mono text-slate-300 [overflow-wrap:anywhere] sm:max-w-[70%] sm:text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <GlassCard className="p-5">
          <p className="eyebrow">Contract Plan</p>
          <h2 className="mt-2 text-base font-semibold text-white">Sui AgentSessionProof object</h2>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            The Move package stores lightweight proof metadata only: owner, session ID, mode, hashes,
            Walrus references, upload references, timestamp, and anchor status.
          </p>
        </GlassCard>
      </div>
    </>
  );
}

