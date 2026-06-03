"use client";

import { UserFacingErrorAlert } from "@/components/ui/UserFacingErrorAlert";
import { ProtocolLogo, type Protocol } from "@/components/ui/ProtocolLogo";
import { formatStatusLabel, StatusBadge } from "@/components/ui/StatusBadge";
import { AGENT_MODE_LABELS } from "@/lib/constants";
import type { UserFacingError } from "@/lib/errors/user-facing-errors";
import { shortenSuiAddress } from "@/lib/sui-client-helpers";
import type { AgentMode, StorageMode } from "@/types/blackbox";

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
  proofConfigured: boolean;
  rerunning?: boolean;
  running: boolean;
  steps: AgentExecutionStep[];
  storageMode: StorageMode;
  taskTitle: string;
  walletAddress?: string;
}

const statusLabel: Record<ExecutionStatus, string> = {
  pending: "Queued",
  running: "Active",
  rerunning: "Re-running",
  done: "Sealed",
  error: "Action Needed",
};

const statusIcon: Record<ExecutionStatus, string> = {
  pending: "solar:clock-circle-line-duotone",
  running: "solar:pulse-2-bold-duotone",
  rerunning: "solar:restart-circle-line-duotone",
  done: "solar:check-circle-bold-duotone",
  error: "solar:danger-triangle-bold-duotone",
};

const stepIcon: Record<string, string> = {
  reading: "solar:document-add-line-duotone",
  planning: "solar:branching-paths-down-line-duotone",
  tools: "solar:settings-bold-duotone",
  report: "solar:document-text-line-duotone",
  sealing: "solar:lock-keyhole-line-duotone",
  uploading: "solar:cloud-upload-line-duotone",
  reading_back: "solar:restart-circle-line-duotone",
  verifying: "solar:shield-check-line-duotone",
  saving: "solar:archive-check-line-duotone",
};

function getStepClasses(status: ExecutionStatus) {
  if (status === "done") {
    return {
      card: "border-emerald-300/20 bg-emerald-300/[0.045] text-emerald-50 shadow-[0_0_28px_-22px_rgba(110,231,183,0.75)]",
      node: "border-emerald-300/70 bg-emerald-300 text-[#050507] shadow-[0_0_24px_rgba(110,231,183,0.28)]",
      rail: "bg-emerald-300/45",
      pill: "border-emerald-300/20 bg-emerald-300/[0.09] text-emerald-200",
      meta: "text-emerald-200/70",
    };
  }
  if (status === "running" || status === "rerunning") {
    return {
      card: "border-cyan-300/35 bg-cyan-300/[0.075] text-white shadow-[0_0_38px_-22px_rgba(103,232,249,0.9)]",
      node: "animate-[consolePulse_1.6s_ease-in-out_infinite] border-cyan-200 bg-cyan-300 text-[#050507] shadow-[0_0_28px_rgba(103,232,249,0.42)]",
      rail: "bg-cyan-300/55",
      pill: "border-cyan-300/25 bg-cyan-300/[0.12] text-cyan-200",
      meta: "text-cyan-200",
    };
  }
  if (status === "error") {
    return {
      card: "border-amber-200/25 bg-red-950/35 text-red-50 shadow-[0_0_34px_-22px_rgba(251,191,36,0.65)]",
      node: "border-amber-200 bg-amber-200 text-[#050507] shadow-[0_0_24px_rgba(251,191,36,0.3)]",
      rail: "bg-amber-200/45",
      pill: "border-amber-200/25 bg-amber-200/[0.11] text-amber-100",
      meta: "text-amber-100/80",
    };
  }
  return {
    card: "border-white/[0.07] bg-white/[0.018] text-zinc-400",
    node: "border-white/15 bg-[#111119] text-zinc-500",
    rail: "bg-white/10",
    pill: "border-white/[0.08] bg-black/25 text-zinc-500",
    meta: "text-zinc-600",
  };
}

function getStepMeta(step: AgentExecutionStep, index: number) {
  if (step.status === "pending") {
    return index > 4 ? "awaiting proof path" : "queued";
  }
  if (step.status === "running") {
    return "recording now";
  }
  if (step.status === "rerunning") {
    return "re-running now";
  }
  if (step.status === "error") {
    return step.id === "uploading" ? "Walrus attention needed" : "attention needed";
  }
  if (step.id === "sealing") {
    return "hashes sealed";
  }
  if (step.id === "uploading") {
    return "Walrus Mainnet";
  }
  if (step.id === "verifying") {
    return "trace hash matched";
  }
  return `sealed T+${String(index + 1).padStart(2, "0")}`;
}

