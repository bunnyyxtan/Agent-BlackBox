import { extractTaskContext, type TaskContext } from "@/lib/agents/task-context";
import type { AgentConfidence, AgentFindingSeverity } from "@/lib/agents/types";
import { getResearchSearchConfig } from "@/lib/research/search-provider";
import type { AgentMode, InputFile } from "@/types/blackbox";

export type SpecialistReportKind = "research_brief" | "risk_review" | "delivery_receipt";

export interface SpecialistEvidenceItem {
  type: "file" | "link" | "text_claim" | "timestamp" | "acceptance_note" | "metadata";
  label: string;
  detail: string;
  status: "provided" | "missing" | "inferred" | "needs_verification";
  reference?: string;
}

export interface SpecialistReportCard {
  title: string;
  detail: string;
  severity: AgentFindingSeverity;
  evidence: string;
  confidence: AgentConfidence;
  status?: string;
  category?: string;
  likelihood?: string;
  impact?: string;
  mitigation?: string;
}

export interface SpecialistReportSection {
  title: string;
  items: string[];
}

export interface SpecialistReportMetric {
  label: string;
  value: string;
  tone: "neutral" | "success" | "warning" | "danger";
}

export interface SpecialistAgentReport {
  kind: SpecialistReportKind;
  agent: string;
  subjectLabel: string;
  subject: string;
  confidence: AgentConfidence;
  generatedAt: string;
  dataSourcesUsed: string[];
  detectedEntities: string[];
  evidenceItems: SpecialistEvidenceItem[];
  metrics: SpecialistReportMetric[];
  cards: SpecialistReportCard[];
  sections: SpecialistReportSection[];
  limitations: string[];
  recommendedNextActions: string[];
  proofNotes: string[];
}

type ReportInput = {
  sessionId?: string;
  agentMode: AgentMode;
  taskTitle: string;
  taskPrompt: string;
  inputFiles: Array<Pick<InputFile, "name" | "type" | "size">>;
  ownerAddress?: string | null;
  createdAt?: string;
};

const DATE_PATTERN = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/gi;
const ACCEPTANCE_PATTERN = /\b(accepted|approved|signed off|signoff|acceptance|confirmed|client approved|reviewed and approved)\b/i;

