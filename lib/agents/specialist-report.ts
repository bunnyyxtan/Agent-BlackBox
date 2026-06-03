import type { AgentConfidence, AgentFindingSeverity } from "@/lib/agents/types";
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

const URL_PATTERN = /\bhttps?:\/\/[^\s)]+/gi;
const DATE_PATTERN = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/gi;
const ACCEPTANCE_PATTERN = /\b(accepted|approved|signed off|signoff|acceptance|confirmed|client approved|reviewed and approved)\b/i;

function truncate(value: string, max = 180) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function extractLinks(text: string) {
  return uniqueValues(text.match(URL_PATTERN) ?? []);
}

function extractDates(text: string) {
  return uniqueValues(text.match(DATE_PATTERN) ?? []);
}

function extractEntities(title: string, prompt: string) {
  const text = `${title}\n${prompt}`;
  const capitalized = text.match(/\b[A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,3}\b/g) ?? [];
  const keywordTargets = text.match(/\b(?:protocol|market|company|project|client|agreement|workflow|transaction|report|claim|milestone|handoff|submission|deliverable)\s+["']?([A-Za-z0-9 ._-]{3,60})/gi) ?? [];
  return uniqueValues([...capitalized, ...keywordTargets].slice(0, 10));
}

function buildEvidenceItems(input: ReportInput): SpecialistEvidenceItem[] {
  const links = extractLinks(`${input.taskTitle}\n${input.taskPrompt}`);
  const dates = extractDates(`${input.taskTitle}\n${input.taskPrompt}`);
  const evidence: SpecialistEvidenceItem[] = [
    {
      type: "text_claim",
      label: "Task instruction",
      detail: truncate(input.taskPrompt, 260),
      status: "provided",
      reference: "User-provided prompt",
    },
  ];
  input.inputFiles.forEach((file) => {
    evidence.push({
      type: "file",
      label: file.name,
      detail: `${file.type || "unknown type"}, ${file.size} bytes`,
      status: "provided",
      reference: "Attached file metadata",
    });
  });
  links.forEach((link) => {
    evidence.push({
      type: "link",
      label: "Referenced link",
      detail: link,
      status: "provided",
      reference: "Task prompt",
    });
  });
  dates.forEach((date) => {
    evidence.push({
      type: "timestamp",
      label: "Detected date/time",
      detail: date,
      status: "provided",
      reference: "Task prompt",
    });
  });
  if (ACCEPTANCE_PATTERN.test(input.taskPrompt)) {
    evidence.push({
      type: "acceptance_note",
      label: "Acceptance note",
      detail: "The prompt contains acceptance or approval language.",
      status: "provided",
      reference: "Task prompt",
    });
  }
  return evidence;
}

function dataSources(input: ReportInput, links: string[]) {
  return [
    "User-provided title",
    "User-provided prompt",
    ...(input.inputFiles.length > 0 ? ["Attached file metadata"] : []),
    ...(links.length > 0 ? ["User-provided links"] : []),
  ];
}

function confidenceFromEvidence(input: ReportInput, links: string[]) {
  const score = input.inputFiles.length + links.length + (input.taskPrompt.length > 240 ? 1 : 0);
  if (score >= 3) return "high" as const;
  if (score >= 1) return "medium" as const;
  return "low" as const;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
}

function proofNotes(input: ReportInput) {
  return [
    `Session ID: ${input.sessionId ?? "prepared after save"}`,
    `Owner wallet: ${input.ownerAddress ?? "captured when wallet is connected"}`,
    "Input hash, result hash, trace hash, Walrus reference, replay status, hash match status, and Sui proof status are sealed in the BlackBox session metadata.",
    "External storage or onchain proof success is only claimed after the Walrus/Sui verification flow completes.",
  ];
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

export function formatSpecialistReportForTrace(report: SpecialistAgentReport) {
  const headerMetric = report.metrics.find((metric) =>
    /overall risk|proof strength/i.test(metric.label),
  );
  return [
    `${report.agent} Report`,
    "",
    "Report Header",
    `Agent: ${report.agent}`,
    `${report.subjectLabel}: ${report.subject}`,
    `Confidence: ${report.confidence}`,
    ...(headerMetric ? [`${headerMetric.label}: ${headerMetric.value}`] : []),
    `Timestamp: ${report.generatedAt}`,
    `Data sources used: ${report.dataSourcesUsed.join(", ") || "User-provided input only"}`,
    "",
    "Executive Summary",
    report.cards
      .slice(0, 3)
      .map((card) => `${card.title}: ${card.detail}`)
      .join(" "),
    "",
    "Scorecard",
    ...report.metrics.map((metric) => `${metric.label}: ${metric.value}`),
    "",
    "Evidence & Inputs",
    report.evidenceItems.length > 0
      ? report.evidenceItems
          .map((item) => `${item.label} [${item.status}]: ${item.detail}`)
          .join("\n")
      : "No evidence items were supplied.",
    "",
    "Key Cards",
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
  const links = extractLinks(`${input.taskTitle}\n${input.taskPrompt}`);
  const dates = extractDates(`${input.taskTitle}\n${input.taskPrompt}`);
  const detectedEntities = extractEntities(input.taskTitle, input.taskPrompt);
  const evidenceItems = buildEvidenceItems(input);
  const sources = dataSources(input, links);
  const confidence = confidenceFromEvidence(input, links);
  const noAttachments = input.inputFiles.length === 0 && links.length === 0;
  const generatedAt = input.createdAt ?? new Date().toISOString();

  if (input.agentMode === "research") {
    return {
      kind: "research_brief",
      agent: "Research Agent",
      subjectLabel: "Topic / subject",
      subject: input.taskTitle,
      confidence,
      generatedAt,
      dataSourcesUsed: sources,
      detectedEntities,
      evidenceItems,
      metrics: [
        { label: "Evidence sources", value: String(sources.length), tone: noAttachments ? "warning" : "success" },
        { label: "Detected entities", value: String(detectedEntities.length), tone: "neutral" },
        { label: "External search", value: "Not configured", tone: "warning" },
      ],
      cards: [
        {
          title: "Research scope captured",
          detail: `The report investigates "${input.taskTitle}" using the supplied task, prompt, links, and file metadata.`,
          severity: "info",
          evidence: "Task title and prompt",
          confidence,
          status: "supported",
        },
        {
          title: noAttachments ? "User-provided input only" : "Input evidence available",
          detail: noAttachments
            ? "No supporting files or links were attached, so conclusions must remain preliminary."
            : "The report can reference user-provided files or links as evidence, while avoiding claims about their unseen contents.",
          severity: noAttachments ? "medium" : "low",
          evidence: noAttachments ? "No attached evidence" : "Attached evidence metadata",
          confidence: noAttachments ? "low" : confidence,
          status: noAttachments ? "needs verification" : "supported",
        },
        {
          title: "Fact and inference boundary",
          detail: "The brief separates user-provided facts, reasonable inferences, assumptions, and missing verification steps.",
          severity: "info",
          evidence: "Research Agent scope rule",
          confidence,
          status: "supported",
        },
      ],
      sections: [
        {
          title: "Key Findings",
          items: [
            "Supported: the task title and prompt define the research subject and evidence boundary.",
            noAttachments
              ? "Needs verification: no source files or links were supplied for independent support."
              : "Supported: user-supplied links or file metadata can be cited as input evidence.",
            "Inferred: any conclusion beyond the supplied evidence should be treated as preliminary until independently checked.",
          ],
        },
        {
          title: "Research Scope",
          items: [
            `Investigated subject: ${input.taskTitle}`,
            `Available inputs: ${sources.join(", ")}`,
            noAttachments ? "No external search, live web browsing, or source retrieval is configured for this run." : "User-supplied evidence is cited as input evidence.",
          ],
        },
        {
          title: "Analysis Details",
          items: [
            `Prompt summary: ${truncate(input.taskPrompt, 260)}`,
            detectedEntities.length > 0 ? `Detected entities: ${detectedEntities.join(", ")}` : "No named entities were confidently detected.",
            "Claims are treated as user-provided unless independently verifiable evidence is attached.",
          ],
        },
      ],
      limitations: [
        "No external web/search integration is used for this report.",
        noAttachments
          ? "This is a preliminary report based on user-provided input only."
          : "Attached files are represented by metadata unless their contents are explicitly provided to the Agent Runtime.",
      ],
      recommendedNextActions: [
        "Attach primary sources, source files, or links for stronger evidence-backed findings.",
        "List the claims that must be verified independently.",
        "Store and verify the sealed trace before sharing the report externally.",
      ],
      proofNotes: proofNotes(input),
    };
  }

  if (input.agentMode === "risk_review") {
    const lower = `${input.taskTitle}\n${input.taskPrompt}`.toLowerCase();
    const categories = [
      ["financial risk", /\b(payment|treasury|invoice|price|loss|fund|cost|revenue|settlement)\b/],
      ["technical risk", /\b(api|system|code|deployment|integration|bug|failure|runtime)\b/],
      ["security risk", /\b(wallet|key|signature|exploit|access|permission|auth|attack)\b/],
      ["compliance/liability risk", /\b(policy|agreement|contract|legal|liability|compliance|terms)\b/],
      ["reputation risk", /\b(public|brand|trust|reputation|client concern|complaint|escalation)\b/],
      ["operational risk", /\b(process|workflow|handoff|manual|approval|operation|runbook)\b/],
      ["evidence quality risk", /\b(claim|unverified|missing|unknown|assumption|proof)\b/],
      ["execution/delivery risk", /\b(deliverable|delivery|milestone|handoff|submission|acceptance|deadline)\b/],
      ["data integrity risk", /\b(hash|tamper|integrity|trace|record|metadata|audit)\b/],
      ["onchain/proof risk", /\b(transaction|onchain|sui|walrus|proof|hash|anchor|wallet)\b/],
    ] as const;
    const matchedCategories = categories.filter(([, pattern]) => pattern.test(lower)).map(([label]) => label);
    const criticalSignal = /\b(critical|private key exposed|seed phrase|stolen|breach|exploit|loss of funds|unauthorized transfer|drained)\b/i.test(lower);
    const missingEvidenceCount = [
      input.inputFiles.length === 0,
      links.length === 0,
      !/\b(owner|approver|client|counterparty|responsible)\b/i.test(input.taskPrompt),
      !/\b(deadline|date|timestamp|before|after|by)\b/i.test(input.taskPrompt),
    ].filter(Boolean).length;
    const highSeverity = matchedCategories.includes("security risk") || matchedCategories.includes("financial risk");
    const overallRisk = noAttachments ? "Unknown" : criticalSignal ? "Critical" : highSeverity ? "High" : matchedCategories.length >= 3 ? "Medium" : "Low";
    const highSeverityIssueCount = criticalSignal || highSeverity ? 1 : 0;
    const categoryCards = matchedCategories.slice(0, 5).map((category): SpecialistReportCard => ({
      title: `${titleCase(category)} detected`,
      detail: `The prompt contains language associated with ${category}. Treat this as a review signal, not a confirmed incident, until the underlying artifact is attached.`,
      severity: category.includes("security") || category.includes("financial")
        ? "high"
        : category.includes("compliance") || category.includes("onchain") || category.includes("data integrity")
          ? "medium"
          : "low",
      evidence: "Prompt keyword analysis",
      confidence,
      category,
      likelihood: category.includes("evidence") ? "Medium" : "Low",
      impact: category.includes("security") || category.includes("financial") ? "High" : "Medium",
      mitigation: "Attach source evidence, define the owner/counterparty, and confirm whether the signal is actually present in the reviewed artifact.",
    }));
    return {
      kind: "risk_review",
      agent: "Risk Review Agent",
      subjectLabel: "Review target",
      subject: input.taskTitle,
      confidence: noAttachments ? "low" : confidence,
      generatedAt,
      dataSourcesUsed: sources,
      detectedEntities,
      evidenceItems,
      metrics: [
        { label: "Overall risk", value: overallRisk, tone: overallRisk === "High" || overallRisk === "Critical" ? "danger" : overallRisk === "Medium" || overallRisk === "Unknown" ? "warning" : "success" },
        { label: "Confidence", value: noAttachments ? "Low" : titleCase(confidence), tone: noAttachments ? "warning" : "neutral" },
        { label: "Issues found", value: String(Math.max(1, matchedCategories.length)), tone: matchedCategories.length > 2 ? "warning" : "neutral" },
        { label: "High severity", value: String(highSeverityIssueCount), tone: highSeverityIssueCount > 0 ? "danger" : "success" },
        { label: "Missing evidence", value: String(missingEvidenceCount), tone: missingEvidenceCount > 1 ? "warning" : "neutral" },
      ],
      cards: [
        {
          title: noAttachments ? "Insufficient evidence for final risk rating" : "Risk context captured",
          detail: noAttachments
            ? "The review can identify likely exposure areas, but confidence is limited without files, links, or concrete supporting evidence."
            : "The review target and supplied evidence metadata were captured for severity-ranked analysis.",
          severity: noAttachments ? "medium" : "info",
          evidence: noAttachments ? "User-provided input only" : "Task prompt and evidence metadata",
          confidence: noAttachments ? "low" : confidence,
          category: "evidence quality risk",
          likelihood: noAttachments ? "Medium" : "Low",
          impact: "Medium",
          mitigation: "Attach the artifact under review and define the decision or acceptance criteria.",
        },
        {
          title: matchedCategories.length > 0 ? "Relevant risk categories detected" : "Risk categories need more context",
          detail: matchedCategories.length > 0
            ? `Detected categories: ${matchedCategories.join(", ")}.`
            : "The prompt did not clearly identify a risk category, so the report treats the review as preliminary.",
          severity: matchedCategories.length > 2 ? "high" : matchedCategories.length > 0 ? "medium" : "low",
          evidence: "Prompt keyword analysis",
          confidence,
          category: matchedCategories.join(", ") || "unknown",
          likelihood: matchedCategories.length > 1 ? "Medium" : "Low",
          impact: highSeverity ? "High" : "Medium",
          mitigation: "Confirm the exact artifact, owner, workflow stage, and failure consequence.",
        },
        ...categoryCards,
        {
          title: "Proof and data integrity exposure",
          detail: "Any final decision should rely on the sealed trace, hash comparison, Walrus readback, and Sui proof status rather than an editable local report.",
          severity: "info",
          evidence: "Agent BlackBox proof boundary",
          confidence: "high",
          category: "data integrity risk",
          likelihood: "Low",
          impact: "High",
          mitigation: "Verify the report through the session proof page before external reliance.",
        },
      ],
      sections: [
        {
          title: "Missing Information",
          items: [
            input.inputFiles.length === 0 ? "Attach the artifact, report, agreement, process, or transaction details under review." : "Attached file metadata is present.",
            links.length === 0 ? "Add source links or references that support the reviewed claim." : "Prompt includes user-provided links.",
            /\b(owner|approver|client|counterparty|responsible)\b/i.test(input.taskPrompt)
              ? "Owner/counterparty context is present."
              : "Identify owner, approver, client, counterparty, or responsible party.",
            /\b(deadline|date|timestamp|before|after|by)\b/i.test(input.taskPrompt)
              ? "Timing context is present."
              : "Add deadline, date, timestamp, or workflow stage.",
          ],
        },
        {
          title: "Exposure Analysis",
          items: [
            `Review target: ${input.taskTitle}`,
            matchedCategories.length > 0 ? `Primary exposures: ${matchedCategories.join(", ")}` : "Primary exposures require more detail.",
            "Potential consequences may include rework, financial loss, missed acceptance, operational delay, or weak proof confidence depending on the final evidence.",
          ],
        },
        {
          title: "Mitigation Plan",
          items: [
            "1. Attach the artifact or evidence being reviewed.",
            "2. Identify owner, counterparty, decision threshold, and deadline.",
            "3. Resolve high-severity findings before anchoring or sharing the report.",
          ],
        },
      ],
      limitations: [
        noAttachments ? "Risk confidence is limited because no supporting files or links were attached." : "Risk findings rely on supplied context and evidence metadata.",
        "This report does not confirm facts outside the supplied prompt/evidence.",
      ],
      recommendedNextActions: [
        "Attach the transaction, agreement, workflow, report, or evidence file under review.",
        "Define what outcome would count as unacceptable risk.",
        "Verify the sealed report and hashes before relying on the assessment.",
      ],
      proofNotes: proofNotes(input),
    };
  }

  if (input.agentMode === "delivery_proof") {
    const hasAcceptance = ACCEPTANCE_PATTERN.test(input.taskPrompt);
    const evidenceScore = input.inputFiles.length + links.length + dates.length + (hasAcceptance ? 1 : 0);
    const proofStrength = evidenceScore >= 4 ? "Strong" : evidenceScore >= 2 ? "Moderate" : "Weak";
    const missing = [
      input.inputFiles.length === 0 ? "No final file attached" : "",
      links.length === 0 ? "No delivery link/reference provided" : "",
      dates.length === 0 ? "No delivery timestamp detected" : "",
      !hasAcceptance ? "No acceptance note provided" : "",
    ].filter(Boolean);
    return {
      kind: "delivery_receipt",
      agent: "Delivery Proof Agent",
      subjectLabel: "Delivery title",
      subject: input.taskTitle,
      confidence: proofStrength === "Strong" ? "high" : proofStrength === "Moderate" ? "medium" : "low",
      generatedAt,
      dataSourcesUsed: sources,
      detectedEntities,
      evidenceItems: [
        ...evidenceItems,
        ...missing.map((item): SpecialistEvidenceItem => ({
          type: "metadata",
          label: item,
          detail: item,
          status: "missing",
          reference: "Delivery proof checklist",
        })),
      ],
      metrics: [
        { label: "Proof strength", value: proofStrength, tone: proofStrength === "Strong" ? "success" : proofStrength === "Moderate" ? "warning" : "danger" },
        { label: "Evidence items", value: String(evidenceItems.length), tone: evidenceItems.length > 1 ? "success" : "warning" },
        { label: "Missing items", value: String(missing.length), tone: missing.length > 0 ? "warning" : "success" },
      ],
      cards: [
        {
          title: "Delivery claim recorded",
          detail: `The delivery task "${input.taskTitle}" was captured as a sealed proof session.`,
          severity: "info",
          evidence: "Task title and prompt",
          confidence,
          status: "provided",
        },
        {
          title: `Proof strength: ${proofStrength}`,
          detail: proofStrength === "Strong"
            ? "The delivery record includes multiple evidence signals such as attachments, links, timestamps, or acceptance language."
            : proofStrength === "Moderate"
              ? "The delivery record has some evidence, but would be stronger with acceptance notes and final deliverables."
              : "The delivery record is mostly a text claim and needs stronger evidence before external reliance.",
          severity: proofStrength === "Weak" ? "medium" : "info",
          evidence: "Delivery evidence checklist",
          confidence: proofStrength === "Strong" ? "high" : proofStrength === "Moderate" ? "medium" : "low",
          status: proofStrength.toLowerCase(),
        },
        {
          title: hasAcceptance ? "Acceptance note detected" : "No acceptance note provided",
          detail: hasAcceptance
            ? "The prompt includes acceptance or approval language."
            : "A client or reviewer acceptance note would materially strengthen the delivery proof.",
          severity: hasAcceptance ? "info" : "low",
          evidence: "Task prompt",
          confidence: hasAcceptance ? "medium" : "low",
          status: hasAcceptance ? "provided" : "missing",
        },
      ],
      sections: [
        {
          title: "Delivery Receipt",
          items: [
            `Delivered item/work: ${input.taskTitle}`,
            `Delivered by: ${input.ownerAddress ?? "Wallet owner captured when connected"}`,
            detectedEntities.length > 0 ? `Client/project/task references: ${detectedEntities.join(", ")}` : "Client/project reference was not clearly detected.",
            dates.length > 0 ? `Detected delivery date/time: ${dates.join(", ")}` : "Delivery date/time was not detected.",
            `Acceptance status: ${hasAcceptance ? "Acceptance language detected" : "No acceptance note provided"}`,
            `Attached evidence count: ${input.inputFiles.length}`,
          ],
        },
        {
          title: "Handoff Trail",
          items: [
            "Task described by user.",
            evidenceItems.length > 1 ? "Evidence metadata attached or referenced." : "Evidence is currently mostly text-based.",
            "Report generated as structured Agent Runtime output.",
            "Trace prepared for sealing, Walrus storage, replay, and Sui proof anchoring.",
          ],
        },
        {
          title: "Acceptance Notes",
          items: [
            hasAcceptance ? "Explicit acceptance or approval language was detected in the prompt." : "No acceptance note provided.",
          ],
        },
        {
          title: "Proof Strength Analysis",
          items: [
            `Proof strength is ${proofStrength} because the delivery record includes ${evidenceItems.length} provided evidence item(s) and ${missing.length} missing checklist item(s).`,
            "Strong proof usually includes final deliverables, delivery timestamp, client/project reference, acceptance note, and a sealed verification link.",
          ],
        },
        {
          title: "Missing Evidence",
          items: missing.length > 0 ? missing : ["No major delivery-proof checklist gaps detected from the supplied prompt."],
        },
      ],
      limitations: [
        ...missing,
        "Delivery proof does not confirm recipient acceptance unless an acceptance note is supplied.",
      ],
      recommendedNextActions: [
        "Attach final deliverable files or delivery links.",
        "Add client/project reference and explicit acceptance notes.",
        "Share the sealed proof link after Walrus storage and verification complete.",
      ],
      proofNotes: proofNotes(input),
    };
  }

  return undefined;
}
