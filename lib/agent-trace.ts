import {
  createHashFromString,
  createResultHash,
  createTraceHash,
} from "@/lib/hash";
import { AGENT_MODE_DEFINITIONS } from "@/lib/agents/agent-prompts";
import {
  buildSpecialistAgentReport,
  formatSpecialistReportForTrace,
} from "@/lib/agents/specialist-report";
import type { AgentRuntimeOutput } from "@/lib/agents/types";
import { normalizeSuiNetwork } from "@/lib/network-config";
import { getSuiProofRegistryConfig } from "@/lib/sui-proof";
import type {
  AgentMode,
  AgentSession,
  AgentTrace,
  CreateSessionInput,
  InputFile,
  ToolCall,
  TraceTimelineItem,
} from "@/types/blackbox";

function offsetTimestamp(createdAt: string, seconds: number) {
  return new Date(new Date(createdAt).getTime() + seconds * 1000).toISOString();
}

function deterministicLocalId(prefix: string, seed: string, length = 36) {
  return `${prefix}${createHashFromString(seed).slice(0, length)}`;
}

export function buildInputFiles(input: CreateSessionInput): InputFile[] {
  return (input.files ?? []).map((file, index) => ({
    id: `file-${index + 1}`,
    ...file,
    contentHash: createHashFromString(`${file.name}:${file.type}:${file.size}`),
  }));
}

