import "server-only";

import {
  isValidSuiAddress,
  isValidSuiObjectId,
  isValidTransactionDigest,
  normalizeSuiAddress,
  normalizeSuiObjectId,
} from "@/lib/sui-client-helpers";

import { AGENT_MODE_DEFINITIONS } from "@/lib/agents/agent-prompts";
import {
  buildSpecialistAgentReport,
} from "@/lib/agents/specialist-report";
import type {
  AgentRuntimeInput,
  AgentRuntimeOutput,
  AgentToolObservation,
} from "@/lib/agents/types";
import { createHashFromString, createResultHash, stableStringify } from "@/lib/hash";
import { analyzeOnchainInput } from "@/lib/onchain/analyzer-router";
import type { SuiOnchainReport } from "@/lib/onchain/types";
import { getSuiObject, getTransactionBlock } from "@/lib/tatum-rpc";

function summarizeFiles(input: AgentRuntimeInput) {
  if (input.inputFiles.length === 0) return "No file metadata supplied.";
  return input.inputFiles
    .map((file) => `${file.name} (${file.type || "unknown type"}, ${file.size} bytes)`)
    .join("; ");
}

function createObservation(
  toolName: string,
  purpose: string,
  inputSummary: string,
  outputSummary: string,
  status: AgentToolObservation["status"] = "completed",
  raw?: unknown,
): AgentToolObservation {
  return { toolName, purpose, inputSummary, outputSummary, status, raw };
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

export function recordInputEvidence(input: AgentRuntimeInput) {
  return createObservation(
    "recordInputEvidence",
    "Summarizes user prompt and file metadata.",
    `${input.taskTitle}: ${input.taskPrompt.slice(0, 220)}`,
    `Captured task intent, owner wallet, ${input.network}, and file metadata: ${summarizeFiles(input)}`,
  );
}

export function generatePlan(input: AgentRuntimeInput) {
  const definition = AGENT_MODE_DEFINITIONS[input.agentMode];
  return createObservation(
    "generatePlan",
    "Creates agent execution plan.",
    `${definition.displayName} for ${input.taskTitle}`,
    definition.planFocus.join(" "),
  );
}

function getTokenContext(text: string, token: string) {
  const index = text.indexOf(token);
  if (index === -1) return text;
  const start = Math.max(0, index - 56);
  const end = Math.min(text.length, index + token.length + 56);
  return text.slice(start, end);
}

function extractPotentialTargets(text: string) {
  const tokens = text.match(/[1-9A-HJ-NP-Za-km-z]{32,88}|0x[a-fA-F0-9]{1,64}/g) ?? [];
  const transactionDigests = uniqueValues(tokens.filter((token) => isValidTransactionDigest(token)));
  const addresses: string[] = [];
  const objectIds: string[] = [];
  const packageIds: string[] = [];
  const addressFormatIds: string[] = [];
  const networkHint = /\btestnet\b/i.test(text) ? "testnet" : /\bmainnet\b/i.test(text) ? "mainnet" : null;

  tokens
    .filter((token) => token.startsWith("0x"))
    .forEach((token) => {
      const context = getTokenContext(text, token);
      const normalizedAddress = isValidSuiAddress(token) ? normalizeSuiAddress(token) : null;
      const normalizedObjectId = isValidSuiObjectId(token) ? normalizeSuiObjectId(token) : null;
      const hasWalletContext = /\b(wallet|account|owner|address|sender|recipient|holder)\b/i.test(context);
      const hasPackageContext = /\b(package|contract|module)\b/i.test(context);
      const hasObjectContext = /\b(object|coin|nft|cap|registry|proof)\b/i.test(context);

      if (normalizedAddress) {
        addressFormatIds.push(normalizedAddress);
      }
      if (normalizedAddress && hasWalletContext) {
        addresses.push(normalizedAddress);
      }
      if (normalizedObjectId && hasPackageContext) {
        packageIds.push(normalizedObjectId);
      }
      if (normalizedObjectId && (hasObjectContext || (!hasWalletContext && !hasPackageContext))) {
        objectIds.push(normalizedObjectId);
      }
    });

  return {
    transactionDigest: transactionDigests[0],
    transactionDigests,
    address: uniqueValues(addresses)[0],
    addresses: uniqueValues(addresses),
    objectId: uniqueValues(objectIds)[0],
    objectIds: uniqueValues(objectIds),
    packageId: uniqueValues(packageIds)[0],
    packageIds: uniqueValues(packageIds),
    addressFormatIds: uniqueValues(addressFormatIds),
    networkHint,
  };
}

function summarizeOnchainReport(report: SuiOnchainReport) {
  const providerSummary = report.dataSources
    .map((source) => `${source.name}: ${source.status}`)
    .join("; ");
  const providerDisplay = report.header.dataSourcesUsed.join(", ") || "Sui RPC not used";
  const tokenSummary = report.tokenBalances?.length
    ? `Token balances: ${report.tokenBalances.map((item) => `${item.formattedBalance} ${item.symbol}`).join(", ")}.`
    : report.balanceLookupMessage ?? "No token balance summary returned.";
  return [
    `Detected ${report.header.detectedChain}, ${report.header.targetType}, ${report.header.target ?? "no target"}.`,
    `Enrichment status: ${report.header.enrichmentStatus}.`,
    `Provider: ${providerDisplay}.`,
    `Data sources: ${providerSummary || "none"}.`,
    `Holdings: ${tokenSummary}`,
  ].join(" ");
}

function summarizeSpecialistReport(report: NonNullable<ReturnType<typeof buildSpecialistAgentReport>>) {
  const metricSummary = report.metrics
    .map((metric) => `${metric.label}: ${metric.value}`)
    .join("; ");
  const evidenceSummary = report.evidenceItems
    .slice(0, 4)
    .map((item) => `${item.label} (${item.status})`)
    .join("; ");
  return [
    `${report.agent} prepared ${report.kind.replace(/_/g, " ")} for ${report.subject}.`,
    `Confidence: ${report.confidence}.`,
    `Scorecard: ${metricSummary || "not recorded"}.`,
    `Evidence: ${evidenceSummary || "sealed task prompt"}.`,
    `Sections: ${report.sections.map((section) => section.title).join(", ")}.`,
  ].join(" ");
}

export function analyzeSpecialistAgentContext(input: AgentRuntimeInput) {
  const report = buildSpecialistAgentReport({
    sessionId: input.sessionId,
    agentMode: input.agentMode,
    taskTitle: input.taskTitle,
    taskPrompt: input.taskPrompt,
    inputFiles: input.inputFiles,
    ownerAddress: input.ownerAddress,
    createdAt: input.createdAt,
  });

  if (!report) {
    return createObservation(
      "analyzeSpecialistAgentContext",
      "Builds a structured specialist report scaffold for research, risk, and delivery agents.",
      "Onchain agent mode.",
      "Skipped because the Sui Onchain Analyzer uses the onchain target analyzer.",
      "skipped",
    );
  }

  return createObservation(
    "analyzeSpecialistAgentContext",
    "Parses task intent, evidence, entities, missing data, confidence, and report sections for the selected specialist agent.",
    `${input.taskTitle}: ${input.taskPrompt.slice(0, 180)}`,
    summarizeSpecialistReport(report),
    "completed",
    report,
  );
}

export async function analyzeOnchainTarget(input: AgentRuntimeInput) {
  if (input.agentMode !== "onchain_monitor") {
    return createObservation(
      "analyzeOnchainTarget",
      "Detects Sui wallet, object, package, and transaction targets from the task title and prompt.",
      "Non-onchain agent mode.",
      "Skipped because onchain target detection was not required for this agent mode.",
      "skipped",
    );
  }

  const report = await analyzeOnchainInput({
    title: input.taskTitle,
    prompt: input.taskPrompt,
    agentMode: "onchain-analyzer",
    network: input.network,
    sessionId: input.sessionId,
    evidence: {
      inputFiles: input.inputFiles,
      ownerAddress: input.ownerAddress,
    },
  });

  return createObservation(
    "analyzeOnchainTarget",
    "Detects Sui targets, reads available Sui RPC data, and prepares a Sui-native report.",
    `${input.taskTitle}: ${input.taskPrompt.slice(0, 180)}`,
    summarizeOnchainReport(report),
    "completed",
    report,
  );
}

export async function tatumSuiRpcCheck(input: AgentRuntimeInput) {
  if (input.agentMode !== "onchain_monitor") {
    return createObservation(
      "tatumSuiRpcCheck",
      "Uses allowed Sui RPC checks when relevant.",
      "Non-onchain agent mode.",
      "Skipped because blockchain evidence was not required for this agent mode.",
      "skipped",
    );
  }

  const targets = extractPotentialTargets(`${input.taskTitle}\n${input.taskPrompt}`);
  if (targets.transactionDigest) {
    const result = await getTransactionBlock(targets.transactionDigest);
    return createObservation(
      "tatumSuiRpcCheck",
      "Uses existing server-side Sui RPC verification for supplied transaction context.",
      `Transaction digest ${targets.transactionDigest}`,
      result.status === "success" && result.result
        ? "Transaction block was found through the configured Sui RPC gateway."
        : `Transaction block was not confirmed: ${result.message}`,
      result.status === "success" && result.result ? "completed" : "failed",
      result,
    );
  }

  const objectOrPackageId = targets.objectId ?? targets.packageId;

  if (targets.address && !objectOrPackageId) {
    return createObservation(
      "tatumSuiRpcCheck",
      "Uses existing server-side Sui RPC verification when direct object, package, or transaction context is supplied.",
      `Wallet address ${targets.address}`,
      "Wallet address detected from the task input. No direct wallet activity read was performed because the current proof-safe RPC allowlist requires a transaction digest, object ID, or package ID.",
      "skipped",
      targets,
    );
  }

  if (objectOrPackageId) {
    const result = await getSuiObject(objectOrPackageId);
    return createObservation(
      "tatumSuiRpcCheck",
      "Uses existing server-side Sui RPC verification for supplied object or package context.",
      `Object/package ID ${objectOrPackageId}`,
      result.status === "success" && result.result
        ? "Object or package data was found through the configured Sui RPC gateway."
        : `Object or package data was not confirmed: ${result.message}`,
      result.status === "success" && result.result ? "completed" : "failed",
      result,
    );
  }

  return createObservation(
    "tatumSuiRpcCheck",
    "Uses existing server-side Sui RPC verification when a usable onchain target is supplied.",
    "No transaction digest, object ID, or package ID detected.",
    "No Sui RPC read was performed. A transaction digest, object ID, or package ID is required for direct chain lookup.",
    "skipped",
    targets,
  );
}

export function prepareWalrusTrace(input: AgentRuntimeInput) {
  return createObservation(
    "prepareWalrusTrace",
    "Prepares deterministic trace bundle for Walrus upload.",
    `${input.storageEpochs} epoch(s), ${input.storageMode} storage.`,
    "Prepared the trace envelope fields for Walrus Mainnet upload after report generation.",
  );
}

export function hashTracePreview(input: AgentRuntimeInput, output: AgentRuntimeOutput) {
  const inputHash = createHashFromString(
    stableStringify({
      prompt: input.taskPrompt,
      files: input.inputFiles,
      agentMode: input.agentMode,
      ownerAddress: input.ownerAddress,
    }),
  );
  const resultHash = createResultHash(output.finalOutput);
  return createObservation(
    "hashTracePreview",
    "Computes input/result/trace hash preview.",
    "Trace-ready runtime output.",
    `Prepared input hash ${inputHash.slice(0, 12)}... and result hash ${resultHash.slice(0, 12)}... for deterministic sealing.`,
    "completed",
    { inputHash, resultHash },
  );
}

export function finalizeAgentReport(output: AgentRuntimeOutput) {
  return createObservation(
    "finalizeAgentReport",
    "Creates final report.",
    `${output.agentDisplayName} structured report.`,
    `Final report completed with ${output.findings.length} finding(s), ${output.limitations.length} limitation(s), and ${output.confidence} confidence.`,
  );
}

export async function collectPreModelToolObservations(input: AgentRuntimeInput) {
  const observations = [
    recordInputEvidence(input),
    generatePlan(input),
  ];
  if (input.agentMode === "onchain_monitor") {
    const targetObservation = await analyzeOnchainTarget(input);
    observations.push(targetObservation);
    observations.push(prepareWalrusTrace(input));
    return observations;
  }
  observations.push(analyzeSpecialistAgentContext(input));
  const rpcObservation = await tatumSuiRpcCheck(input);
  if (rpcObservation.status !== "skipped") {
    observations.push(rpcObservation);
  }
  observations.push(prepareWalrusTrace(input));
  return observations;
}

export function serializeToolObservations(observations: AgentToolObservation[]) {
  return observations
    .map(
      (observation, index) =>
        `${index + 1}. ${observation.toolName} [${observation.status}]\nPurpose: ${observation.purpose}\nInput: ${observation.inputSummary}\nOutput: ${observation.outputSummary}`,
    )
    .join("\n\n");
}
