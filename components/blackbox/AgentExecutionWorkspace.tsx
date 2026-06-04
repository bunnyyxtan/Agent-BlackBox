"use client";

import { UserFacingErrorAlert } from "@/components/ui/UserFacingErrorAlert";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
  taskTitle: string;
}

const stepCopy: Record<ExecutionStatus, { label: string; icon: string; className: string }> = {
  pending: {
    label: "Queued",
    icon: "solar:clock-circle-line-duotone",
    className: "border-white/[0.08] bg-white/[0.025] text-zinc-500",
  },
  running: {
    label: "Running",
    icon: "solar:pulse-2-bold-duotone",
    className: "border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-100",
  },
  rerunning: {
    label: "Retrying",
    icon: "solar:restart-circle-line-duotone",
    className: "border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-100",
  },
  done: {
    label: "Done",
    icon: "solar:check-circle-bold-duotone",
    className: "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100",
  },
  error: {
    label: "Needs attention",
    icon: "solar:danger-triangle-bold-duotone",
    className: "border-amber-200/25 bg-amber-300/[0.07] text-amber-100",
  },
};

function getWorkspaceTitle(steps: AgentExecutionStep[], error: UserFacingError | null) {
  if (error) return "Proof run needs attention";
  if (steps.every((step) => step.status === "done")) return "Proof trace complete";
  if (steps.some((step) => step.status === "running" || step.status === "rerunning")) return "Creating proof trail";
  return "Ready to run";
}

function getWorkspaceSummary(steps: AgentExecutionStep[], error: UserFacingError | null) {
  if (error) return "The run paused at the highlighted step. Previously completed proof work stays intact.";
  const active = steps.find((step) => step.status === "running" || step.status === "rerunning");
  if (active) return active.detail;
  if (steps.every((step) => step.status === "done")) {
    return "The report is sealed, stored on Walrus, and ready for Sui anchoring.";
  }
  return "Agent BlackBox will write the report, seal the proof trace, store it on Walrus, and verify it.";
}

function StepIcon({ status }: { status: ExecutionStatus }) {
  const copy = stepCopy[status];
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${copy.className}`}
    >
      <iconify-icon
        icon={copy.icon}
        className={`text-base ${status === "running" || status === "rerunning" ? "animate-pulse" : ""}`}
      />
    </span>
  );
}

export function AgentExecutionWorkspace({
  agentMode,
  error,
  onRerunFromFailedStep,
  rerunning = false,
  running,
  steps,
  taskTitle,
}: AgentExecutionWorkspaceProps) {
  const doneCount = steps.filter((step) => step.status === "done").length;
  const failedStep = steps.find((step) => step.status === "error");

  return (
    <section className="rounded-[1.65rem] border border-white/[0.08] bg-[#08080d]/88 p-4 shadow-[0_28px_90px_-70px_rgba(99,102,241,0.85)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan">
            {AGENT_MODE_LABELS[agentMode]}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white [overflow-wrap:anywhere]">
            {getWorkspaceTitle(steps, error)}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 [overflow-wrap:anywhere]">
            {getWorkspaceSummary(steps, error)}
          </p>
          {taskTitle && (
            <p className="mt-2 font-mono text-[0.68rem] text-zinc-600 [overflow-wrap:anywhere]">
              {taskTitle}
            </p>
          )}
        </div>
        <StatusBadge
          status={error ? "Needs Attention" : running ? "Working" : doneCount === steps.length ? "Ready to Anchor" : "Ready"}
        />
      </div>

      <div className="mt-5 space-y-2">
        {steps.map((step, index) => {
          const copy = stepCopy[step.status];
          return (
            <div
              className={`relative flex gap-3 rounded-2xl border px-3 py-3 transition ${copy.className}`}
              key={step.id}
            >
              {index < steps.length - 1 && (
                <span className="absolute bottom-[-0.65rem] left-[1.78rem] h-[0.7rem] w-px bg-white/10" />
              )}
              <StepIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white [overflow-wrap:anywhere]">{step.label}</p>
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-current opacity-70">
                    {copy.label}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-400 [overflow-wrap:anywhere]">{step.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-amber-200/15 bg-amber-300/[0.045] p-4">
          <p className="text-sm font-semibold text-amber-50">
            {failedStep ? `${failedStep.label} can be retried.` : "This step can be retried."}
          </p>
          <p className="mt-2 text-xs leading-5 text-amber-50/70">
            Agent BlackBox keeps completed steps sealed and resumes from the interrupted proof step.
          </p>
          <div className="mt-3">
            <UserFacingErrorAlert error={error} tone="amber" />
          </div>
          {onRerunFromFailedStep && (
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/[0.08] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-amber-50 transition hover:border-amber-200/35 hover:bg-amber-200/[0.12] disabled:cursor-wait disabled:opacity-65 sm:w-auto"
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
    </section>
  );
}