function getWorkspaceState(steps: AgentExecutionStep[]) {
  const activeStep = steps.find((step) => step.status === "running" || step.status === "rerunning");
  const erroredStep = steps.find((step) => step.status === "error");
  const doneCount = steps.filter((step) => step.status === "done").length;
  const activeIndex = steps.findIndex((step) => step.status === "running" || step.status === "rerunning" || step.status === "error");
  const visibleCount = doneCount === steps.length ? steps.length : activeIndex >= 0 ? activeIndex + 1 : doneCount;
  const status = erroredStep ? "ERROR" : activeStep ? "RUNNING" : doneCount === steps.length ? "SEALED" : "READY";
  const title = erroredStep
    ? "Trace interrupted"
    : activeStep
      ? "Trace recording"
      : doneCount === steps.length
        ? "Trace sealed"
        : "Trace ready";
  const subcopy = erroredStep
    ? "The execution path is paused at the highlighted step. Prior sealed evidence remains intact."
    : activeStep?.status === "rerunning"
      ? `Re-running from ${activeStep.label} with prior sealed evidence preserved.`
      : activeStep?.detail ?? "Agent Runtime is standing by to capture intent, store evidence, and verify the trace.";

  return { activeStep, doneCount, erroredStep, status, subcopy, title, visibleCount };
}

function TraceMetadataStrip({
  agentMode,
  proofConfigured,
  steps,
  storageMode,
  taskTitle,
  walletAddress,
}: Pick<
  AgentExecutionWorkspaceProps,
  "agentMode" | "proofConfigured" | "steps" | "storageMode" | "taskTitle" | "walletAddress"
>) {
  const sealed = steps.some((step) => step.id === "sealing" && step.status === "done");
  const metadata = [
    { label: "Session ID", value: taskTitle ? "prepared after start" : "awaiting task" },
    { label: "Agent mode", value: AGENT_MODE_LABELS[agentMode] },
    { label: "Wallet", value: walletAddress ? shortenSuiAddress(walletAddress) : "Not Connected", protocol: "sui" as Protocol },
    { label: "Storage target", value: `Walrus Mainnet / ${formatStatusLabel(storageMode)}`, protocol: "walrus" as Protocol },
    { label: "Proof state", value: proofConfigured ? "Sui Mainnet Ready" : "Contract Pending", protocol: "sui" as Protocol },
    { label: "Trace hash", value: sealed ? "Local Hash Sealed" : "Pending Hash" },
  ];

  return (
    <div className="grid gap-2 rounded-[1.35rem] border border-white/[0.07] bg-black/25 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {metadata.map(({ label, protocol, value }) => (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5" key={label}>
          <div className="flex items-center gap-2">
            {protocol && <ProtocolLogo protocol={protocol} size="sm" />}
            <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              {label}
            </p>
          </div>
          <p className="mt-1 truncate text-xs font-medium text-zinc-200">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ExecutionStepCard({ index, isLast, step }: { index: number; isLast: boolean; step: AgentExecutionStep }) {
  const classes = getStepClasses(step.status);
  const protocol = step.id === "uploading" ? "walrus" : undefined;

  return (
    <div className="relative pl-9">
      {!isLast && <span className={`absolute left-[0.72rem] top-11 h-full w-px ${classes.rail}`} />}
      <span
        className={`absolute left-0 top-5 flex h-6 w-6 items-center justify-center rounded-full border ${classes.node}`}
      >
        {protocol ? (
          <ProtocolLogo protocol={protocol} size="sm" className="border-0 bg-transparent shadow-none" />
        ) : (
          <iconify-icon icon={stepIcon[step.id] ?? statusIcon[step.status]} className="text-sm" />
        )}
      </span>

      <div
        className={`group relative overflow-hidden rounded-[1.35rem] border px-4 py-4 transition-all duration-300 ${classes.card}`}
      >
        {(step.status === "running" || step.status === "rerunning") && (
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.055] to-transparent" />
        )}
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-600">
                Step {String(index + 1).padStart(2, "0")}
              </p>
              <StatusBadge status={statusLabel[step.status]} size="sm" />
            </div>
            <h4 className="mt-2 text-sm font-semibold text-inherit">{step.label}</h4>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500 group-hover:text-zinc-400">
              {step.detail}
            </p>
          </div>
          <StatusBadge status={getStepMeta(step, index)} size="sm" />
        </div>
      </div>
    </div>
  );
}

function ExecutionTimeline({ steps }: { steps: AgentExecutionStep[] }) {
  return (
    <div className="relative space-y-3">
      {steps.map((step, index) => (
        <ExecutionStepCard index={index} isLast={index === steps.length - 1} key={step.id} step={step} />
      ))}
    </div>
  );
}

function getProofCardState(steps: AgentExecutionStep[], key: "bundle" | "walrus" | "replay" | "hash") {
  const byId = Object.fromEntries(steps.map((step) => [step.id, step.status])) as Record<string, ExecutionStatus>;
  if (key === "bundle") {
    return byId.sealing === "error" ? "error" : byId.sealing === "done" ? "sealed" : "queued";
  }
  if (key === "walrus") {
    return byId.uploading === "error" ? "error" : byId.uploading === "done" ? "sealed" : byId.uploading === "running" || byId.uploading === "rerunning" ? "active" : "queued";
  }
  if (key === "replay") {
    return byId.reading_back === "error" ? "error" : byId.reading_back === "done" ? "sealed" : byId.reading_back === "running" || byId.reading_back === "rerunning" ? "active" : "queued";
  }
  return byId.verifying === "error" ? "error" : byId.verifying === "done" ? "sealed" : byId.verifying === "running" || byId.verifying === "rerunning" ? "active" : "queued";
}

function getMiniCardClasses(state: ReturnType<typeof getProofCardState>) {
  if (state === "sealed") {
    return "border-emerald-300/20 bg-emerald-300/[0.045] text-emerald-100";
  }
  if (state === "active") {
    return "border-cyan-300/25 bg-cyan-300/[0.065] text-cyan-100";
  }
  if (state === "error") {
    return "border-amber-200/25 bg-amber-300/[0.055] text-amber-100";
  }
  return "border-white/[0.07] bg-white/[0.018] text-zinc-500";
}

function ProofMiniCards({ steps }: { steps: AgentExecutionStep[] }) {
  const cards = [
    ["bundle", "Trace bundle", "input/result/trace hashes", undefined],
    ["walrus", "Walrus blob", "Mainnet storage request", "walrus"],
    ["replay", "Replay check", "aggregator readback", "walrus"],
    ["hash", "Hash match", "sealed payload compare", undefined],
  ] as const;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {cards.map(([key, title, detail, protocol]) => {
        const state = getProofCardState(steps, key);
        return (
          <div className={`rounded-2xl border p-3 transition-all ${getMiniCardClasses(state)}`} key={key}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {protocol && <ProtocolLogo protocol={protocol} size="sm" />}
                <p className="truncate text-xs font-semibold text-inherit">{title}</p>
              </div>
              <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-current opacity-70">
                {formatStatusLabel(state)}
              </span>
            </div>
            <p className="mt-2 text-[0.68rem] leading-4 text-zinc-500">{detail}</p>
          </div>
        );
      })}
    </div>
  );
}

