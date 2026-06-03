import type { AgentMode } from "@/types/blackbox";

export const AGENT_MODE_DEFINITIONS: Record<
  AgentMode,
  {
    displayName: string;
    purpose: string;
    requiredSections: string[];
    planFocus: string[];
  }
> = {
  research: {
    displayName: "Research Agent",
    purpose: "Finds and explains: investigates a project, market, protocol, company, topic, claim, document, or evidence set.",
    requiredSections: [
      "professional report header",
      "executive summary",
      "research scope",
      "key findings with confidence and supported/inferred/needs verification status",
      "evidence and inputs",
      "analysis details",
      "limitations",
      "next actions",
      "proof metadata",
    ],
    planFocus: [
      "Parse the topic, question, detected entities, links, claims, and evidence boundaries.",
      "Separate user-provided facts, assumptions, inferences, missing evidence, and verification needs.",
      "Produce a professional research brief that stays useful even when evidence is limited.",
    ],
  },
  risk_review: {
    displayName: "Risk Review Agent",
    purpose: "Checks what could go wrong: reviews a transaction, process, report, project, agreement, claim, or workflow for exposure.",
    requiredSections: [
      "professional report header",
      "executive summary",
      "risk scorecard",
      "severity-ranked key risks",
      "missing information",
      "exposure analysis",
      "mitigation plan",
      "limitations",
      "proof metadata",
    ],
    planFocus: [
      "Identify the target under review and classify the likely risk categories.",
      "Rank risks by severity, evidence quality, likelihood, impact, and confidence.",
      "Produce missing-information notes and mitigation steps without overclaiming.",
    ],
  },
  delivery_proof: {
    displayName: "Delivery Proof Agent",
    purpose: "Proves work was delivered: creates a receipt for completion, client delivery, handoff, submission, milestone, or acceptance.",
    requiredSections: [
      "professional report header",
      "delivery receipt",
      "executive summary",
      "evidence bundle",
      "handoff trail",
      "acceptance notes",
      "proof strength analysis",
      "missing evidence",
      "next actions",
      "proof metadata",
    ],
    planFocus: [
      "Parse the delivered work, client/project references, timestamps, evidence, and acceptance notes.",
      "Separate claimed delivery from supplied evidence and missing proof elements.",
      "Produce a sealed delivery receipt with proof strength and next actions.",
    ],
  },
  onchain_monitor: {
    displayName: "Multichain Onchain Analyzer",
    purpose: "Trace-backed multichain analysis for Sui wallet, transaction, object, package, and EVM wallet, transaction, or contract activity.",
    requiredSections: [
      "target analyzed",
      "detected chain and target type",
      "detected wallet, object, package, transaction, or contract identifiers",
      "RPC evidence when available",
      "risk signals and data gaps",
      "limitations",
      "recommended actions",
    ],
    planFocus: [
      "Identify the onchain target and available evidence.",
      "Detect Sui and EVM identifiers, chain mentions, provider readiness, and ambiguity from the title and prompt.",
      "Keep Sui and Walrus as the primary Agent BlackBox proof path while adding EVM enrichment when supported.",
      "Produce a chain-aware target analysis while clearly stating when live chain activity was not read.",
    ],
  },
};

export function buildAgentSystemPrompt(agentMode: AgentMode) {
  const definition = AGENT_MODE_DEFINITIONS[agentMode];
  return [
    "You are the Agent Runtime for Agent BlackBox.",
    "Return strict JSON only. Do not include markdown fences.",
    "Do not expose hidden reasoning. Only provide user-safe summaries: plan, tool-call summaries, observations, final answer, limitations, confidence, and next actions.",
    "Do not mention API providers, model names, or implementation branding.",
    `Specialist: ${definition.displayName}.`,
    `Purpose: ${definition.purpose}`,
    `The final report must cover: ${definition.requiredSections.join("; ")}.`,
    "Reports should be professional and useful to a normal user: explain what was reviewed, what was found, what evidence supports it, what remains unknown, and what to do next.",
    "Never fabricate chain data, source data, file contents, signatures, storage success, or proof success.",
    agentMode === "onchain_monitor"
      ? "For Multichain Onchain Analyzer, use the analyzeOnchainTarget tool observation as the source of truth for detected chain, target type, provider status, assumptions, limitations, and proof metadata. A Sui wallet/address, Sui object/package ID, Sui transaction digest, EVM address, EVM transaction hash, or EVM contract address is useful input. If live provider enrichment is missing, produce a professional preliminary report and do not invent activity. Sui/Walrus remains the primary Agent BlackBox proof story; EVM is additional multichain enrichment."
      : "For Research, Risk Review, and Delivery Proof agents, use the analyzeSpecialistAgentContext tool observation as the source of truth for detected entities, evidence items, missing-data state, scorecard/proof strength, limitations, and recommended next actions. If no external source/search or file-content retrieval is available, explicitly say the report is based on user-provided inputs and attached metadata only. Missing data should produce a useful preliminary report, not a useless failure.",
    "If a needed input is missing, say exactly what is missing and lower confidence appropriately.",
  ].filter(Boolean).join("\n");
}

export function buildAgentUserPrompt({
  taskTitle,
  taskPrompt,
  fileEvidence,
  toolObservations,
}: {
  taskTitle: string;
  taskPrompt: string;
  fileEvidence: string;
  toolObservations: string;
}) {
  return [
    `Task title: ${taskTitle}`,
    `Task prompt: ${taskPrompt}`,
    `Input evidence: ${fileEvidence}`,
    "Tool observations available to summarize:",
    toolObservations,
    "Produce a specialist report that is specific to the task and suitable for a sealed BlackBox Trace. Include evidence-backed findings, limitations, and concrete next actions.",
  ].join("\n\n");
}
