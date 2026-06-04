"use client";

import { Check, Clipboard, ExternalLink, FileJson, FileText, Fingerprint } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { CopyButton } from "@/components/ui/CopyButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo } from "@/components/ui/ProtocolLogo";
import { formatStatusLabel, StatusBadge } from "@/components/ui/StatusBadge";
import { AGENT_MODE_LABELS, formatDate, getSessionEvidenceStatus, shortHash } from "@/lib/constants";
import { buildSuiExplorerUrl } from "@/lib/sui-explorer";
import { formatProofStatus } from "@/lib/tatum-rpc-labels";
import type { AgentFindingSeverity } from "@/lib/agents/types";
import type {
  SpecialistAgentReport,
  SpecialistReportMetric,
} from "@/lib/agents/specialist-report";
import type { AgentSession } from "@/types/blackbox";

type StructuredReport = NonNullable<AgentSession["trace"]["structuredOutput"]>;
type OnchainAnalysis = NonNullable<StructuredReport["onchainAnalysis"]>;

const severityClasses: Record<AgentFindingSeverity, string> = {
  info: "border-cyan/20 bg-cyan/[0.07] text-cyan",
  low: "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200",
  medium: "border-amber-300/20 bg-amber-300/[0.07] text-amber-200",
  high: "border-orange-300/25 bg-orange-300/[0.08] text-orange-200",
  critical: "border-red-300/25 bg-red-300/[0.08] text-red-200",
};

const metricToneClasses: Record<SpecialistReportMetric["tone"], string> = {
  neutral: "border-white/[0.07] bg-white/[0.025] text-slate-300",
  success: "border-emerald-300/20 bg-emerald-300/[0.055] text-emerald-100",
  warning: "border-amber-300/20 bg-amber-300/[0.055] text-amber-100",
  danger: "border-red-300/20 bg-red-300/[0.055] text-red-100",
};
const LEGACY_PROVIDER_PATTERN = new RegExp(`\\b(moralis|alchemy|covalent|chainbase|${"ether"}${"scan"})\\b`, "i");
const DEBUG_PROVIDER_PATTERN = new RegExp(
  `not_configured|api_key|base_url|moralis|alchemy|covalent|chainbase|${"ether"}${"scan"}|${"e"}${"vm"}|live data section`,
  "i",
);

function downloadFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatMarkdownList(items: string[]) {
  if (items.length === 0) return "- Not recorded";
  return items.map((item) => `- ${item}`).join("\n");
}

function isLegacyProviderName(value: string) {
  return LEGACY_PROVIDER_PATTERN.test(value);
}

function getOnchainProviderDisplay(onchain: OnchainAnalysis | undefined) {
  if (!onchain) return "Sui RPC";
  const headerProviders = Array.from(
    new Set(onchain.header.dataSourcesUsed.filter((value) => value && !isLegacyProviderName(value))),
  );
  if (headerProviders.length > 0) return headerProviders.join(", ");
  return onchain.detected.family === "sui" ? "Sui RPC" : "Archived onchain data";
}

function getUserFacingFindings(report: StructuredReport) {
  return report.findings;
}

function getUserFacingOnchainDataSources(onchain: OnchainAnalysis) {
  return onchain.dataSources.filter((source) => !isLegacyProviderName(source.name));
}

function sanitizeOnchainForExport(
  onchain: NonNullable<AgentSession["trace"]["structuredOutput"]>["onchainAnalysis"] | undefined,
) {
  if (!onchain) return undefined;
  return {
    ...onchain,
    header: {
      ...onchain.header,
      dataSourcesUsed: onchain.header.dataSourcesUsed.filter((source) => !isLegacyProviderName(source)),
    },
    dataSources: getUserFacingOnchainDataSources(onchain),
    evidenceStatus: onchain.evidenceStatus.filter((item) => !isDebugProviderText(item)),
  };
}

function sanitizeStructuredReportForExport(
  report: AgentSession["trace"]["structuredOutput"],
) {
  if (!report) return undefined;
  return {
    ...report,
    toolCalls: getVisibleToolCalls(report),
    onchainAnalysis: sanitizeOnchainForExport(report.onchainAnalysis),
  };
}

