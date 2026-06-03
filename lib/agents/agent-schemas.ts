import type {
  AgentConfidence,
  AgentFindingSeverity,
  AgentRuntimeOutput,
  AgentRuntimeToolStatus,
} from "@/lib/agents/types";
import type { AgentMode } from "@/types/blackbox";

const agentModes: AgentMode[] = ["research", "risk_review", "delivery_proof", "onchain_monitor"];
const severities: AgentFindingSeverity[] = ["info", "low", "medium", "high", "critical"];
const confidenceValues: AgentConfidence[] = ["low", "medium", "high"];
const toolStatuses: AgentRuntimeToolStatus[] = ["completed", "failed", "skipped"];

export const AGENT_RUNTIME_JSON_SCHEMA = {
  name: "agent_blackbox_runtime_output",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "agentMode",
      "agentDisplayName",
      "taskTitle",
      "executiveSummary",
      "plan",
      "toolCalls",
      "findings",
      "finalOutput",
      "confidence",
      "limitations",
      "recommendedNextActions",
    ],
    properties: {
      agentMode: { type: "string", enum: agentModes },
      agentDisplayName: { type: "string", minLength: 1 },
      taskTitle: { type: "string", minLength: 1 },
      executiveSummary: { type: "string", minLength: 1 },
      plan: {
        type: "array",
        minItems: 3,
        maxItems: 7,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["step", "title", "status", "reasoningSummary"],
          properties: {
            step: { type: "integer", minimum: 1, maximum: 12 },
            title: { type: "string", minLength: 1 },
            status: { type: "string", enum: ["completed"] },
            reasoningSummary: { type: "string", minLength: 1 },
          },
        },
      },
      toolCalls: {
        type: "array",
        minItems: 1,
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["toolName", "purpose", "inputSummary", "outputSummary", "status"],
          properties: {
            toolName: { type: "string", minLength: 1 },
            purpose: { type: "string", minLength: 1 },
            inputSummary: { type: "string", minLength: 1 },
            outputSummary: { type: "string", minLength: 1 },
            status: { type: "string", enum: toolStatuses },
          },
        },
      },
      findings: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "detail", "severity", "evidence"],
          properties: {
            title: { type: "string", minLength: 1 },
            detail: { type: "string", minLength: 1 },
            severity: { type: "string", enum: severities },
            evidence: { type: "string", minLength: 1 },
          },
        },
      },
      finalOutput: { type: "string", minLength: 1 },
      confidence: { type: "string", enum: confidenceValues },
      limitations: {
        type: "array",
        items: { type: "string", minLength: 1 },
      },
      recommendedNextActions: {
        type: "array",
        items: { type: "string", minLength: 1 },
      },
    },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function normalizeAgentRuntimeOutput(value: unknown): AgentRuntimeOutput | null {
  if (!isRecord(value)) return null;
  if (!agentModes.includes(value.agentMode as AgentMode)) return null;
  if (
    typeof value.agentDisplayName !== "string" ||
    typeof value.taskTitle !== "string" ||
    typeof value.executiveSummary !== "string" ||
    typeof value.finalOutput !== "string" ||
    !confidenceValues.includes(value.confidence as AgentConfidence)
  ) {
    return null;
  }

  const plan = Array.isArray(value.plan)
    ? value.plan.flatMap((item) => {
        if (!isRecord(item)) return [];
        if (
          typeof item.step !== "number" ||
          typeof item.title !== "string" ||
          item.status !== "completed" ||
          typeof item.reasoningSummary !== "string"
        ) {
          return [];
        }
        return [{
          step: item.step,
          title: item.title,
          status: "completed" as const,
          reasoningSummary: item.reasoningSummary,
        }];
      })
    : [];
  const toolCalls = Array.isArray(value.toolCalls)
    ? value.toolCalls.flatMap((item) => {
        if (!isRecord(item)) return [];
        if (
          typeof item.toolName !== "string" ||
          typeof item.purpose !== "string" ||
          typeof item.inputSummary !== "string" ||
          typeof item.outputSummary !== "string" ||
          !toolStatuses.includes(item.status as AgentRuntimeToolStatus)
        ) {
          return [];
        }
        return [{
          toolName: item.toolName,
          purpose: item.purpose,
          inputSummary: item.inputSummary,
          outputSummary: item.outputSummary,
          status: item.status as AgentRuntimeToolStatus,
        }];
      })
    : [];
  const findings = Array.isArray(value.findings)
    ? value.findings.flatMap((item) => {
        if (!isRecord(item)) return [];
        if (
          typeof item.title !== "string" ||
          typeof item.detail !== "string" ||
          typeof item.evidence !== "string" ||
          !severities.includes(item.severity as AgentFindingSeverity)
        ) {
          return [];
        }
        return [{
          title: item.title,
          detail: item.detail,
          severity: item.severity as AgentFindingSeverity,
          evidence: item.evidence,
        }];
      })
    : [];

  if (plan.length === 0 || toolCalls.length === 0 || findings.length === 0) return null;

  return {
    agentMode: value.agentMode as AgentMode,
    agentDisplayName: value.agentDisplayName,
    taskTitle: value.taskTitle,
    executiveSummary: value.executiveSummary,
    plan,
    toolCalls,
    findings,
    finalOutput: value.finalOutput,
    confidence: value.confidence as AgentConfidence,
    limitations: asStringArray(value.limitations),
    recommendedNextActions: asStringArray(value.recommendedNextActions),
  };
}
