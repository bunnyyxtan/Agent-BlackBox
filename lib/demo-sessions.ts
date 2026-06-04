import "server-only";

import { createLocalAgentSession } from "@/lib/agent-trace";
import type { AgentRuntimeOutput } from "@/lib/agents/types";
import { hydrateLocalStoredTrace } from "@/lib/storage-adapters/local";
import { createTraceBundleFromSession } from "@/lib/trace-bundle";
import type { AgentMode, AgentSession, CreateSessionInput } from "@/types/blackbox";

const SAMPLE_OWNER = null;

const sampleInputs: Array<CreateSessionInput & { finalOutput: string; summary: string; findings: string[] }> = [
  {
    id: "sample-sui-wallet-holdings",
    title: "Sui Wallet Holdings Analysis",
    prompt:
      "Analyze a Sui wallet and explain how Agent BlackBox records balance checks, token metadata, and proof evidence for a Sui-native wallet report.",
    agentMode: "onchain_monitor",
    storageEpochs: 1,
    createdAt: "2026-06-03T10:00:00.000Z",
    ownerAddress: SAMPLE_OWNER,
    summary:
      "Sample Sui wallet analysis showing how token holdings, RPC evidence, and trace hashes appear after a real analyzer run.",
    findings: [
      "The active product scope is Sui-native: wallet, object, package, and transaction analysis use Sui RPC data.",
      "A real run fetches balances through Sui JSON-RPC, formats coin metadata, and seals the report into the trace.",
      "This sample is not a wallet-signed proof and does not claim live balances for the current visitor.",
    ],
    finalOutput: [
      "Sample Trace: Sui Wallet Holdings Analysis",
      "",
      "This sample shows the kind of output a real Sui wallet analyzer session produces. In a live run, Agent BlackBox reads Sui balances and coin metadata, then seals the findings with input, result, and trace hashes.",
      "",
      "What a real run records:",
      "- Detected Sui wallet address",
      "- SUI and token balances returned by Sui RPC",
      "- Coin metadata such as symbol, name, and decimals",
      "- Tool evidence for balance lookup and metadata lookup",
      "- A sealed report ready for Walrus storage and Sui proof anchoring",
      "",
      "Sample boundary:",
      "This is demonstration data only. Run your own Sui analyzer session to create wallet-specific proof that can be stored on Walrus and anchored on Sui.",
    ].join("\n"),
  },
  {
    id: "sample-walrus-storage-research",
    title: "Walrus Storage Research",
    prompt:
      "Research how Walrus can store sealed Agent BlackBox trace bundles and support readback verification for AI agent evidence.",
    agentMode: "research",
    storageEpochs: 1,
    createdAt: "2026-06-03T10:08:00.000Z",
    ownerAddress: SAMPLE_OWNER,
    files: [{ name: "sample-walrus-trace-brief.md", type: "text/markdown", size: 18432 }],
    summary:
      "Sample research brief explaining Walrus trace storage, aggregator readback, replay, and hash comparison.",
    findings: [
      "Walrus is the storage layer for the full BlackBox trace bundle.",
      "Readback through the aggregator lets the verifier recompute and compare the trace hash.",
      "Sui should anchor compact proof metadata, not the full agent trace.",
    ],
    finalOutput: [
      "Sample Trace: Walrus Storage Research",
      "",
      "Walrus gives Agent BlackBox a public, replayable storage layer for sealed agent traces. The app prepares a deterministic trace bundle, stores it as a Walrus blob, reads it back through the aggregator, and compares the returned payload against the sealed trace hash.",
      "",
      "Why it matters:",
      "- The final answer is not the only artifact; the full agent trace remains inspectable.",
      "- A verifier can read the stored blob independently.",
      "- Hash mismatch makes altered evidence visible.",
      "- Sui proof anchoring can point to the compact trace and blob references.",
      "",
      "Sample boundary:",
      "This is a curated sample trace. A real session must complete wallet-paid Walrus storage before it becomes independently stored proof.",
    ].join("\n"),
  },
  {
    id: "sample-hackathon-risk-review",
    title: "Hackathon Deployment Risk Review",
    prompt:
      "Review the risks of deploying Agent BlackBox publicly for a hackathon demo, including API abuse, storage failures, proof-state mistakes, and user trust.",
    agentMode: "risk_review",
    storageEpochs: 1,
    createdAt: "2026-06-03T10:16:00.000Z",
    ownerAddress: SAMPLE_OWNER,
    summary:
      "Sample risk matrix covering public API safety, proof integrity, Walrus upload failures, and user trust.",
    findings: [
      "Public endpoints need guardrails and safe errors so paid services are not abused.",
      "Walrus upload failures must never be shown as stored proof.",
      "Sui anchoring must only appear verified after proof fields match the expected session evidence.",
    ],
    finalOutput: [
      "Sample Trace: Hackathon Deployment Risk Review",
      "",
      "This sample risk review shows how Agent BlackBox separates technical risk from proof integrity risk.",
      "",
      "Risk matrix:",
      "- Public API abuse: High impact, medium likelihood. Mitigation: demo guard, rate limits, bounded request bodies.",
      "- Walrus upload failure: Medium impact, medium likelihood. Mitigation: clear Step 06 diagnostics and retry from sealed trace.",
      "- False proof success: Critical impact, low likelihood after validation. Mitigation: verify session ID, hashes, owner, blob ID, transaction, and event fields.",
      "- User trust confusion: High impact, medium likelihood. Mitigation: keep sample traces, local simulations, and real proof status visually separate.",
      "",
      "Sample boundary:",
      "This is a demonstration risk report, not a live audit of the current deployment.",
    ].join("\n"),
  },
  {
    id: "sample-delivery-proof",
    title: "Hackathon Build Delivery Proof",
    prompt:
      "Create a sealed delivery receipt for an Agent BlackBox hackathon prototype with agent execution, Walrus trace storage, Sui proof anchoring, Tatum Sui RPC readiness, verification pages, and exports.",
    agentMode: "delivery_proof",
    storageEpochs: 1,
    createdAt: "2026-06-03T10:24:00.000Z",
    ownerAddress: SAMPLE_OWNER,
    files: [{ name: "sample-delivery-manifest.json", type: "application/json", size: 12640 }],
    summary:
      "Sample delivery receipt showing completed artifacts, acceptance checks, and sealed proof trail structure.",
    findings: [
      "The delivered artifact is a Sui-native proof console for AI agent traces.",
      "Acceptance checks include execution timeline, sealed hashes, Walrus storage, readback, Sui anchor, and export.",
      "A real delivery proof should be generated from the final deployed build and user wallet.",
    ],
    finalOutput: [
      "Sample Trace: Hackathon Build Delivery Proof",
      "",
      "This sample receipt records what a completed Agent BlackBox handoff looks like.",
      "",
      "Delivered items:",
      "- Agent execution timeline",
      "- Sealed input, result, and trace hashes",
      "- Walrus trace storage and readback verification path",
      "- Sui proof anchoring flow",
      "- Tatum Sui RPC readiness checks",
      "- Session verification page",
      "- JSON and Markdown exports",
      "",
      "Acceptance checklist:",
      "- Final report is visible near the top of the session page",
      "- Proof metadata is secondary and traceable",
      "- Tamper simulation is clearly local-only",
      "- Sample traces do not pretend to be wallet-signed proof",
      "",
      "Sample boundary:",
      "This is demonstration data. Run a real Delivery Proof Agent session to create an actual sealed receipt.",
    ].join("\n"),
  },
];