function formatSpecialistMarkdown(specialist: SpecialistAgentReport) {
  return [
    "",
    "## Specialist Report",
    `- Agent: ${specialist.agent}`,
    `- ${specialist.subjectLabel}: ${specialist.subject}`,
    `- Confidence: ${formatStatusLabel(specialist.confidence)}`,
    `- Generated: ${formatDate(specialist.generatedAt)}`,
    `- Data sources used: ${specialist.dataSourcesUsed.join(", ") || "Sealed task prompt"}`,
    "",
    "### Scorecard",
    specialist.metrics
      .map((metric) => `- ${metric.label}: ${metric.value}`)
      .join("\n") || "- Not recorded",
    "",
    "### Detected Entities",
    formatMarkdownList(specialist.detectedEntities),
    "",
    "### Evidence Bundle",
    specialist.evidenceItems
      .map((item) => `- ${item.label} [${formatStatusLabel(item.type)}, ${formatStatusLabel(item.status)}]: ${item.detail}`)
      .join("\n") || "- No evidence items recorded",
    "",
    "### Report Cards",
    specialist.cards
      .map((card) => {
        const extras = [
          card.status ? `Status: ${formatStatusLabel(card.status)}` : "",
          card.category ? `Category: ${card.category}` : "",
          card.likelihood ? `Likelihood: ${card.likelihood}` : "",
          card.impact ? `Impact: ${card.impact}` : "",
          card.mitigation ? `Mitigation: ${card.mitigation}` : "",
        ].filter(Boolean);
        return [
          `#### ${card.title}`,
          `Severity: ${formatStatusLabel(card.severity)}`,
          `Confidence: ${formatStatusLabel(card.confidence)}`,
          `Evidence: ${card.evidence}`,
          ...extras,
          "",
          card.detail,
        ].join("\n");
      })
      .join("\n\n") || "No report cards recorded.",
    "",
    ...specialist.sections.flatMap((section) => [
      `### ${section.title}`,
      formatMarkdownList(section.items),
      "",
    ]),
    "### Specialist Proof Notes",
    formatMarkdownList(specialist.proofNotes),
  ].join("\n");
}

function buildReportJson(session: AgentSession) {
  const report = sanitizeStructuredReportForExport(session.trace.structuredOutput);
  return {
    reportFormat: "Agent BlackBox Professional Report",
    exportedAt: new Date().toISOString(),
    session: {
      id: session.id,
      title: session.title,
      agentMode: session.agentMode,
      agentLabel: AGENT_MODE_LABELS[session.agentMode],
      createdAt: session.createdAt,
      ownerAddress: session.ownerAddress,
      evidenceStatus: session.status,
      isSample: Boolean(session.isSample),
      sampleLabel: session.sampleLabel,
    },
    report,
    specialistAnalysis: report?.specialistAnalysis,
    onchainAnalysis: report?.onchainAnalysis,
    evidence: {
      prompt: session.prompt,
      files: session.inputFiles,
      inputHash: session.trace.inputHash,
      resultHash: session.trace.resultHash,
      traceHash: session.trace.traceHash,
      toolCalls: report?.toolCalls ?? session.trace.toolCalls,
    },
    storage: session.storage,
    walrusVerification: session.walrusVerification,
    proof: session.proof,
    tatumRpc: session.tatumRpc,
    verification: session.verification,
  };
}

