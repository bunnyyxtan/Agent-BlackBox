import type { AgentMode, InputFile, StorageMode } from "@/types/blackbox";
import type { SpecialistAgentReport } from "@/lib/agents/specialist-report";
import type { MultichainOnchainReport } from "@/lib/onchain/types";

export type AgentFindingSeverity = "info" | "low" | "medium" | "high" | "critical";
export type AgentConfidence = "low" | "medium" | "high";
export type AgentRuntimeStepStatus = "completed";
export type AgentRuntimeToolStatus = "completed" | "failed" | "skipped";

export interface AgentRuntimeInput {
  sessionId: string;
  agentMode: AgentMode;
  taskTitle: string;
  taskPrompt: string;
  inputFiles: Array<Pick<InputFile, "name" | "type" | "size">>;
  ownerAddress: string;
  network: string;
  storageMode: StorageMode;
  storageEpochs: number;
  createdAt: string;
}

export interface AgentRuntimePlanStep {
  step: number;
  title: string;
  status: AgentRuntimeStepStatus;
  reasoningSummary: string;
}

export interface AgentRuntimeToolCall {
  toolName: string;
  purpose: string;
  inputSummary: string;
  outputSummary: string;
  status: AgentRuntimeToolStatus;
}

export interface AgentRuntimeFinding {
  title: string;
  detail: string;
  severity: AgentFindingSeverity;
  evidence: string;
}

export interface AgentRuntimeOutput {
  agentMode: AgentMode;
  agentDisplayName: string;
  taskTitle: string;
  executiveSummary: string;
  plan: AgentRuntimePlanStep[];
  toolCalls: AgentRuntimeToolCall[];
  findings: AgentRuntimeFinding[];
  finalOutput: string;
  confidence: AgentConfidence;
  limitations: string[];
  recommendedNextActions: string[];
  specialistAnalysis?: SpecialistAgentReport;
  onchainAnalysis?: MultichainOnchainReport;
}

export interface AgentToolObservation {
  toolName: string;
  purpose: string;
  inputSummary: string;
  outputSummary: string;
  status: AgentRuntimeToolStatus;
  raw?: unknown;
}
