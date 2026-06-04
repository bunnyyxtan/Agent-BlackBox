"use client";

import { UserFacingErrorAlert } from "@/components/ui/UserFacingErrorAlert";
import { AGENT_MODE_LABELS } from "@/lib/constants";
import type { UserFacingError } from "@/lib/errors/user-facing-errors";
import type { AgentMode } from "@/types/blackbox";

type ExecutionStatus = "pending" | "running" | "rerunning" | "done" | "error";

interface AgentExecutionStep {
  id: string;
  label: string;
  detail: string;
  status: ExecutionStatus;
}

interface AgentExecutionWorkspaceProps {
  agentMode: AgentMode;
  error: UserFacingError | null;
  onRerunFromFailedStep?: () => void;
  rerunning?: boolean;
  running: boolean;
  steps: AgentExecutionStep[];
}

function getActionText(step: AgentExecutionStep, agentMode: AgentMode) {
  if (step.id === "tools") {
    return agentMode === "onchain_monitor" ? "Checked Sui data" : "Reviewed task evidence";
  }
  if (step.id === "uploading") return "Stored on Walrus";
  if (step.id === "reading_back") return "Verified readback";
  if (step.id === "saving") return "Prepared Sui anchor";
  return step.detail;
}

function StepMarker({ status }: { status: ExecutionStatus }) {
  if (status === "done") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-300/15 text-emerald-200">
        <iconify-icon icon="solar:check-circle-bold-duotone" className="text-sm" />
      </span>
    );
  }
  if (status === "running" || status === "rerunning") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-amber-200">
        <iconify-icon icon="solar:spinner-linear" className="animate-spin text-sm" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-300/15 text-amber-200">
        <iconify-icon icon="solar:danger-triangle-bold-duotone" className="text-sm" />
      </span>
    );
  }
  return null;
}

export function AgentExecutionWorkspace({
  agentMode,
  error,
  onRerunFromFailedStep,
  rerunning = false,
  running,
  steps,
}: AgentExecutionWorkspaceProps) {
  const visibleSteps = steps.filter((step) => step.status !== "pending");
  const failedStep = steps.find((step) => step.status === "error");
  const complete = steps.length > 0 && steps.every((step) => step.status === "done");

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-zinc-300">
        {complete
          ? "Proof is ready."
          : running
            ? `${AGENT_MODE_LABELS[agentMode]} is working...`
            : "Ready when you are."}
      </p>

      <div className="space-y-2">
        {visibleSteps.map((step) => (
          <div className="flex gap-2 text-sm leading-6" key={step.id}>
            <StepMarker status={step.status} />
            <div className="min-w-0">
              <p
                className={
                  step.status === "error"
                    ? "text-amber-100"
                    : step.status === "running" || step.status === "rerunning"
                      ? "text-zinc-100"
                      : "text-zinc-300"
                }
              >
                {step.label}
                {step.status === "running" || step.status === "rerunning" ? "..." : ""}
              </p>
              {(step.status === "done" || step.status === "error") && (
                <p className="mt-0.5 text-xs text-zinc-600">
                  {getActionText(step, agentMode)} <span aria-hidden="true">›</span>
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 max-w-2xl rounded-2xl border border-amber-200/15 bg-amber-300/[0.035] p-4">
          <p className="text-sm font-semibold text-amber-50">
            {failedStep ? `${failedStep.label} can be retried.` : "This step can be retried."}
          </p>
          <p className="mt-2 text-xs leading-5 text-amber-50/70">
            Completed proof work stays intact.
          </p>
          <div className="mt-3">
            <UserFacingErrorAlert error={error} tone="amber" />
          </div>
          {onRerunFromFailedStep && (
            <button
              className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/[0.08] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-amber-50 transition hover:border-amber-200/35 hover:bg-amber-200/[0.12] disabled:cursor-wait disabled:opacity-65"
              disabled={rerunning}
              onClick={onRerunFromFailedStep}
              type="button"
            >
              <iconify-icon
                icon={rerunning ? "solar:spinner-linear" : "solar:restart-circle-line-duotone"}
                className={`text-base ${rerunning ? "animate-spin" : ""}`}
              />
              {rerunning ? "Retrying..." : "Retry this step"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