function buildMarkdownReport(session: AgentSession) {
  const report = session.trace.structuredOutput;
  if (!report) return "";
  const files = session.inputFiles.map((file) => `${file.name} (${file.type || "unknown"}, ${file.size} bytes)`);
  const onchain = report.onchainAnalysis;
  const specialist = report.specialistAnalysis;
  const userFacingFindings = getUserFacingFindings(report);
  return [
    `# ${report.agentDisplayName} Report`,
    "",
    `Session: ${session.id}`,
    `Title: ${session.title}`,
    ...(session.isSample
      ? [
          "Sample trace: Yes",
          "Sample boundary: This exported report is for demonstration only and is not a wallet-signed proof.",
        ]
      : []),
    `Agent mode: ${AGENT_MODE_LABELS[session.agentMode]}`,
    `Created: ${formatDate(session.createdAt)}`,
    `Owner wallet: ${session.ownerAddress ?? "Not recorded"}`,
    ...(onchain
      ? [
          "",
          "## Chain Detection",
          `- Agent: ${onchain.header.agent}`,
          `- Detected chain: ${formatStatusLabel(onchain.header.detectedChain)}`,
          `- Target type: ${formatStatusLabel(onchain.header.targetType)}`,
          `- Target: ${onchain.header.target ?? "Not supplied"}`,
          `- Confidence: ${formatStatusLabel(onchain.header.confidence)}`,
          `- Enrichment status: ${formatStatusLabel(onchain.header.enrichmentStatus)}`,
          `- Provider: ${getOnchainProviderDisplay(onchain)}`,
          `- Assumptions: ${onchain.detected.assumptions.length > 0 ? onchain.detected.assumptions.join(" ") : "None"}`,
        ]
      : []),
    ...(specialist ? [formatSpecialistMarkdown(specialist)] : []),
    "",
    "## Executive Summary",
    report.executiveSummary,
    "",
    "## Evidence Reviewed",
    `- User prompt: ${session.prompt}`,
    `- Input files: ${files.length > 0 ? files.join("; ") : "None supplied"}`,
    `- Input hash: ${session.trace.inputHash}`,
    `- Result hash: ${session.trace.resultHash}`,
    `- Trace hash: ${session.trace.traceHash}`,
    "",
    "## Agent Plan",
    report.plan.map((step) => `${step.step}. ${step.title} - ${step.reasoningSummary}`).join("\n"),
    "",
    "## Findings",
    userFacingFindings
      .map(
        (finding) =>
          `### ${finding.title}\nSeverity: ${formatStatusLabel(finding.severity)}\nEvidence: ${finding.evidence}\n\n${finding.detail}`,
      )
      .join("\n\n"),
    "",
    "## Tool Observations",
    getVisibleToolCalls(report)
      .map(
        (tool) =>
          `- ${tool.toolName} [${formatStatusLabel(tool.status)}]: ${tool.purpose} ${tool.outputSummary}`,
      )
      .join("\n"),
    "",
    "## Final Report",
    report.finalOutput,
    "",
    "## Limitations",
    formatMarkdownList([
      ...report.limitations,
      ...(specialist ? specialist.limitations.map((item) => `Specialist: ${item}`) : []),
      ...(onchain ? onchain.limitations.map((item) => `Onchain: ${item}`) : []),
    ]),
    "",
    "## Recommended Next Actions",
    formatMarkdownList([
      ...report.recommendedNextActions,
      ...(specialist ? specialist.recommendedNextActions.map((item) => `Specialist: ${item}`) : []),
      ...(onchain ? onchain.recommendedNextActions.map((item) => `Onchain: ${item}`) : []),
    ]),
    ...(onchain
      ? [
          "",
          "## Onchain Data Sources",
          getUserFacingOnchainDataSources(onchain)
            .map((source) => `- ${source.name}: ${formatStatusLabel(source.status)} - ${source.message}`)
            .join("\n") || "- None",
          "",
          "## Explorer Links",
          onchain.explorerLinks.length > 0
            ? onchain.explorerLinks.map((link) => `- [${link.label}](${link.url})`).join("\n")
            : "- Not available",
        ]
      : []),
    "",
    "## Proof Metadata",
    `- Walrus Blob ID: ${session.storage.blobId}`,
    `- Walrus Object ID: ${session.storage.blobObjectId}`,
    `- Storage provider: ${formatStatusLabel(session.storage.storageProvider)}`,
    `- Storage network: ${formatStatusLabel(session.storage.storageNetwork ?? "walrus-mainnet")}`,
    `- Sui proof object: ${
      session.proof.suiObjectId.includes("pending") ? formatStatusLabel(session.proof.suiObjectId) : session.proof.suiObjectId
    }`,
    `- Transaction digest: ${
      session.proof.transactionDigest.includes("pending")
        ? formatStatusLabel(session.proof.transactionDigest)
        : session.proof.transactionDigest
    }`,
    `- Proof network: ${formatStatusLabel(session.proof.network)}`,
    `- Tatum RPC status: ${formatStatusLabel(session.tatumRpc.status)}`,
    `- Hash matched: ${formatStatusLabel(session.verification.hashMatched ? "Matched" : "Not Verified")}`,
    ...(specialist ? specialist.proofNotes.map((item) => `- Specialist proof note: ${item}`) : []),
    ...(onchain
      ? [
          `- Onchain proof system: ${onchain.proofMetadata.proofSystem}`,
          `- Onchain storage layer: ${onchain.proofMetadata.storageLayer}`,
          `- Onchain anchor layer: ${onchain.proofMetadata.anchorLayer}`,
          `- Onchain RPC verification: ${onchain.proofMetadata.rpcVerification}`,
        ]
      : []),
  ].join("\n");
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function getPromptPreview(prompt: string, expanded: boolean) {
  const text = prompt.trim() || "No original prompt was recorded for this session.";
  const lines = text.split(/\r?\n/);
  const linePreview = lines.slice(0, 4).join("\n");
  const charPreview =
    linePreview.length > 360 ? `${linePreview.slice(0, 360).trimEnd()}...` : linePreview;
  const needsToggle = lines.length > 4 || text.length > charPreview.length;
  return {
    needsToggle,
    text: expanded || !needsToggle ? text : charPreview,
  };
}

function humanizeToolName(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getToolPresentation(toolName: string) {
  const normalized = toolName.toLowerCase();
  if (normalized.includes("recordinputevidence")) {
    return {
      action: "Input evidence recorded",
      detail: "Captured the task prompt, file metadata, wallet context, and deterministic input evidence.",
    };
  }
  if (normalized.includes("generateplan")) {
    return {
      action: "Execution plan generated",
      detail: "Recorded the agent plan before the report was finalized.",
    };
  }
  if (normalized.includes("onchaintarget")) {
    return {
      action: "Sui target analyzed",
      detail: "Checked the detected Sui wallet, object, package, or transaction context using Sui RPC data.",
    };
  }
  if (normalized.includes("specialistagentcontext")) {
    return {
      action: "Specialist context analyzed",
      detail: "Prepared the agent-specific evidence model for the selected report type.",
    };
  }
  if (normalized.includes("tatumsuirpccheck")) {
    return {
      action: "Sui RPC check recorded",
      detail: "Prepared Sui proof-read evidence for server-side RPC verification.",
    };
  }
  if (normalized.includes("hashtracepreview")) {
    return {
      action: "Trace hash sealed",
      detail: "Computed deterministic trace, input, and result fingerprints for later verification.",
    };
  }
  if (normalized.includes("preparewalrustrace")) {
    return {
      action: "Trace bundle prepared",
      detail: "Prepared the sealed BlackBox trace bundle for Walrus storage.",
    };
  }
  if (normalized.includes("finalizeagentreport")) {
    return {
      action: "Report finalized",
      detail: "Captured the final user-facing report and proof notes in the trace.",
    };
  }
  return {
    action: humanizeToolName(toolName) || "Tool evidence recorded",
    detail: "Recorded a traceable agent action in the BlackBox evidence trail.",
  };
}

function isDebugProviderText(value: string) {
  return DEBUG_PROVIDER_PATTERN.test(value);
}

function getVisibleToolCalls(report: NonNullable<AgentSession["trace"]["structuredOutput"]>) {
  return report.toolCalls.filter((tool) => {
    const combined = `${tool.toolName} ${tool.purpose}`;
    return !isDebugProviderText(combined);
  });
}

function getDataSourceSummary(
  session: AgentSession,
  onchain: NonNullable<AgentSession["trace"]["structuredOutput"]>["onchainAnalysis"] | undefined,
) {
  const summaries = [
    session.verification.directWalrusReadPassed
      ? "Walrus proof data: available"
      : "Walrus proof data: pending",
  ];

  const usedSources =
    onchain?.dataSources
      .filter((source) => source.status === "used" && source.used)
      .map((source) => source.name.replace(/\s+V2$/i, "").trim())
      .filter((source) => !isLegacyProviderName(source))
      .filter(Boolean) ?? [];

  if (usedSources.length > 0) {
    summaries.unshift(`Live Sui data source: ${Array.from(new Set(usedSources)).join(", ")}`);
  }

  return summaries;
}

function SpecialistReportSection({ report }: { report: SpecialistAgentReport }) {
  return (
    <section className="overflow-visible rounded-2xl border border-indigo-300/15 bg-indigo-300/[0.025]">
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-indigo-500/[0.08] via-cyan/[0.035] to-transparent p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-indigo-200">
              {formatStatusLabel(report.kind)}
            </p>
            <h3 className="mt-1 text-base font-semibold text-white [overflow-wrap:anywhere]">{report.subject}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400 [overflow-wrap:anywhere]">
              {report.subjectLabel} captured from the task title, prompt, attached metadata, and user-supplied references.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <StatusBadge status={`${report.confidence} confidence`} />
            <StatusBadge status={`${report.dataSourcesUsed.length} sources`} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {report.metrics.map((metric) => (
            <div
              key={`${metric.label}-${metric.value}`}
              className={`min-w-0 rounded-xl border p-3 ${metricToneClasses[metric.tone]}`}
            >
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] opacity-70">
                {metric.label}
              </p>
              <p className="mt-1 text-lg font-semibold [overflow-wrap:anywhere]">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            {report.cards.map((card) => (
              <div
                key={`${card.title}-${card.evidence}`}
                className="min-w-0 rounded-2xl border border-white/[0.07] bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white [overflow-wrap:anywhere]">{card.title}</p>
                    {card.category && (
                      <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-slate-500 [overflow-wrap:anywhere]">
                        {card.category}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${severityClasses[card.severity]}`}
                  >
                    {formatStatusLabel(card.severity)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400 [overflow-wrap:anywhere]">{card.detail}</p>
                <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                  <span className="max-w-full rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-slate-400 [overflow-wrap:anywhere]">
                    {formatStatusLabel(`${card.confidence} confidence`)}
                  </span>
                  {card.status && (
                    <StatusBadge status={card.status} size="sm" />
                  )}
                </div>
                {(card.likelihood || card.impact || card.mitigation) && (
                  <dl className="mt-3 grid gap-2 text-xs text-slate-400">
                    {card.likelihood && (
                      <div className="flex min-w-0 justify-between gap-3">
                        <dt className="text-slate-600">Likelihood</dt>
                        <dd className="min-w-0 text-right [overflow-wrap:anywhere]">{card.likelihood}</dd>
                      </div>
                    )}
                    {card.impact && (
                      <div className="flex min-w-0 justify-between gap-3">
                        <dt className="text-slate-600">Impact</dt>
                        <dd className="min-w-0 text-right [overflow-wrap:anywhere]">{card.impact}</dd>
                      </div>
                    )}
                    {card.mitigation && (
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                        <dt className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-slate-600">
                          Mitigation
                        </dt>
                        <dd className="mt-1 leading-5 [overflow-wrap:anywhere]">{card.mitigation}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <p className="mt-3 break-words font-mono text-[0.66rem] leading-4 text-slate-600 [overflow-wrap:anywhere]">
                  Evidence: {card.evidence}
                </p>
              </div>
            ))}
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            {report.sections.map((section) => (
              <div key={section.title} className="min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {section.title}
                </p>
                <ul className="mt-3 space-y-2">
                  {section.items.map((item) => (
                    <li key={item} className="text-xs leading-5 text-slate-400 [overflow-wrap:anywhere]">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Detected Entities
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {report.detectedEntities.length > 0 ? report.detectedEntities.map((entity) => (
                <span
                  key={entity}
                  className="max-w-full rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300 [overflow-wrap:anywhere]"
                >
                  {entity}
                </span>
              )) : (
                <p className="text-xs leading-5 text-slate-500">No named entities were confidently detected.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Evidence Bundle
            </p>
            <div className="mt-3 space-y-3">
              {report.evidenceItems.map((item) => (
                <div key={`${item.label}-${item.detail}`} className="min-w-0 rounded-xl border border-white/[0.06] bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 text-xs font-semibold text-white [overflow-wrap:anywhere]">{item.label}</p>
                    <StatusBadge status={item.status} size="sm" />
                  </div>
                  <p className="mt-2 break-words text-xs leading-5 text-slate-400">{item.detail}</p>
                  {item.reference && (
                    <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-slate-600 [overflow-wrap:anywhere]">
                      {item.type} / {item.reference}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export function AgentReportPanel({
  session,
  anchorProofAction,
}: {
  session: AgentSession;
  anchorProofAction?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const report = session.trace.structuredOutput;
  const markdownReport = useMemo(() => buildMarkdownReport(session), [session]);
  const jsonReport = useMemo(() => JSON.stringify(buildReportJson(session), null, 2), [session]);
  const onchain = report?.onchainAnalysis;
  const specialist = report?.specialistAnalysis;
  const promptPreview = getPromptPreview(session.prompt, promptExpanded);
  const visibleToolCalls = report ? getVisibleToolCalls(report) : [];
  const userFacingFindings = report ? getUserFacingFindings(report) : [];
  const dataSourceSummary = getDataSourceSummary(session, onchain);
  const originalTaskFacts = [
    { label: "Agent Mode", value: AGENT_MODE_LABELS[session.agentMode] },
    { label: "Created", value: formatDate(session.createdAt) },
    ...(onchain
      ? [
          { label: "Sui Network", value: formatStatusLabel(onchain.header.detectedChain) },
          { label: "Sui Target", value: onchain.header.target ?? "No Sui target supplied" },
        ]
      : specialist
        ? [
            { label: "Report Type", value: formatStatusLabel(specialist.kind) },
            { label: "Evidence Recorded", value: `${specialist.evidenceItems.length} items` },
          ]
        : [{ label: "Proof Network", value: formatStatusLabel(session.proof.network) }]),
  ];
  const suiTransactionUrl = buildSuiExplorerUrl(
    "transaction",
    session.proof.transactionDigest,
    session.proof.network,
  );

  if (!report) return null;

  async function handleCopyReport() {
    await copyText(markdownReport);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <GlassCard className="mt-5 overflow-hidden border-indigo-400/15 bg-indigo-400/[0.025]">
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-indigo-500/[0.08] via-cyan/[0.04] to-transparent p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">Agent Runtime Report</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white [overflow-wrap:anywhere]">
              {report.agentDisplayName}: {report.taskTitle}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">
              {report.executiveSummary}
            </p>
            <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
              <StatusBadge status={`${report.confidence} confidence`} />
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-xs text-slate-400">
                {session.trace.timeline.length} replay events
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-xs text-slate-400">
                {userFacingFindings.length} findings
              </span>
              {onchain && (
                <>
                  <StatusBadge status={onchain.header.detectedChain} />
                  <StatusBadge status={onchain.header.enrichmentStatus} />
                </>
              )}
              {specialist && (
                <>
                  <StatusBadge status={specialist.kind} />
                  <span className="rounded-full border border-cyan/15 bg-cyan/[0.04] px-3 py-1 font-mono text-xs text-cyan">
                    {specialist.evidenceItems.length} evidence items
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2 xl:justify-end">
            <button
              type="button"
              className="button-secondary"
              onClick={() => downloadFile(`${session.id}-agent-report.json`, jsonReport, "application/json")}
            >
              <FileJson className="h-4 w-4" />
              Report JSON
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => downloadFile(`${session.id}-agent-report.md`, markdownReport, "text/markdown")}
            >
              <FileText className="h-4 w-4" />
              Report Markdown
            </button>
            <button type="button" className="button-secondary" onClick={handleCopyReport}>
              {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              {copied ? "Copied" : "Copy Report"}
            </button>
          </div>
        </div>

        <section className="mt-5 min-w-0 rounded-2xl border border-white/[0.07] bg-black/25 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-cyan">
                Final Report
              </p>
              <h3 className="mt-1 text-base font-semibold text-white">Primary agent output</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={getSessionEvidenceStatus(session)} />
              {onchain?.balanceLookupStatus && <StatusBadge status={onchain.balanceLookupStatus} />}
            </div>
          </div>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">
            {report.finalOutput}
          </div>
        </section>

        {anchorProofAction && (
          <section className="mt-5" aria-label="Sui proof anchor action">
            {anchorProofAction}
          </section>
        )}

        <section className="mt-5 rounded-2xl border border-cyan/15 bg-black/20 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-cyan">
                Original Task
              </p>
              <h3 className="mt-1 text-base font-semibold text-white [overflow-wrap:anywhere]">
                {session.title}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={AGENT_MODE_LABELS[session.agentMode]} />
              <StatusBadge status={formatDate(session.createdAt)} />
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
            {originalTaskFacts.map((fact) => (
              <div key={fact.label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <dt className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-600">
                  {fact.label}
                </dt>
                <dd className="mt-1 text-slate-300 [overflow-wrap:anywhere]">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-600">
              User prompt
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">
              {promptPreview.text}
            </p>
            {promptPreview.needsToggle && (
              <button
                type="button"
                className="mt-3 text-xs font-semibold uppercase tracking-[0.13em] text-cyan transition hover:text-white"
                onClick={() => setPromptExpanded((current) => !current)}
              >
                {promptExpanded ? "Collapse prompt" : "Show full prompt"}
              </button>
            )}
          </div>
        </section>
      </div>

      <div className="space-y-5 p-5">
        <div className="min-w-0 space-y-5">
          {onchain && (
            <section className="min-w-0 rounded-2xl border border-cyan/15 bg-cyan/[0.025] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-cyan">
                    Chain Detection
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-white [overflow-wrap:anywhere]">
                    {onchain.header.detectedChain} / {formatStatusLabel(onchain.header.targetType)}
                  </h3>
                  <p className="mt-2 break-words font-mono text-xs leading-5 text-slate-400 [overflow-wrap:anywhere]">
                    {onchain.header.target ?? "No target supplied"}
                  </p>
              </div>
                <StatusBadge status={onchain.header.enrichmentStatus} />
              </div>
              <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-3">
                {[
                  ["Provider", getOnchainProviderDisplay(onchain)],
                  ["Confidence", onchain.header.confidence],
                  ["Assumption", onchain.detected.assumptions.join(" ") || "None"],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-600">
                      {label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-300 [overflow-wrap:anywhere]">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {specialist && <SpecialistReportSection report={specialist} />}

          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Findings
                </p>
                <h3 className="mt-1 text-base font-semibold text-white">What the agent found</h3>
              </div>
              <Fingerprint className="h-4 w-4 text-cyan" />
            </div>
            <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
              {userFacingFindings.map((finding) => (
                <div
                  key={`${finding.title}-${finding.severity}-${finding.evidence}`}
                  className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold text-white [overflow-wrap:anywhere]">{finding.title}</p>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${severityClasses[finding.severity]}`}
                    >
                      {formatStatusLabel(finding.severity)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400 [overflow-wrap:anywhere]">{finding.detail}</p>
                  <p className="mt-3 break-words font-mono text-[0.66rem] leading-4 text-slate-600 [overflow-wrap:anywhere]">
                    Evidence: {finding.evidence}
                  </p>
                </div>
              ))}
            </div>
          </section>

        </div>

        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-3">
          <section className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Session Snapshot
            </p>
            <dl className="mt-3 space-y-3 text-xs">
              {[
                { label: "Task Title", value: session.title },
                { label: "Mode", value: AGENT_MODE_LABELS[session.agentMode] },
                { label: "Created", value: formatDate(session.createdAt) },
                ...(session.rerunOf ? [{ label: "Re-run Of", value: session.rerunOf }] : []),
                { label: "Owner Wallet", value: session.ownerAddress ?? "Not recorded", copyValue: session.ownerAddress ?? "" },
                { label: "Network", value: formatStatusLabel(session.proof.network) },
                { label: "Storage Mode", value: formatStatusLabel(session.storageMode) },
                { label: "Evidence Status", value: getSessionEvidenceStatus(session) },
                ...(onchain
                  ? [
                      { label: "Detected Network", value: onchain.header.detectedChain },
                      { label: "Target Type", value: formatStatusLabel(onchain.header.targetType) },
                      { label: "Provider Used", value: getOnchainProviderDisplay(onchain) },
                      { label: "Enrichment", value: formatStatusLabel(onchain.header.enrichmentStatus) },
                    ]
                  : []),
                ...(specialist
                  ? [
                      { label: "Report Type", value: formatStatusLabel(specialist.kind) },
                      { label: "Data Sources", value: String(specialist.dataSourcesUsed.length) },
                    ]
                  : []),
              ].map(({ label, value, copyValue }) => (
                <div key={label} className="flex min-w-0 flex-col gap-1 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="min-w-0 font-mono text-slate-300 sm:text-right">
                    <span className="break-words [overflow-wrap:anywhere]">{value}</span>
                    {copyValue && (
                      <span className="mt-1 block">
                        <CopyButton value={copyValue} compact />
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="min-w-0 rounded-2xl border border-cyan/15 bg-cyan/[0.025] p-4">
            <div className="flex items-center gap-2">
              <ProtocolLogo protocol="walrus" size="sm" />
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-cyan">
                Proof Status
              </p>
            </div>
            <div className="mt-3 space-y-3">
              {[
                {
                  label: "Walrus blob",
                  status: session.verification.walrusBlobAvailable
                    ? "Stored"
                    : session.storage.storageStatus,
                },
                {
                  label: "Replay check",
                  status: session.verification.directWalrusReadPassed
                    ? "Passed"
                    : session.storage.storageProvider === "local"
                      ? "Local"
                      : "Pending",
                },
                {
                  label: "Hash match",
                  status:
                    session.verification.hashMatched === true
                      ? "Passed"
                      : session.verification.hashMatched === false
                        ? "Failed"
                        : "Pending",
                },
                { label: "Sui anchor", status: formatProofStatus(session.proof.status) },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="text-xs text-slate-500">{item.label}</span>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2">
              <ProtocolLogo protocol="sui" size="sm" />
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Onchain Proof
              </p>
            </div>
            <dl className="mt-3 space-y-3 text-xs">
              {[
                { label: "Sui proof object", value: shortHash(session.proof.suiObjectId, 11, 8), copyValue: session.proof.suiObjectId },
                { label: "Transaction digest", value: shortHash(session.proof.transactionDigest, 11, 8), copyValue: session.proof.transactionDigest },
                { label: "Package", value: shortHash(session.proof.packageId, 11, 8), copyValue: session.proof.packageId },
              ].map(({ label, value, copyValue }) => (
                <div key={label} className="flex min-w-0 flex-col gap-1 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="min-w-0 font-mono text-slate-300 sm:text-right">
                    <span className="break-words [overflow-wrap:anywhere]">{value}</span>
                    {copyValue && (
                      <span className="mt-1 block">
                        <CopyButton value={copyValue} compact />
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {suiTransactionUrl ? (
              <a
                href={suiTransactionUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-cyan transition hover:text-white"
              >
                Open Sui transaction
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <div className="mt-3">
                <StatusBadge status="Transaction Pending" size="sm" />
              </div>
            )}
            <a
              href={`/verify/${session.id}`}
              className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-cyan transition hover:text-white"
            >
              Recheck proof
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </section>

        </div>

        <section className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Tool Evidence
              </p>
              <h3 className="mt-1 text-base font-semibold text-white">
                Recorded agent action trail
              </h3>
            </div>
            <StatusBadge status={`${visibleToolCalls.length} action(s)`} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {dataSourceSummary.map((summary) => (
              <span
                key={summary}
                className="rounded-full border border-cyan/15 bg-cyan/[0.035] px-3 py-1 text-xs text-cyan"
              >
                {summary}
              </span>
            ))}
          </div>

          {visibleToolCalls.length > 0 ? (
            <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {visibleToolCalls.map((tool) => {
                const presentation = getToolPresentation(tool.toolName);
                return (
                  <div
                    key={`${tool.toolName}-${tool.inputSummary}`}
                    className="min-w-0 rounded-2xl border border-white/[0.06] bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 text-sm font-semibold text-white [overflow-wrap:anywhere]">
                        {presentation.action}
                      </p>
                      <StatusBadge status={tool.status} />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-400 [overflow-wrap:anywhere]">
                      {presentation.detail}
                    </p>
                    <p className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-slate-600 [overflow-wrap:anywhere]">
                      Evidence ID: {humanizeToolName(tool.toolName)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs leading-5 text-slate-500">
              Tool evidence was recorded in the sealed trace. No user-facing tool actions require display here.
            </p>
          )}
        </section>
      </div>

    </GlassCard>
  );
}