function truncate(value: string, max = 220) {
  return value.length > max ? `${value.slice(0, max).trimEnd()}...` : value;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function titleCase(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function extractDates(text: string) {
  return uniqueValues(text.match(DATE_PATTERN) ?? []);
}

function confidenceFromContext(context: TaskContext): AgentConfidence {
  const evidenceScore =
    context.files.length +
    context.urls.length +
    context.wallets.length +
    context.transactionDigests.length +
    (context.protocols.length >= 2 ? 1 : 0);
  if (evidenceScore >= 4) return "high";
  if (evidenceScore >= 1) return "medium";
  return "low";
}

function evidenceItems(input: ReportInput, context: TaskContext): SpecialistEvidenceItem[] {
  const dates = extractDates(context.text);
  return [
    {
      type: "text_claim",
      label: "Sealed task prompt",
      detail: truncate(input.taskPrompt, 280),
      status: "provided",
      reference: "User prompt",
    },
    ...context.files.map((file): SpecialistEvidenceItem => ({
      type: "file",
      label: file.name,
      detail: `${file.type || "unknown type"}, ${file.size} bytes`,
      status: "provided",
      reference: "Attached file metadata",
    })),
    ...context.urls.map((url): SpecialistEvidenceItem => ({
      type: "link",
      label: "User-provided link",
      detail: url,
      status: "provided",
      reference: "Task prompt",
    })),
    ...dates.map((date): SpecialistEvidenceItem => ({
      type: "timestamp",
      label: "Detected date/time",
      detail: date,
      status: "provided",
      reference: "Task prompt",
    })),
    ...(ACCEPTANCE_PATTERN.test(input.taskPrompt)
      ? [{
          type: "acceptance_note" as const,
          label: "Acceptance language",
          detail: "The prompt includes approval, sign-off, or acceptance wording.",
          status: "provided" as const,
          reference: "Task prompt",
        }]
      : []),
  ];
}

function dataSources(input: ReportInput, context: TaskContext, includeInternalContext = false) {
  return [
    "Sealed task prompt",
    "Task title",
    ...(input.inputFiles.length > 0 ? ["Attached file metadata"] : []),
    ...(context.urls.length > 0 ? ["User-provided links"] : []),
    ...(includeInternalContext ? ["Agent BlackBox Sui/Walrus/Tatum integration context"] : []),
  ];
}

function proofNotes(input: ReportInput) {
  return [
    `Session ID: ${input.sessionId ?? "prepared after save"}`,
    `Owner wallet: ${input.ownerAddress ?? "captured when wallet is connected"}`,
    "The final report, evidence summary, input hash, result hash, trace hash, Walrus reference, replay status, and Sui proof status are sealed into the session metadata.",
    "Storage or onchain success is only claimed after Walrus readback/hash verification and Sui proof verification complete.",
  ];
}

function detectedEntities(context: TaskContext) {
  return uniqueValues([
    ...context.protocols,
    ...context.chains,
    ...context.wallets.map((wallet) => `${wallet.slice(0, 10)}...${wallet.slice(-6)}`),
    ...context.urls.map((url) => new URL(url).hostname).filter(Boolean),
  ]).slice(0, 12);
}

function claimBreakdown(context: TaskContext, fallback: string) {
  if (context.claims.length > 0) return context.claims;
  return [fallback];
}

function buildCollaborationResearch(input: ReportInput, context: TaskContext, generatedAt: string): SpecialistAgentReport {
  const search = getResearchSearchConfig();
  const confidence: AgentConfidence = context.urls.length > 0 || input.inputFiles.length > 0 ? "medium" : "low";
  const entities = detectedEntities(context);
  return {
    kind: "research_brief",
    agent: "Research Agent",
    subjectLabel: "Research question",
    subject: input.taskTitle,
    confidence,
    generatedAt,
    dataSourcesUsed: dataSources(input, context, true),
    detectedEntities: entities,
    evidenceItems: evidenceItems(input, context),
    metrics: [
      { label: "Question type", value: "Collaboration claim", tone: "neutral" },
      { label: "Detected entities", value: String(entities.length), tone: "neutral" },
      { label: "Evidence strength", value: titleCase(confidence), tone: confidence === "low" ? "warning" : "success" },
    ],
    cards: [
      {
        title: "Collaboration claim parsed",
        detail: "The prompt asks whether Tatum, Walrus, and Sui have an official collaboration or ecosystem relationship.",
        severity: "info",
        evidence: "Task prompt",
        confidence: "high",
        status: "parsed",
      },
      {
        title: "Internal integration is not partnership proof",
        detail: "Agent BlackBox uses Tatum Sui RPC, Walrus storage, and Sui proof anchoring together. That integration context does not prove an official collaboration between those projects.",
        severity: "medium",
        evidence: "Agent BlackBox product context",
        confidence: "high",
        status: "important boundary",
      },
      {
        title: "Official source still required",
        detail: "No official announcement, partner page, hackathon listing, or signed source was supplied in the sealed evidence for this run.",
        severity: "medium",
        evidence: context.urls.length > 0 ? "User-provided links need review" : "No official source attached",
        confidence,
        status: "needs verification",
      },
    ],
    sections: [
      {
        title: "Research Question",
        items: [
          "Does the supplied evidence confirm an official collaboration between Tatum, Walrus, and Sui?",
        ],
      },
      {
        title: "Claim Breakdown",
        items: [
          "Tatum may be involved with Sui infrastructure or tooling.",
          "Walrus may be involved as a storage layer in the same ecosystem.",
          "An official collaboration requires confirmation from project-controlled sources, not app-level integration alone.",
        ],
      },
      {
        title: "Evidence Available",
        items: [
          "The sealed prompt asks the collaboration question.",
          "Agent BlackBox has internal context that these technologies can be integrated in one workflow.",
          search.userNote,
        ],
      },
      {
        title: "Verification Boundary",
        items: [
          "Can conclude: this app integrates Tatum Sui RPC, Walrus storage, and Sui proof anchoring.",
          "Cannot conclude: Tatum, Walrus, and Sui have an official collaboration from the supplied evidence alone.",
        ],
      },
      {
        title: "Next Verification Sources",
        items: [
          "Check official Tatum announcements, product docs, and hackathon pages.",
          "Check Walrus and Sui Foundation ecosystem or partner announcements.",
          "Check official GitHub repositories, docs, and event pages for named collaboration language.",
        ],
      },
    ],
    limitations: [
      "No official source proving collaboration was supplied in the sealed evidence.",
      search.userNote,
    ],
    recommendedNextActions: [
      "Attach official announcement links or screenshots before treating the collaboration as confirmed.",
      "Separate 'technically integrated in this app' from 'officially collaborating' in any public claim.",
      "Re-run the Research Agent with source links if you want a higher-confidence brief.",
    ],
    proofNotes: proofNotes(input),
  };
}

function buildWalrusResearch(input: ReportInput, context: TaskContext, generatedAt: string): SpecialistAgentReport {
  const search = getResearchSearchConfig();
  const confidence = confidenceFromContext(context);
  const entities = detectedEntities(context);
  return {
    kind: "research_brief",
    agent: "Research Agent",
    subjectLabel: "Research subject",
    subject: input.taskTitle,
    confidence,
    generatedAt,
    dataSourcesUsed: dataSources(input, context, true),
    detectedEntities: entities,
    evidenceItems: evidenceItems(input, context),
    metrics: [
      { label: "Research scope", value: "Walrus storage", tone: "success" },
      { label: "Evidence strength", value: titleCase(confidence), tone: confidence === "low" ? "warning" : "success" },
      { label: "Proof relevance", value: "High", tone: "success" },
    ],
    cards: [
      {
        title: "Storage system scope",
        detail: "The prompt is about Walrus as a storage system, especially its role as a verifiable blob layer for sealed AI agent traces.",
        severity: "info",
        evidence: "Task prompt",
        confidence: "high",
        status: "parsed",
      },
      {
        title: "Blob storage role",
        detail: "In Agent BlackBox, the trace bundle is sealed locally, uploaded as a Walrus blob, then referenced by blob/object identifiers in the session proof metadata.",
        severity: "info",
        evidence: "Agent BlackBox product context",
        confidence: "high",
        status: "supported",
      },
      {
        title: "Replay verification role",
        detail: "A stored blob becomes useful evidence only after readback through the Walrus aggregator and recomputation of the trace hash matches the sealed trace hash.",
        severity: "info",
        evidence: "Agent BlackBox verification model",
        confidence: "high",
        status: "supported",
      },
      {
        title: "Operational risk",
        detail: "Upload relay availability, wallet approvals, storage payment, certification, and aggregator readback are operational dependencies that must be surfaced clearly.",
        severity: "medium",
        evidence: "Walrus upload flow requirements",
        confidence: "medium",
        status: "needs monitoring",
      },
    ],
    sections: [
      {
        title: "Research Question",
        items: ["How can Walrus act as a verifiable storage layer for AI agent traces?"],
      },
      {
        title: "Findings",
        items: [
          "Walrus is the evidence-storage layer in the Agent BlackBox flow, while Sui anchors compact proof metadata.",
          "Trace integrity depends on deterministic hashing before upload and hash recomputation after Walrus readback.",
          "A Walrus blob reference alone is not enough; availability and content hash matching must pass before the session is considered verified.",
        ],
      },
      {
        title: "Verification Boundary",
        items: [
          "Can explain from app context: sealed trace bundle, blob storage, aggregator readback, replay verification, and hash match.",
          "Requires external docs for protocol-level details such as storage economics, validator/storage-node behavior, and long-term availability guarantees.",
          search.userNote,
        ],
      },
      {
        title: "Implementation Checklist",
        items: [
          "Prepare deterministic trace bundle.",
          "Upload through the configured Walrus Mainnet relay.",
          "Record blob/object references.",
          "Read the blob through the aggregator.",
          "Recompute and compare trace hash.",
          "Anchor compact proof metadata on Sui.",
        ],
      },
    ],
    limitations: [
      "Protocol-level claims should be checked against official Walrus documentation.",
      search.userNote,
    ],
    recommendedNextActions: [
      "Attach official Walrus docs or architecture links for a source-backed protocol brief.",
      "Run a live Agent BlackBox trace and verify Walrus readback/hash match.",
      "Use the verification page to demonstrate replay and tamper detection.",
    ],
    proofNotes: proofNotes(input),
  };
}

function buildGeneralResearch(input: ReportInput, context: TaskContext, generatedAt: string): SpecialistAgentReport {
  const search = getResearchSearchConfig();
  const confidence = confidenceFromContext(context);
  const entities = detectedEntities(context);
  const claims = claimBreakdown(context, "The task asks for a source-aware research brief.");
  return {
    kind: "research_brief",
    agent: "Research Agent",
    subjectLabel: "Research subject",
    subject: input.taskTitle,
    confidence,
    generatedAt,
    dataSourcesUsed: dataSources(input, context, context.protocols.some((item) => /sui|walrus|tatum|agent blackbox/i.test(item))),
    detectedEntities: entities,
    evidenceItems: evidenceItems(input, context),
    metrics: [
      { label: "Question type", value: titleCase(context.questionType), tone: "neutral" },
      { label: "Detected entities", value: String(entities.length), tone: "neutral" },
      { label: "Evidence strength", value: titleCase(confidence), tone: confidence === "low" ? "warning" : "success" },
    ],
    cards: [
      {
        title: "Research question parsed",
        detail: `The report investigates: ${truncate(input.taskPrompt || input.taskTitle, 180)}`,
        severity: "info",
        evidence: "Task prompt",
        confidence: "high",
        status: "parsed",
      },
      {
        title: "Claim breakdown prepared",
        detail: `The task was split into ${claims.length} answerable claim(s) or sub-question(s).`,
        severity: "info",
        evidence: "Deterministic task parser",
        confidence: "medium",
        status: "prepared",
      },
      {
        title: "Verification sources needed",
        detail: "The report identifies exactly what would be needed to move from prompt-based analysis to source-confirmed conclusions.",
        severity: "medium",
        evidence: context.urls.length > 0 ? "User-provided links" : "No source link attached",
        confidence,
        status: "needs verification",
      },
    ],
    sections: [
      { title: "Research Question", items: [input.taskPrompt || input.taskTitle] },
      { title: "Detected Entities", items: entities.length > 0 ? entities : ["No project, protocol, wallet, or link entity was clearly detected."] },
      { title: "Claim Breakdown", items: claims },
      {
        title: "Evidence Available",
        items: [
          "The sealed title and prompt are available.",
          context.files.length > 0 ? `${context.files.length} attached file metadata record(s) are available.` : "No file metadata was attached.",
          context.urls.length > 0 ? `${context.urls.length} user-provided link(s) are available.` : "No source links were provided.",
          search.userNote,
        ],
      },
      {
        title: "Findings",
        items: [
          "The prompt defines the investigation scope and the claims that need confirmation.",
          "No fact outside the supplied evidence is treated as confirmed.",
          "The next step is to attach primary sources or run a search-enabled research pass.",
        ],
      },
      {
        title: "Verification Boundary",
        items: [
          "Can conclude: what the user asked, which entities were detected, and which claims require proof.",
          "Cannot conclude: current external facts or official claims that were not supplied as evidence.",
        ],
      },
    ],
    limitations: [
      "Current facts require attached sources or an enabled external search provider.",
      search.userNote,
    ],
    recommendedNextActions: [
      "Attach official source links, screenshots, PDFs, or notes that support the claim.",
      "List the exact claims that must be confirmed or disproven.",
      "Use the sealed verification page after Walrus storage and Sui anchoring complete.",
    ],
    proofNotes: proofNotes(input),
  };
}

function buildRiskReview(input: ReportInput, context: TaskContext, generatedAt: string): SpecialistAgentReport {
  const lower = context.normalizedText;
  const categories = [
    ["technical", /\b(api|system|code|deployment|integration|runtime|walrus|sui|rpc|proof)\b/i, "High"],
    ["security", /\b(wallet|key|secret|signature|auth|abuse|attack|exposed)\b/i, "High"],
    ["operational", /\b(upload|relay|failure|approval|process|runbook|retry|timeout)\b/i, "Medium"],
    ["financial", /\b(cost|gas|sui|wal|payment|fund|fee|charge)\b/i, "Medium"],
    ["data quality", /\b(fake|verification|hash|trace|evidence|source|missing|incorrect)\b/i, "High"],
    ["user trust", /\b(public|demo|judge|trust|reputation|claim|confusing)\b/i, "High"],
    ["proof integrity", /\b(anchor|proof|walrus|hash|tamper|readback|mismatch)\b/i, "Critical"],
  ] as const;
  const matched = categories.filter(([, pattern]) => pattern.test(lower));
  const active = matched.length > 0 ? matched : categories.slice(0, 4);
  const confidence = confidenceFromContext(context);
  const entities = detectedEntities(context);
  const cards: SpecialistReportCard[] = active.map(([category,, impact]) => ({
    title: `${titleCase(category)} risk`,
    detail: `The task contains enough context to review ${category} exposure. Treat this as an actionable review area, then validate against concrete deployment evidence.`,
    severity: impact === "Critical" ? "critical" : impact === "High" ? "high" : "medium",
    evidence: "Prompt risk scope",
    confidence,
    category,
    likelihood: lower.includes(category) ? "Medium" : "Low",
    impact,
    mitigation:
      category === "proof integrity"
        ? "Do not mark sessions verified until Walrus readback, hash match, and Sui proof verification pass."
        : category === "security"
          ? "Keep all API keys server-side, enable demo guards, and avoid exposing raw prompts publicly."
          : "Define acceptance checks, monitor failures, and keep recovery states explicit.",
  }));
  return {
    kind: "risk_review",
    agent: "Risk Review Agent",
    subjectLabel: "Review scope",
    subject: input.taskTitle,
    confidence,
    generatedAt,
    dataSourcesUsed: dataSources(input, context, true),
    detectedEntities: entities,
    evidenceItems: evidenceItems(input, context),
    metrics: [
      { label: "Risks reviewed", value: String(active.length), tone: "neutral" },
      { label: "Highest impact", value: active.some(([category]) => category === "proof integrity") ? "Critical" : "High", tone: "danger" },
      { label: "Evidence strength", value: titleCase(confidence), tone: confidence === "low" ? "warning" : "success" },
    ],
    cards: [
      ...cards,
      {
        title: "Safe recommendation",
        detail: "Treat public demo endpoints, Walrus upload failure handling, Sui anchoring verification, and prompt privacy as release blockers for a polished hackathon demo.",
        severity: "high",
        evidence: "Risk review scope",
        confidence: "high",
        category: "safe next action",
        likelihood: "Medium",
        impact: "High",
        mitigation: "Run the demo flow end-to-end and keep failure states explicit instead of hiding them.",
      },
    ],
    sections: [
      { title: "Scope", items: [input.taskPrompt || input.taskTitle] },
      {
        title: "Severity Matrix",
        items: cards.map((card) => `${card.category}: severity ${card.severity}, likelihood ${card.likelihood}, impact ${card.impact}, mitigation ${card.mitigation}`),
      },
      {
        title: "Red Flags",
        items: [
          lower.includes("fake") ? "The prompt explicitly flags fake verification states as a risk." : "Any proof success state not backed by Walrus readback and Sui verification is a red flag.",
          lower.includes("public") || lower.includes("demo") ? "Public demo exposure means API abuse and prompt leakage must be controlled." : "Public deployment details were not fully specified.",
          lower.includes("walrus") ? "Walrus upload/retry failures must show clean recovery without claiming storage success." : "Storage failure mode should be checked before external demo.",
        ],
      },
      {
        title: "Safe Next Actions",
        items: [
          "Enable demo guard/rate limits for paid or mutating endpoints.",
          "Run a full Walrus upload, readback, hash match, and Sui anchor verification pass.",
          "Confirm Settings shows Tatum Sui RPC readiness without exposing secrets.",
          "Review public verification payloads for prompt/privacy leakage.",
        ],
      },
      {
        title: "Final Risk Summary",
        items: [
          "The highest risks are proof integrity, public API abuse, storage failure recovery, and user trust if the UI overstates verification.",
        ],
      },
    ],
    limitations: [
      "Risk likelihood is based on the supplied prompt and metadata, not a live penetration test.",
      "Attach deployment logs, endpoint configs, and failure screenshots for higher-confidence review.",
    ],
    recommendedNextActions: [
      "Fix any fake success state before judging.",
      "Run the public demo flow from a fresh browser profile.",
      "Export the sealed report after Walrus and Sui proof steps complete.",
    ],
    proofNotes: proofNotes(input),
  };
}

function extractDeliverables(prompt: string) {
  const lines = prompt.split(/\r?\n/).map((line) => line.trim());
  const cleanItem = (item: string) =>
    item
      .replace(/\.\s*(?:create|generate|produce|prepare|write)\b[\s\S]*$/i, "")
      .trim();
  const bullets = lines
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => cleanItem(line.replace(/^[-*]\s+/, "")))
    .filter(Boolean);
  if (bullets.length > 0) return bullets;
  const delivered = prompt.match(/\bdelivered:\s*([\s\S]+)/i)?.[1];
  if (delivered) {
    return delivered.split(/[,;\n]/).map(cleanItem).filter(Boolean).slice(0, 8);
  }
  return [truncate(prompt, 140)];
}

function buildDeliveryReceipt(input: ReportInput, context: TaskContext, generatedAt: string): SpecialistAgentReport {
  const deliverables = extractDeliverables(input.taskPrompt);
  const hasAcceptance = ACCEPTANCE_PATTERN.test(input.taskPrompt);
  const confidence = deliverables.length >= 3 || context.files.length + context.urls.length > 1 ? "medium" : "low";
  const missing = [
    context.files.length === 0 ? "Attach final deliverable files or screenshots." : "",
    context.urls.length === 0 ? "Add a delivery link, repository, deployment URL, or verification page." : "",
    !hasAcceptance ? "Add recipient/client acceptance or review note if available." : "",
  ].filter(Boolean);
  return {
    kind: "delivery_receipt",
    agent: "Delivery Proof Agent",
    subjectLabel: "Delivery summary",
    subject: input.taskTitle,
    confidence,
    generatedAt,
    dataSourcesUsed: dataSources(input, context, true),
    detectedEntities: detectedEntities(context),
    evidenceItems: [
      ...evidenceItems(input, context),
      ...missing.map((item): SpecialistEvidenceItem => ({
        type: "metadata",
        label: "Missing acceptance evidence",
        detail: item,
        status: "missing",
        reference: "Delivery acceptance checklist",
      })),
    ],
    metrics: [
      { label: "Deliverables", value: String(deliverables.length), tone: "success" },
      { label: "Missing items", value: String(missing.length), tone: missing.length > 0 ? "warning" : "success" },
      { label: "Receipt confidence", value: titleCase(confidence), tone: confidence === "low" ? "warning" : "success" },
    ],
    cards: [
      {
        title: "Deliverable captured",
        detail: `Captured ${deliverables.length} delivered item(s) from the prompt for a sealed receipt.`,
        severity: "info",
        evidence: "Task prompt",
        confidence: "high",
        status: "captured",
      },
      {
        title: "Acceptance checklist prepared",
        detail: missing.length > 0
          ? "The receipt is usable, but the listed missing acceptance evidence should be added before relying on it externally."
          : "The prompt includes enough delivery and acceptance context for a stronger receipt.",
        severity: missing.length > 0 ? "medium" : "info",
        evidence: "Delivery checklist",
        confidence,
        status: missing.length > 0 ? "needs evidence" : "ready",
      },
      {
        title: "Proof trail ready",
        detail: "The delivery receipt can be sealed into the BlackBox trace, stored on Walrus, replayed, hash-checked, and anchored on Sui.",
        severity: "info",
        evidence: "Agent BlackBox proof flow",
        confidence: "high",
        status: "proof ready",
      },
    ],
    sections: [
      { title: "Delivery Summary", items: [`Delivered work: ${input.taskTitle}`] },
      { title: "Delivered Items", items: deliverables },
      {
        title: "Acceptance Checklist",
        items: [
          "Recipient can inspect the final report and listed deliverables.",
          "Recipient can verify input/result/trace hashes after the session is sealed.",
          "Recipient can open the verification page after Walrus storage and Sui anchoring complete.",
          hasAcceptance ? "Acceptance language was supplied." : "Acceptance language is still missing.",
        ],
      },
      {
        title: "Evidence Trail",
        items: [
          "Original prompt captured.",
          `${context.files.length} attached file metadata item(s) recorded.`,
          `${context.urls.length} user-provided link(s) recorded.`,
          "Trace hash, Walrus blob reference, and Sui proof anchor are recorded after the proof flow completes.",
        ],
      },
      {
        title: "Handoff Notes",
        items: [
          "Inspect the deliverables against the acceptance checklist.",
          "Confirm the verification page shows Walrus readback and hash match.",
          "Confirm Sui proof anchoring before treating the receipt as externally verified.",
        ],
      },
      {
        title: "Final Delivery Receipt",
        items: [
          `This receipt records that "${input.taskTitle}" was delivered according to the supplied prompt. It lists the delivered items, missing acceptance evidence, and proof trail required for independent verification.`,
        ],
      },
    ],
    limitations: missing,
    recommendedNextActions: [
      "Attach final deliverable files, screenshots, or deployment links.",
      "Add acceptance notes from the recipient or judge if available.",
      "Share the verification page after Walrus storage, replay verification, and Sui proof anchoring complete.",
    ],
    proofNotes: proofNotes(input),
  };
}

export function isSpecialistAgentReport(value: unknown): value is SpecialistAgentReport {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "agent" in value &&
    "metrics" in value &&
    "evidenceItems" in value &&
    "sections" in value
  );
}