function buildToolCalls(sessionId: string, createdAt: string): ToolCall[] {
  return [
    {
      id: "tool-01",
      name: "intent.extract",
      description: "Normalized the operator instruction into an auditable task envelope.",
      inputHash: createHashFromString(`${sessionId}:intent:in`),
      outputHash: createHashFromString(`${sessionId}:intent:out`),
      status: "complete",
      timestamp: offsetTimestamp(createdAt, 8),
    },
    {
      id: "tool-02",
      name: "evidence.inspect",
      description: "Inspected available input metadata and prepared the evidence manifest.",
      inputHash: createHashFromString(`${sessionId}:evidence:in`),
      outputHash: createHashFromString(`${sessionId}:evidence:out`),
      status: "complete",
      timestamp: offsetTimestamp(createdAt, 17),
    },
    {
      id: "tool-03",
      name: "report.compose",
      description: "Composed the final task result and sealed the replayable trace.",
      inputHash: createHashFromString(`${sessionId}:report:in`),
      outputHash: createHashFromString(`${sessionId}:report:out`),
      status: "complete",
      timestamp: offsetTimestamp(createdAt, 28),
    },
  ];
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

function extractSuiAddressCandidates(value: string) {
  return uniqueValues(value.match(/0x[a-fA-F0-9]{16,64}/g) ?? []);
}

function buildLocalReportSections({
  agentMode,
  title,
  prompt,
  sessionId,
  inputFiles = [],
  createdAt,
  ownerAddress,
}: {
  agentMode: AgentMode;
  title: string;
  prompt: string;
  sessionId?: string;
  inputFiles?: Array<Pick<InputFile, "name" | "type" | "size">>;
  createdAt?: string;
  ownerAddress?: string | null;
}) {
  const promptPreview = prompt.length > 180 ? `${prompt.slice(0, 180)}...` : prompt;
  const proofNote =
    "Proof metadata will include the input hash, result hash, trace hash, Walrus storage reference, Sui proof fields, and Tatum RPC verification status when the session is finalized.";

  if (agentMode === "onchain_monitor") {
    const suiTargets = extractSuiAddressCandidates(`${title}\n${prompt}`);
    const targetLine = suiTargets.length > 0
      ? `Detected Sui address-format target(s): ${suiTargets.join(", ")}.`
      : "No Sui wallet address, object ID, package ID, or transaction digest was supplied.";
    return {
      executiveSummary:
        suiTargets.length > 0
          ? `Sui Onchain Analyzer prepared a preliminary Sui target report for "${title}" using the supplied wallet or address-format evidence.`
          : `Sui Onchain Analyzer prepared an evidence boundary report for "${title}" and flagged the missing Sui target input.`,
      finalOutput: [
        `Sui Onchain Analyzer Report: ${title}`,
        "",
        "Target Analyzed",
        targetLine,
        "",
        "Evidence Reviewed",
        `Operator prompt: ${promptPreview}`,
        "No wallet activity was fabricated. Live enrichment requires a Sui wallet, transaction digest, object ID, or package ID.",
        "",
        "Findings",
        suiTargets.length > 0
          ? "A Sui address-format target was detected from the title or prompt and can be used as the starting point for wallet or object review."
          : "The task does not yet contain a usable Sui target, so the report cannot claim observed onchain activity.",
        "The local trace captures the operator intent and target-detection result for replay.",
        "",
        "Limitations",
        "This local deterministic report does not prove balances, transfers, object state, or transaction history.",
        "",
        "Recommended Next Actions",
        "Add a transaction digest, object ID, package ID, or indexed wallet history snapshot for deeper Sui analysis.",
        proofNote,
      ].join("\n"),
      findings: [
        {
          title: suiTargets.length > 0 ? "Sui target detected" : "Onchain target missing",
          detail: targetLine,
          severity: suiTargets.length > 0 ? "info" as const : "medium" as const,
          evidence: "Task title and prompt",
        },
        {
          title: "RPC enrichment boundary",
          detail:
            "Wallet-only context is useful input, but this local report does not fabricate live activity without transaction, object, package, or indexed history evidence.",
          severity: "info" as const,
          evidence: "Agent Runtime tool boundary",
        },
        {
          title: "Proof-ready trace",
          detail: proofNote,
          severity: "info" as const,
          evidence: "BlackBox trace metadata",
        },
      ],
      limitations: [
        "Local preparation does not confirm Walrus Mainnet storage, direct aggregator readback, or Sui proof anchoring.",
        "Wallet activity, balances, and transaction history are not claimed unless live or supplied evidence is present.",
      ],
      recommendedNextActions: [
        "Provide a transaction digest, object ID, package ID, or wallet history export for deeper analysis.",
        "Finalize storage on Walrus Mainnet and anchor the proof on Sui Mainnet before treating the report as externally verified.",
      ],
    };
  }

  const specialistAnalysis = buildSpecialistAgentReport({
    sessionId,
    agentMode,
    taskTitle: title,
    taskPrompt: prompt,
    inputFiles,
    ownerAddress,
    createdAt,
  });

  if (specialistAnalysis) {
    return {
      executiveSummary: specialistAnalysis.cards
        .slice(0, 3)
        .map((card) => `${card.title}: ${card.detail}`)
        .join(" "),
      finalOutput: formatSpecialistReportForTrace(specialistAnalysis),
      findings: specialistAnalysis.cards.map((card) => ({
        title: card.title,
        detail: card.detail,
        severity: card.severity,
        evidence: card.evidence,
      })),
      limitations: specialistAnalysis.limitations,
      recommendedNextActions: specialistAnalysis.recommendedNextActions,
      specialistAnalysis,
    };
  }

  const modeCopy: Record<Exclude<AgentMode, "onchain_monitor">, {
    executiveSummary: string;
    findings: Array<{ title: string; detail: string; severity: "info" | "low" | "medium" | "high" | "critical"; evidence: string }>;
    recommendedNextActions: string[];
  }> = {
    research: {
      executiveSummary: `Research Agent prepared an evidence-aware brief for "${title}" from the supplied task context.`,
      findings: [
        {
          title: "Research question captured",
          detail: "The user intent was normalized into a traceable research task.",
          severity: "info",
          evidence: "Task title and prompt",
        },
        {
          title: "Evidence boundary recorded",
          detail: "The report distinguishes supplied context from facts that would require external source review.",
          severity: "low",
          evidence: "Input metadata and prompt",
        },
        {
          title: "Verification-ready output",
          detail: proofNote,
          severity: "info",
          evidence: "BlackBox trace metadata",
        },
      ],
      recommendedNextActions: [
        "Attach source files or links for stronger source-backed findings.",
        "Finalize Walrus storage and Sui proof anchoring for independent replay.",
      ],
    },
    risk_review: {
      executiveSummary: `Risk Review Agent prepared a liability-aware review for "${title}" from the supplied decision context.`,
      findings: [
        {
          title: "Decision context captured",
          detail: "The task prompt was recorded as the review boundary for risk classification.",
          severity: "info",
          evidence: "Task title and prompt",
        },
        {
          title: "Material exposure requires evidence",
          detail: "Risk severity should be treated as preliminary until the underlying policy, contract, or operational artifact is supplied.",
          severity: "medium",
          evidence: "Available input metadata",
        },
        {
          title: "Audit trail prepared",
          detail: proofNote,
          severity: "info",
          evidence: "BlackBox trace metadata",
        },
      ],
      recommendedNextActions: [
        "Attach the artifact under review and acceptance criteria for a stronger risk score.",
        "Review high-severity findings before anchoring the final report.",
      ],
    },
    delivery_proof: {
      executiveSummary: `Delivery Proof Agent prepared an auditable handoff record for "${title}" from the supplied completion context.`,
      findings: [
        {
          title: "Delivery intent captured",
          detail: "The requested handoff was recorded as a verifiable delivery-proof session.",
          severity: "info",
          evidence: "Task title and prompt",
        },
        {
          title: "Acceptance evidence needed",
          detail: "The strongest receipt includes deliverable files, acceptance notes, reviewer identity, and completion criteria.",
          severity: "low",
          evidence: "Input metadata",
        },
        {
          title: "Proof metadata prepared",
          detail: proofNote,
          severity: "info",
          evidence: "BlackBox trace metadata",
        },
      ],
      recommendedNextActions: [
        "Attach final deliverables and acceptance notes before sending the proof link.",
        "Store the trace on Walrus Mainnet and anchor it on Sui Mainnet for third-party verification.",
      ],
    },
  };

  const selected = modeCopy[agentMode];
  return {
    executiveSummary: selected.executiveSummary,
    finalOutput: [
      `${selected.executiveSummary}`,
      "",
      "Evidence Reviewed",
      `Operator prompt: ${promptPreview}`,
      "",
      "Findings",
      ...selected.findings.map((finding) => `${finding.title}: ${finding.detail}`),
      "",
      "Limitations",
      "This deterministic local report does not claim external storage, proof anchoring, or live source verification.",
      "",
      "Recommended Next Actions",
      ...selected.recommendedNextActions,
      proofNote,
    ].join("\n"),
    findings: selected.findings,
    limitations: [
      "Local preparation does not confirm Walrus Mainnet storage, direct aggregator readback, or Sui proof anchoring.",
      "External facts are not claimed unless the user supplies evidence or live verification completes.",
    ],
    recommendedNextActions: selected.recommendedNextActions,
  };
}

function buildLocalStructuredOutput(
  agentMode: AgentMode,
  title: string,
  prompt: string,
  options: {
    sessionId?: string;
    inputFiles?: Array<Pick<InputFile, "name" | "type" | "size">>;
    createdAt?: string;
    ownerAddress?: string | null;
  } = {},
): AgentRuntimeOutput {
  const definition = AGENT_MODE_DEFINITIONS[agentMode];
  const localReport = buildLocalReportSections({
    agentMode,
    title,
    prompt,
    ...options,
  });
  const specialistAnalysis = "specialistAnalysis" in localReport
    ? localReport.specialistAnalysis
    : undefined;
  return {
    agentMode,
    agentDisplayName: definition.displayName,
    taskTitle: title,
    executiveSummary: localReport.executiveSummary,
    plan: definition.planFocus.map((step, index) => ({
      step: index + 1,
      title: step.replace(/\.$/, ""),
      status: "completed",
      reasoningSummary: "Local deterministic preparation summary recorded for the trace archive.",
    })),
    toolCalls: [
      {
        toolName: "recordInputEvidence",
        purpose: "Summarizes user prompt and file metadata.",
        inputSummary: prompt.slice(0, 220),
        outputSummary: "Local evidence metadata recorded for the trace archive.",
        status: "completed",
      },
      {
        toolName: "generatePlan",
        purpose: "Creates agent execution plan.",
        inputSummary: definition.displayName,
        outputSummary: definition.planFocus.join(" "),
        status: "completed",
      },
      {
        toolName: "finalizeAgentReport",
        purpose: "Creates final report.",
        inputSummary: title,
        outputSummary: "Local deterministic report prepared. External storage/proof checks are not implied.",
        status: "completed",
      },
    ],
    findings: localReport.findings,
    finalOutput: localReport.finalOutput,
    confidence: specialistAnalysis?.confidence ?? "medium",
    limitations: localReport.limitations,
    recommendedNextActions: localReport.recommendedNextActions,
    ...(specialistAnalysis ? { specialistAnalysis } : {}),
  };
}

function buildRuntimeToolCalls(sessionId: string, createdAt: string, output: AgentRuntimeOutput): ToolCall[] {
  return output.toolCalls.map((tool, index) => ({
    id: `tool-${String(index + 1).padStart(2, "0")}`,
    name: tool.toolName,
    description: `${tool.purpose} ${tool.outputSummary}`,
    inputHash: createHashFromString(`${sessionId}:${tool.toolName}:in:${tool.inputSummary}`),
    outputHash: createHashFromString(`${sessionId}:${tool.toolName}:out:${tool.outputSummary}`),
    status: tool.status === "failed" ? "failed" : "complete",
    timestamp: offsetTimestamp(createdAt, 8 + index * 7),
  }));
}

export function createTraceTimeline(trace: AgentTrace): TraceTimelineItem[] {
  const descriptions = [
    ["User intent captured", "Operator instruction written into the session envelope."],
    ["Input file metadata recorded", "File names, types, sizes, and content hashes added to the manifest."],
    ["Input hash generated", "Deterministic input fingerprint sealed for later comparison."],
    ["Agent plan generated", "Task execution steps recorded before completion."],
    ["Tool calls recorded", "Tool inputs and outputs added to the forensic timeline."],
    ["Final output generated", "Agent result captured as replayable session evidence."],
    ["Trace hash sealed", "Trace fields normalized and sealed with a deterministic hash."],
    ["Trace prepared for Walrus storage", "Trace bundle prepared for the canonical Walrus blob-storage path."],
    ["Walrus blob reference prepared", "Blob ID and Walrus object reference prepared for storage evidence."],
    ["Direct Walrus verification prepared", "Blob read and integrity comparison path prepared."],
    ["Sui proof anchor prepared", "Lightweight proof metadata prepared for the Sui registry."],
    ["Tatum RPC verification prepared", "Server-side Sui proof read and verification path prepared."],
  ] as const;

  return descriptions.map(([label, description], index) => ({
    id: `timeline-${String(index + 1).padStart(2, "0")}`,
    label,
    description,
    status: index < 7 ? "complete" : "prepared",
    timestamp: offsetTimestamp(trace.createdAt, index * 6),
  }));
}

export function generateAgentTrace(input: CreateSessionInput & { id: string }): AgentTrace {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const inputFiles = buildInputFiles(input);
  const inputHash = createHashFromString(
    JSON.stringify({
      prompt: input.prompt,
      files: inputFiles.map(({ name, type, size, contentHash }) => ({
        name,
        type,
        size,
        contentHash,
      })),
    }),
  );
  const agentPlan = [
    "Capture operator intent and evidence manifest.",
    "Inspect task context and record deterministic tool-call evidence.",
    "Generate the requested result and seal the replayable trace.",
    "Prepare storage and proof metadata for external certification.",
  ];
  const structuredOutput = buildLocalStructuredOutput(input.agentMode, input.title, input.prompt, {
    sessionId: input.id,
    inputFiles,
    createdAt,
    ownerAddress: input.ownerAddress,
  });
  const toolCalls = buildRuntimeToolCalls(input.id, createdAt, structuredOutput);
  const finalOutput = structuredOutput.finalOutput;
  const resultHash = createResultHash(finalOutput);
  const baseTrace: AgentTrace = {
    sessionId: input.id,
    userIntent: input.prompt,
    agentPlan,
    toolCalls,
    structuredOutput,
    finalOutput,
    inputHash,
    traceHash: "",
    resultHash,
    timeline: [],
    createdAt,
  };
  const traceHash = createTraceHash(baseTrace);
  const trace = { ...baseTrace, traceHash };
  return { ...trace, timeline: createTraceTimeline(trace) };
}

export function generateAgentTraceFromRuntime(
  input: CreateSessionInput & { id: string },
  structuredOutput: AgentRuntimeOutput,
): AgentTrace {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const inputFiles = buildInputFiles(input);
  const inputHash = createHashFromString(
    JSON.stringify({
      prompt: input.prompt,
      agentMode: input.agentMode,
      ownerAddress: input.ownerAddress,
      files: inputFiles.map(({ name, type, size, contentHash }) => ({
        name,
        type,
        size,
        contentHash,
      })),
    }),
  );
  const agentPlan = structuredOutput.plan.map((step) => step.title);
  const toolCalls = buildRuntimeToolCalls(input.id, createdAt, structuredOutput);
  const finalOutput = structuredOutput.finalOutput;
  const resultHash = createResultHash(finalOutput);
  const baseTrace: AgentTrace = {
    sessionId: input.id,
    userIntent: input.prompt,
    agentPlan,
    toolCalls,
    structuredOutput,
    finalOutput,
    inputHash,
    traceHash: "",
    resultHash,
    timeline: [],
    createdAt,
  };
  const traceHash = createTraceHash(baseTrace);
  const trace = { ...baseTrace, traceHash };
  return { ...trace, timeline: createTraceTimeline(trace) };
}

export function createLocalAgentSession(input: CreateSessionInput, structuredOutput?: AgentRuntimeOutput): AgentSession {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const id = input.id ?? `abx-${Date.now().toString(36)}`;
  const normalizedInput = { ...input, id, createdAt };
  const trace = structuredOutput
    ? generateAgentTraceFromRuntime(normalizedInput, structuredOutput)
    : generateAgentTrace(normalizedInput);
  const inputFiles = buildInputFiles(normalizedInput);
  const uploadJobId = deterministicLocalId("local-upload-", `${id}:job`, 18);
  const blobId = deterministicLocalId("local-blob-", `${id}:blob`, 30);
  const blobObjectId = deterministicLocalId("local-object-", `${id}:walrus-object`, 30);
  const ownerAddress = input.ownerAddress ?? null;
  const expiryDate = new Date(
    new Date(createdAt).getTime() + (input.storageEpochs ?? 5) * 24 * 60 * 60 * 1000,
  ).toISOString();
  const checkedAt = offsetTimestamp(createdAt, 76);
  const proofRegistry = getSuiProofRegistryConfig();

  return {
    id,
    ...(input.rerunOf ? { rerunOf: input.rerunOf } : {}),
    title: input.title,
    prompt: input.prompt,
    agentMode: input.agentMode,
    ownerAddress,
    createdAt,
    updatedAt: checkedAt,
    status: "pending",
    inputFiles,
    trace,
    storage: {
      uploadJobId,
      fileName: `${id}-trace.json`,
      fileType: "application/json",
      fileSize: JSON.stringify(trace).length,
      storageProvider: "local",
      uploadAdapter: "local",
      storageStatus: "prepared",
      storageEpochs: input.storageEpochs ?? 5,
      expiryDate,
      blobId,
      blobObjectId,
      directReadUrl: `/api/storage/read/${blobId}`,
      hashMatched: true,
      noRenewal: false,
      createdAt,
      updatedAt: checkedAt,
    },
    storageMode: input.storageMode ?? "deletable",
    storageEpochs: input.storageEpochs ?? 5,
    walrusVerification: {
      blobId,
      objectId: blobObjectId,
      readStatus: "unknown",
      availabilityStatus: "unknown",
      directReadUrl: `/api/storage/read/${blobId}`,
      hashMatched: true,
      checkedAt,
    },
    proof: {
      suiObjectId: "proof-object-pending",
      transactionDigest: "transaction-pending",
      owner: ownerAddress,
      network: normalizeSuiNetwork(process.env.NEXT_PUBLIC_SUI_NETWORK),
      packageId: proofRegistry.packageId || "package-id-pending",
      moduleName: proofRegistry.moduleName,
      createFunction: proofRegistry.createFunction,
      traceHash: trace.traceHash,
      resultHash: trace.resultHash,
      uploadJobId,
      uploadAdapter: "local",
      storageProvider: "local",
      blobId,
      blobObjectId,
      proofMode: "local",
      status: "prepared",
      createdAt,
    },
    tatumRpc: {
      status: "local_phase1",
      configured: false,
      onchain: false,
      checkedAt,
      objectFound: null,
      transactionFound: null,
      eventFound: null,
      message:
        "This session has local proof metadata. Anchor on Sui Mainnet for independent proof verification.",
    },
    verification: {
      storagePrepared: true,
      walrusBlobAvailable: false,
      directWalrusReadPassed: false,
      suiProofFound: false,
      tatumRpcPassed: false,
      hashMatched: true,
      tamperDetected: false,
      checkedAt,
    },
  };
}
