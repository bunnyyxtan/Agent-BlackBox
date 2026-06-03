import { Braces, Boxes, Database, KeyRound, Network, Waves } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import { getTatumMcpStatus } from "@/lib/mcp/tatum-mcp";

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
    detail: "Phase 2B read-only, allowlisted proof object, transaction, and event verification through Tatum RPC.",
    icon: Network,
  },
  {
    title: "Tatum-Managed Walrus Adapter",
    detail: "Optional managed Walrus upload path. It does not replace direct Walrus blob verification.",
    icon: Database,
  },
  {
    title: "Tatum MCP",
    detail: "Active EVM and multichain analyzer provider through Tatum Blockchain MCP tools.",
    icon: Braces,
  },
  {
    title: "Privacy Layer",
    detail: "Future client-aware encryption before public decentralized storage upload.",
    icon: KeyRound,
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

const phaseTwo = [
  "Complete: connect Walrus Mainnet storage through the official SDK Upload Relay.",
  "Complete: persist live Walrus Blob ID and available Object ID references.",
  "Complete: verify direct aggregator reads and trace hashes as the canonical proof path.",
  "Complete: expose a read-only allowlisted Tatum Sui RPC route.",
  "Complete: add the owned Sui Move proof object and creation event package.",
  "Complete: build unsigned proof transactions in the browser and submit them through the connected wallet.",
  "Complete: preserve digest-only anchors as pending and verify their transactions honestly through Tatum RPC.",
  "Complete: compare proof session ID, owner, hashes, Walrus Blob ID, object, transaction, and event.",
  "Current: publish the Move package from a funded Sui Mainnet environment and configure its package ID.",
  "Complete: route EVM and multichain analysis through Tatum Blockchain MCP tools.",
  "Later: encrypt sensitive trace bundles before public storage upload.",
];

export default async function DeveloperPage() {
  const tatumMcp = await getTatumMcpStatus();
  return (
    <>
      <div>
        <p className="eyebrow">Implementation Blueprint</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Developer Architecture
        </h1>
        <p className="muted mt-2 max-w-3xl">
          Phase 2D hardens the Sui Mainnet handoff: the browser wallet signs anchors, digest-only
          results remain visibly pending, and read-only Tatum RPC reports full success only after the
          complete proof bundle matches.
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
                className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 font-mono text-xs text-slate-400"
                key={route}
              >
                {route}
              </div>
            ))}
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="eyebrow">Integration Roadmap</p>
          <h2 className="mt-2 text-base font-semibold text-white">Integration checklist</h2>
          <ol className="mt-4 space-y-2">
            {phaseTwo.map((item, index) => (
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
          <p className="eyebrow">Data Model</p>
          <h2 className="mt-2 text-base font-semibold text-white">AgentSession evidence bundle</h2>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            Session metadata, input files, deterministic AgentTrace, StorageReference,
            WalrusVerification, ProofMetadata, TatumRpcVerification, and VerificationResult are kept
            as typed boundaries.
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
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0" key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="max-w-[70%] break-words text-right font-mono text-slate-300">{value}</dd>
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