export function formatSpecialistFinalOutput(report: SpecialistAgentReport) {
  const headline = report.cards[0]?.detail ?? `${report.agent} completed ${report.kind.replace(/_/g, " ")}.`;
  const keySections = report.sections
    .slice(0, 5)
    .map((section) => {
      const items = section.items.slice(0, 8).map((item) => `- ${item}`).join("\n");
      return `${section.title}:\n${items}`;
    })
    .join("\n\n");
  const next = report.recommendedNextActions.slice(0, 3).map((item) => `- ${item}`).join("\n");
  return [
    headline,
    "",
    keySections,
    "",
    "Recommended next steps:",
    next || "- No next steps recorded.",
  ].join("\n");
}

export function formatSpecialistReportForTrace(report: SpecialistAgentReport) {
  return [
    `${report.agent} Report`,
    "",
    "Report Header",
    `Agent: ${report.agent}`,
    `${report.subjectLabel}: ${report.subject}`,
    `Confidence: ${report.confidence}`,
    `Timestamp: ${report.generatedAt}`,
    `Data sources used: ${report.dataSourcesUsed.join(", ") || "Sealed task prompt"}`,
    "",
    "Executive Summary",
    formatSpecialistFinalOutput(report),
    "",
    "Scorecard",
    ...report.metrics.map((metric) => `${metric.label}: ${metric.value}`),
    "",
    "Evidence & Inputs",
    report.evidenceItems.length > 0
      ? report.evidenceItems.map((item) => `${item.label} [${item.status}]: ${item.detail}`).join("\n")
      : "No evidence items were supplied.",
    "",
    "Report Cards",
    ...report.cards.map((card) => {
      const extras = [
        card.status ? `Status: ${card.status}` : "",
        card.category ? `Category: ${card.category}` : "",
        card.likelihood ? `Likelihood: ${card.likelihood}` : "",
        card.impact ? `Impact: ${card.impact}` : "",
        card.mitigation ? `Mitigation: ${card.mitigation}` : "",
      ].filter(Boolean);
      return [
        `${card.title} (${card.severity}, ${card.confidence} confidence)`,
        card.detail,
        `Evidence: ${card.evidence}`,
        ...extras,
      ].join("\n");
    }),
    "",
    ...report.sections.flatMap((section) => [
      section.title,
      ...section.items.map((item) => `- ${item}`),
      "",
    ]),
    "Limitations",
    ...report.limitations.map((item) => `- ${item}`),
    "",
    "Recommended Next Actions",
    ...report.recommendedNextActions.map((item) => `- ${item}`),
    "",
    "Proof Metadata",
    ...report.proofNotes.map((item) => `- ${item}`),
  ].join("\n");
}

export function buildSpecialistAgentReport(input: ReportInput): SpecialistAgentReport | undefined {
  if (input.agentMode === "onchain_monitor") return undefined;
  const context = extractTaskContext(input.taskTitle, input.taskPrompt, input.inputFiles);
  const generatedAt = input.createdAt ?? new Date().toISOString();

  if (input.agentMode === "research") {
    if (context.questionType === "collaboration_claim") {
      return buildCollaborationResearch(input, context, generatedAt);
    }
    if (/walrus/i.test(context.text) && /\b(storage|blob|system|trace|replay)\b/i.test(context.text)) {
      return buildWalrusResearch(input, context, generatedAt);
    }
    return buildGeneralResearch(input, context, generatedAt);
  }

  if (input.agentMode === "risk_review") {
    return buildRiskReview(input, context, generatedAt);
  }

  if (input.agentMode === "delivery_proof") {
    return buildDeliveryReceipt(input, context, generatedAt);
  }

  return undefined;
}