function sampleToolCalls(mode: AgentMode) {
  const specialistTool =
    mode === "onchain_monitor" ? "analyzeSuiTarget" : "analyzeSpecialistAgentContext";
  return [
    {
      toolName: "recordInputEvidence",
      purpose: "Captured the sample task and evidence boundary.",
      inputSummary: "Curated public sample trace.",
      outputSummary: "Sample input evidence recorded without using private user data.",
      status: "completed" as const,
    },
    {
      toolName: specialistTool,
      purpose: "Prepared the sample agent-specific report.",
      inputSummary: "Sui-native Agent BlackBox demo scope.",
      outputSummary: "Professional sample report prepared for public dashboard review.",
      status: "completed" as const,
    },
    {
      toolName: "prepareWalrusTrace",
      purpose: "Prepared proof metadata for demonstration.",
      inputSummary: "Sample trace bundle.",
      outputSummary: "Sample trace hashes are deterministic; no live Walrus storage is claimed.",
      status: "completed" as const,
    },
    {
      toolName: "finalizeAgentReport",
      purpose: "Generated final sample output.",
      inputSummary: "Public demo trace.",
      outputSummary: "Sample report finalized with clear demonstration-only boundary.",
      status: "completed" as const,
    },
  ];
}

function buildSampleOutput(input: (typeof sampleInputs)[number]): AgentRuntimeOutput {
  return {
    agentMode: input.agentMode,
    agentDisplayName:
      input.agentMode === "onchain_monitor"
        ? "Sui Onchain Analyzer"
        : input.agentMode === "risk_review"
          ? "Risk Review Agent"
          : input.agentMode === "delivery_proof"
            ? "Delivery Proof Agent"
            : "Research Agent",
    taskTitle: input.title,
    executiveSummary: input.summary,
    plan: [
      "Capture the sample task boundary",
      "Prepare agent-specific sample findings",
      "Seal deterministic trace hashes",
      "Present proof flow without claiming live wallet-signed proof",
    ].map((title, index) => ({
      step: index + 1,
      title,
      status: "completed" as const,
      reasoningSummary: "Sample trace step recorded for public demonstration.",
    })),
    toolCalls: sampleToolCalls(input.agentMode),
    findings: input.findings.map((detail, index) => ({
      title:
        index === 0
          ? "Sample scope"
          : index === 1
            ? "Proof flow"
            : "Verification boundary",
      detail,
      severity: index === 2 ? "low" : "info",
      evidence: "Curated sample trace",
    })),
    finalOutput: input.finalOutput,
    confidence: "medium",
    limitations: [
      "This is sample data for a public dashboard fallback.",
      "No wallet signed this sample trace.",
      "No live Walrus Mainnet blob or Sui proof anchor is claimed.",
    ],
    recommendedNextActions: [
      "Run a real agent session to create your own trace.",
      "Store the trace on Walrus Mainnet.",
      "Anchor the stored blob and trace hashes on Sui Mainnet.",
    ],
  };
}