function SealedOutputPreview({
  agentMode,
  error,
  steps,
  taskTitle,
}: Pick<AgentExecutionWorkspaceProps, "agentMode" | "error" | "steps" | "taskTitle">) {
  const sealed = steps.every((step) => step.status === "done");
  const hasStarted = steps.some((step) => step.status !== "pending");

  return (
    <div className="relative overflow-hidden rounded-[1.45rem] border border-white/[0.08] bg-[#050508]/70 p-4">
      <div className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-indigo-300">
            Sealed Output Preview
          </p>
          <h4 className="mt-2 text-base font-semibold text-white">
            {sealed ? "Agent report sealed" : error ? "Output held for recovery" : "Waiting for sealed report"}
          </h4>
        </div>
        <iconify-icon
          icon={sealed ? "solar:document-text-bold-duotone" : "solar:hourglass-line-duotone"}
          className="text-2xl text-indigo-200/80"
        />
      </div>

      {sealed ? (
        <div className="relative mt-5 space-y-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.035] p-4">
          <p className="text-sm font-medium text-emerald-50">
            {taskTitle || `${AGENT_MODE_LABELS[agentMode]} session`} is sealed for replay and verification.
          </p>
          <p className="text-xs leading-5 text-zinc-400">
            The BlackBox trace bundle includes the generated report, deterministic hashes, Walrus
            storage evidence, replay check, and local session record.
          </p>
        </div>
      ) : (
        <div className="relative mt-5 space-y-3">
          <div className="h-3 w-3/4 overflow-hidden rounded-full bg-white/[0.06]">
            {hasStarted && <span className="block h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />}
          </div>
          <div className="h-3 w-11/12 overflow-hidden rounded-full bg-white/[0.045]">
            {hasStarted && <span className="block h-full w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-indigo-300/20 to-transparent" />}
          </div>
          <div className="h-3 w-2/3 overflow-hidden rounded-full bg-white/[0.035]">
            {hasStarted && <span className="block h-full w-2/5 animate-shimmer bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />}
          </div>
          <p className="pt-2 text-xs leading-5 text-zinc-500">
            {error
              ? "Resolve the interrupted step to continue sealing the output preview."
              : "The report preview appears here after Agent BlackBox writes and seals the trace output."}
          </p>
        </div>
      )}
    </div>
  );
}

function ErrorRecoveryPanel({
  error,
  failedStep,
  onRerunFromFailedStep,
  rerunning,
}: {
  error: UserFacingError;
  failedStep?: AgentExecutionStep;
  onRerunFromFailedStep?: () => void;
  rerunning?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.45rem] border border-amber-200/15 bg-amber-300/[0.045] p-4">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-amber-200/60 to-transparent" />
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-amber-100">
            Recovery Path
          </p>
          <h4 className="mt-2 text-sm font-semibold text-amber-50">
            {failedStep ? `${failedStep.label} can be re-run.` : "The interrupted step can be re-run."}
          </h4>
          <p className="mt-2 text-xs leading-5 text-amber-50/70">
            Previously sealed steps stay sealed. Agent BlackBox resumes from the interrupted step
            using the sealed trace bundle and any storage or replay artifacts already recorded.
          </p>
        </div>

        <UserFacingErrorAlert error={error} tone="amber" />

        {onRerunFromFailedStep && (
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/[0.08] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-amber-50 transition hover:border-amber-200/35 hover:bg-amber-200/[0.12] disabled:cursor-wait disabled:opacity-65"
            disabled={rerunning}
            onClick={onRerunFromFailedStep}
            type="button"
          >
            <iconify-icon
              icon={rerunning ? "solar:spinner-linear" : "solar:restart-circle-line-duotone"}
              className={`text-base ${rerunning ? "animate-spin" : ""}`}
            />
            {rerunning ? "RE-RUNNING AGENT..." : "RE-RUN AGENT"}
          </button>
        )}
      </div>
    </div>
  );
}

export function AgentExecutionWorkspace({
  agentMode,
  error,
  onRerunFromFailedStep,
  proofConfigured,
  rerunning = false,
  running,
  steps,
  storageMode,
  taskTitle,
  walletAddress,
}: AgentExecutionWorkspaceProps) {
  const workspace = getWorkspaceState(steps);
  const failedStep = steps.find((step) => step.status === "error");
  const recoveryStep = failedStep ?? steps.find((step) => step.status === "rerunning");

  return (
    <section className="relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-[#06060b] p-[1px] shadow-[0_32px_120px_-60px_rgba(99,102,241,0.65)]">
      <div className="pointer-events-none absolute inset-0 animate-[consoleBorder_9s_linear_infinite] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(103,232,249,0),rgba(103,232,249,0.28),rgba(129,140,248,0.24),rgba(103,232,249,0))] opacity-60 motion-reduce:animate-none" />
      <div className="relative overflow-hidden rounded-[1.82rem] bg-[#07070c]/96 p-5 backdrop-blur-xl sm:p-6 lg:p-7">
        <div className="pointer-events-none absolute inset-0 grain opacity-[0.08]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-28 animate-[consoleScan_4.5s_ease-in-out_infinite] bg-gradient-to-b from-cyan-300/10 via-cyan-300/[0.035] to-transparent blur-md motion-reduce:animate-none" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Agent Execution
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {workspace.title}
              </h3>
              <span className="rounded-full border border-white/[0.08] bg-black/35 px-3 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                {workspace.visibleCount}/{steps.length} steps
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{workspace.subcopy}</p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            <StatusBadge
              status={
                workspace.status === "ERROR"
                  ? "Action Needed"
                  : workspace.status === "SEALED"
                    ? "Sealed"
                    : workspace.status === "RUNNING"
                      ? "Active"
                      : "Ready"
              }
              size="md"
            />
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-zinc-600">
              <span className="inline-flex items-center gap-2">
                <ProtocolLogo protocol="walrus" size="sm" />
                Storage target / Walrus Mainnet
              </span>
            </p>
          </div>
        </div>

        <div className="relative mt-6">
          <TraceMetadataStrip
            agentMode={agentMode}
            proofConfigured={proofConfigured}
            steps={steps}
            storageMode={storageMode}
            taskTitle={taskTitle}
            walletAddress={walletAddress}
          />
        </div>

        <div className="relative mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
          <ExecutionTimeline steps={steps} />
          <div className="space-y-4">
            <SealedOutputPreview agentMode={agentMode} error={error} steps={steps} taskTitle={taskTitle} />
            <ProofMiniCards steps={steps} />
            {error && (
              <ErrorRecoveryPanel
                error={error}
                failedStep={recoveryStep}
                onRerunFromFailedStep={onRerunFromFailedStep}
                rerunning={rerunning}
              />
            )}
          </div>
        </div>

        <div className="relative mt-6 border-t border-white/[0.08] pt-5">
          <p className="max-w-xl text-xs leading-5 text-zinc-500">
            The execution workspace reflects the live trace state after Run Agent starts capture:
            intent parsing, Walrus Mainnet storage, replay, hash matching, and session persistence.
          </p>
        </div>
      </div>
    </section>
  );
}
