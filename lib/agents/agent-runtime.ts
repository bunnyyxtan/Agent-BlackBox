import "server-only";

import OpenAI from "openai";

import { AGENT_MODE_DEFINITIONS, buildAgentSystemPrompt, buildAgentUserPrompt } from "@/lib/agents/agent-prompts";
import { AGENT_RUNTIME_JSON_SCHEMA, normalizeAgentRuntimeOutput } from "@/lib/agents/agent-schemas";
import { isSpecialistAgentReport } from "@/lib/agents/specialist-report";
import {
  collectPreModelToolObservations,
  finalizeAgentReport,
  hashTracePreview,
  serializeToolObservations,
} from "@/lib/agents/agent-tools";
import type { AgentRuntimeInput, AgentRuntimeOutput, AgentRuntimeToolCall } from "@/lib/agents/types";
import type { MultichainOnchainReport } from "@/lib/onchain/types";

export class AgentRuntimeSetupError extends Error {
  statusCode = 503;
  code = "agent_runtime_not_configured";
}

export class AgentRuntimeExecutionError extends Error {
  statusCode = 502;

  constructor(
    message: string,
    public code = "agent_runtime_execution_error",
  ) {
    super(message);
  }
}

const DEFAULT_RUNTIME_MODEL = "gpt-4.1-mini";
const BRANDING_PATTERN =
  /\b(OpenAI|ChatGPT|GPT(?:[-\s]?\d+(?:\.\d+)?(?:[-\s]?(?:turbo|mini|nano|preview))?)?|gpt[-\w.]+|o\d(?:[-\w.]+)?)\b/gi;

function getRuntimeClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AgentRuntimeSetupError("Agent Runtime is not configured on the server.");
  }
  return new OpenAI({ apiKey });
}

function sanitizeText(value: string) {
  return value.replace(BRANDING_PATTERN, "Agent Runtime");
}

function sanitizeRuntimeOutput(output: AgentRuntimeOutput): AgentRuntimeOutput {
  return {
    ...output,
    agentDisplayName: sanitizeText(output.agentDisplayName),
    taskTitle: sanitizeText(output.taskTitle),
    executiveSummary: sanitizeText(output.executiveSummary),
    plan: output.plan.map((step) => ({
      ...step,
      title: sanitizeText(step.title),
      reasoningSummary: sanitizeText(step.reasoningSummary),
    })),
    toolCalls: output.toolCalls.map((tool) => ({
      ...tool,
      toolName: sanitizeText(tool.toolName),
      purpose: sanitizeText(tool.purpose),
      inputSummary: sanitizeText(tool.inputSummary),
      outputSummary: sanitizeText(tool.outputSummary),
    })),
    findings: output.findings.map((finding) => ({
      ...finding,
      title: sanitizeText(finding.title),
      detail: sanitizeText(finding.detail),
      evidence: sanitizeText(finding.evidence),
    })),
    finalOutput: sanitizeText(output.finalOutput),
    limitations: output.limitations.map(sanitizeText),
    recommendedNextActions: output.recommendedNextActions.map(sanitizeText),
  };
}

function toRuntimeToolCall(tool: AgentRuntimeToolCall): AgentRuntimeToolCall {
  return {
    toolName: sanitizeText(tool.toolName),
    purpose: sanitizeText(tool.purpose),
    inputSummary: sanitizeText(tool.inputSummary),
    outputSummary: sanitizeText(tool.outputSummary),
    status: tool.status,
  };
}

function tryParseRuntimeJson(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

function isOnchainReport(value: unknown): value is MultichainOnchainReport {
  return (
    typeof value === "object" &&
    value !== null &&
    "header" in value &&
    "detected" in value &&
    "dataSources" in value
  );
}

export async function runAgentRuntime(input: AgentRuntimeInput): Promise<AgentRuntimeOutput> {
  const client = getRuntimeClient();
  const definition = AGENT_MODE_DEFINITIONS[input.agentMode];
  const preModelTools = await collectPreModelToolObservations(input);
  const onchainAnalysis = preModelTools
    .map((tool) => tool.raw)
    .find(isOnchainReport);
  const specialistAnalysis = preModelTools
    .map((tool) => tool.raw)
    .find(isSpecialistAgentReport);
  const fileEvidence =
    input.inputFiles.length > 0
      ? input.inputFiles.map((file) => `${file.name} (${file.type || "unknown"}, ${file.size} bytes)`).join("; ")
      : "No file metadata supplied.";

  async function requestStructuredReport(repairInstruction?: string) {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL?.trim() || DEFAULT_RUNTIME_MODEL,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: AGENT_RUNTIME_JSON_SCHEMA,
      },
      messages: [
        {
          role: "system",
          content: buildAgentSystemPrompt(input.agentMode),
        },
        {
          role: "user",
          content: buildAgentUserPrompt({
            taskTitle: input.taskTitle,
            taskPrompt: input.taskPrompt,
            fileEvidence,
            toolObservations: serializeToolObservations(preModelTools),
          }),
        },
        ...(repairInstruction
          ? [
              {
                role: "user" as const,
                content: repairInstruction,
              },
            ]
          : []),
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new AgentRuntimeExecutionError("Agent Runtime returned an empty structured report.");
    }
    return content;
  }

  let normalized: AgentRuntimeOutput | null = null;
  try {
    const content = await requestStructuredReport();
    normalized = normalizeAgentRuntimeOutput(tryParseRuntimeJson(content));
    if (!normalized) {
      const repairedContent = await requestStructuredReport(
        [
          "The previous Agent Runtime report did not match the required JSON schema.",
          "Repair it now by returning strict JSON only with every required field populated.",
          "Do not add markdown. Do not add extra properties. Do not reveal hidden reasoning.",
        ].join(" "),
      );
      normalized = normalizeAgentRuntimeOutput(tryParseRuntimeJson(repairedContent));
    }
  } catch (error) {
    if (error instanceof AgentRuntimeExecutionError) throw error;
    throw new AgentRuntimeExecutionError(
      error instanceof AgentRuntimeSetupError
        ? error.message
        : "Agent Runtime request failed. Check the server-side runtime configuration.",
    );
  }

  if (!normalized) {
    throw new AgentRuntimeExecutionError(
      "agent_runtime_schema_error: Agent Runtime returned a report that did not match the required structured schema.",
      "agent_runtime_schema_error",
    );
  }

  const seededOutput: AgentRuntimeOutput = sanitizeRuntimeOutput({
    ...normalized,
    agentMode: input.agentMode,
    agentDisplayName: definition.displayName,
    taskTitle: input.taskTitle,
  });
  const postModelTools = [
    hashTracePreview(input, seededOutput),
    finalizeAgentReport(seededOutput),
  ];
  const toolCalls = [...preModelTools, ...postModelTools].map((tool) =>
    toRuntimeToolCall({
      toolName: tool.toolName,
      purpose: tool.purpose,
      inputSummary: tool.inputSummary,
      outputSummary: tool.outputSummary,
      status: tool.status,
    }),
  );

  return {
    ...seededOutput,
    toolCalls,
    ...(specialistAnalysis ? { specialistAnalysis } : {}),
    ...(onchainAnalysis ? { onchainAnalysis } : {}),
  };
}