function buildSampleSession(input: (typeof sampleInputs)[number]): AgentSession {
  const session = createLocalAgentSession(input, buildSampleOutput(input));
  const checkedAt = session.updatedAt;
  const sampleSession: AgentSession = {
    ...session,
    isSample: true,
    sampleLabel: "Sample Trace",
    status: "pending",
    storage: {
      ...session.storage,
      storageStatus: "local_only",
      warning:
        "Sample trace for public demonstration only. Run a real agent session to store evidence on Walrus Mainnet.",
    },
    walrusVerification: {
      ...session.walrusVerification,
      readStatus: "unknown",
      availabilityStatus: "unknown",
      hashMatched: true,
      checkedAt,
      error: "Sample trace only; no live Walrus readback is claimed.",
    },
    proof: {
      ...session.proof,
      proofMode: "local",
      status: "prepared",
      transactionDigest: "transaction-pending",
      suiObjectId: "proof-object-pending",
      owner: null,
    },
    verification: {
      ...session.verification,
      walrusBlobAvailable: false,
      directWalrusReadPassed: false,
      suiProofFound: false,
      tatumRpcPassed: false,
      hashMatched: true,
      tamperDetected: false,
      checkedAt,
    },
  };
  hydrateLocalStoredTrace(sampleSession.storage, createTraceBundleFromSession(sampleSession));
  return sampleSession;
}

export function getDemoSessions() {
  return sampleInputs
    .map(buildSampleSession)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getDemoSessionById(id: string) {
  return getDemoSessions().find((session) => session.id === id);
}
