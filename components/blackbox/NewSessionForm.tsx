"use client";

import { useCurrentAccount, useCurrentNetwork, useDAppKit } from "@mysten/dapp-kit-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";

import { AnchorProofPanel } from "@/components/blackbox/AnchorProofPanel";
import { AgentExecutionWorkspace } from "@/components/blackbox/AgentExecutionWorkspace";
import { ProtocolLogo } from "@/components/ui/ProtocolLogo";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WalletConnectButton } from "@/components/ui/WalletConnectButton";
import {
  isNetworkMismatchError,
  isSuiGasError,
  isWalBalanceError,
  isWalletRejectedError,
  normalizeUserFacingError,
  WalrusUploadError,
  type UserFacingError,
  type WalrusUploadDiagnostics,
  type WalrusUploadErrorCode,
} from "@/lib/errors/user-facing-errors";
import { readJsonResponse } from "@/lib/http/safe-json";
import { getNetworkConfig, normalizeSuiNetwork } from "@/lib/network-config";
import { shortenSuiAddress } from "@/lib/sui-client-helpers";
import { getSuiProofRegistryConfig } from "@/lib/sui-proof";
import {
  storeTraceBundleWithWallet,
  WalrusSdkRelayClientError,
  type UploadProgressStep,
  type WalrusSdkRelayFailureDetails,
} from "@/lib/walrus-sdk-relay-client";
import type { TraceBundle } from "@/lib/storage-adapters/types";
import type {
  AgentMode,
  AgentSession,
  InputFile,
  SessionRerunPrefill,
  StorageMode,
  StorageReference,
} from "@/types/blackbox";

type DraftFile = Pick<InputFile, "name" | "type" | "size">;
type ExecutionStatus = "pending" | "running" | "rerunning" | "done" | "error";
type ExecutionStepId =
  | "reading"
  | "planning"
  | "tools"
  | "report"
  | "sealing"
  | "uploading"
  | "reading_back"
  | "verifying"
  | "saving";

const EXECUTION_STEPS: Array<{ id: ExecutionStepId; label: string; detail: string }> = [
  { id: "reading", label: "Reading your request", detail: "Understood the prompt and evidence" },
  { id: "planning", label: "Planning the answer", detail: "Selected the right agent mode" },
  { id: "tools", label: "Checking available data", detail: "Checked Sui and task context" },
  { id: "report", label: "Preparing the answer", detail: "Created the agent report" },
  { id: "sealing", label: "Sealing the proof trace", detail: "Sealed the trace" },
  {
    id: "uploading",
    label: "Storing the trace on Walrus",
    detail: "Stored on Walrus",
  },
  { id: "reading_back", label: "Verifying Walrus readback", detail: "Verified readback" },
  { id: "verifying", label: "Checking the sealed proof", detail: "Matched the sealed proof" },
  { id: "saving", label: "Proof is ready", detail: "Prepared Sui anchor" },
];

const AGENT_OPTIONS: Array<{ mode: AgentMode; label: string; description: string }> = [
  {
    mode: "onchain_monitor",
    label: "Sui Wallet Analysis",
    description: "Analyze Sui wallets, objects, packages, or transactions.",
  },
  {
    mode: "research",
    label: "Research Brief",
    description: "Turn a topic or claim into a sealed research report.",
  },
  {
    mode: "risk_review",
    label: "Risk Review",
    description: "Find risks, severity, impact, and mitigations.",
  },
  {
    mode: "delivery_proof",
    label: "Delivery Proof",
    description: "Create a sealed delivery receipt for completed work.",
  },
];

interface PrepareSessionPayload {
  data?: {
    session: AgentSession;
    traceBundle: TraceBundle;
    storageConfig: {
      provider?: string;
      network: string;
      relayUrl: string;
      aggregatorUrl: string;
      storageEpochs: number;
      storageMode: StorageMode;
      relayStatus?: {
        reachable?: boolean;
        tipConfig?: unknown;
        error?: string;
        statusCode?: number;
        contentType?: string;
        responseSnippet?: string;
      };
    };
  };
  message?: string;
  details?: string;
}

interface FinalizeStoragePayload {
  data?: { session?: AgentSession };
  message?: string;
  details?: string;
}

interface SessionLookupPayload {
  data?: { session?: AgentSession };
  message?: string;
  error?: { message?: string };
}

interface ExecutionArtifacts {
  prepared?: NonNullable<PrepareSessionPayload["data"]>;
  storage?: StorageReference;
  finalizedSession?: AgentSession;
}

interface NewSessionFormProps {
  rerunId?: string;
  rerunError?: string;
  rerunPrefill?: SessionRerunPrefill;
}

const AGENT_MODES = new Set<AgentMode>(["research", "risk_review", "delivery_proof", "onchain_monitor"]);
const STORAGE_MODES = new Set<StorageMode>(["deletable", "permanent"]);

function normalizeAgentMode(value: AgentSession["agentMode"]): AgentMode {
  return AGENT_MODES.has(value) ? value : "research";
}

function normalizeStorageMode(value: AgentSession["storageMode"]): StorageMode {
  return STORAGE_MODES.has(value) ? value : "deletable";
}

function normalizeStorageEpochs(session: AgentSession) {
  const epochs = session.storageEpochs || session.storage.storageEpochs || 1;
  return Number.isInteger(epochs) && epochs >= 1 && epochs <= 53 ? epochs : 1;
}

function buildRerunPrefill(session: AgentSession): SessionRerunPrefill {
  return {
    sourceSessionId: session.id,
    title: session.title ?? "",
    prompt: session.prompt ?? "",
    agentMode: normalizeAgentMode(session.agentMode),
    storageMode: normalizeStorageMode(session.storageMode),
    storageEpochs: normalizeStorageEpochs(session),
    inputFiles: session.inputFiles.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    })),
  };
}

function initialExecutionProgress() {
  return EXECUTION_STEPS.map((step) => ({ ...step, status: "pending" as ExecutionStatus }));
}

function getStepIndex(id: ExecutionStepId) {
  return EXECUTION_STEPS.findIndex((step) => step.id === id);
}

function getStorageEpochOptions(current: number) {
  return Array.from(
    new Set([1, 5, 10, Number.isInteger(current) && current > 0 ? current : 1]),
  ).sort((left, right) => left - right);
}

function formatEpochOption(value: number) {
  return `${value} epoch${value === 1 ? "" : "s"}`;
}

function deriveTaskTitle(prompt: string, agentMode: AgentMode) {
  const compactPrompt = prompt.replace(/\s+/g, " ").trim();
  if (compactPrompt) {
    const clipped = compactPrompt.slice(0, 72).trim();
    return clipped.length < compactPrompt.length ? `${clipped}...` : clipped;
  }
  return AGENT_OPTIONS.find((option) => option.mode === agentMode)?.label ?? "Agent BlackBox Proof";
}

function downloadFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportSessionReport(session: AgentSession) {
  const report = session.trace.structuredOutput;
  const payload = {
    exportedAt: new Date().toISOString(),
    session: {
      id: session.id,
      title: session.title,
      agentMode: session.agentMode,
      ownerAddress: session.ownerAddress,
      createdAt: session.createdAt,
    },
    report: report
      ? {
          title: `${report.agentDisplayName}: ${report.taskTitle}`,
          summary: report.executiveSummary,
          finalOutput: report.finalOutput,
          findings: report.findings,
          limitations: report.limitations,
          nextActions: report.recommendedNextActions,
        }
      : {
          finalOutput: session.trace.finalOutput,
        },
    proof: {
      walrusBlobId: session.storage.blobId,
      traceHash: session.trace.traceHash,
      resultHash: session.trace.resultHash,
      suiTransactionDigest: session.proof.transactionDigest,
      suiProofObject: session.proof.suiObjectId,
    },
  };
  downloadFile(`${session.id}-agent-report.json`, JSON.stringify(payload, null, 2), "application/json");
}

function buildApiErrorMessage(payload: { message?: string; details?: string }, fallback: string) {
  return [payload.message ?? fallback, payload.details ? `Technical detail: ${payload.details}` : ""]
    .filter(Boolean)
    .join("\n");
}

function safeTrimmedText(value: unknown, maxLength = 800) {
  if (typeof value !== "string") return undefined;
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength) || undefined;
}

function safeResponseSnippet(value: unknown) {
  const snippet = safeTrimmedText(value, 240);
  if (!snippet) return undefined;
  if (/<(?:!doctype|html|head|body|script)\b/i.test(snippet)) {
    return "HTML response omitted.";
  }
  return snippet.replace(/<[^>]+>/g, "").trim() || undefined;
}

function shortErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error.");
  return safeTrimmedText(message) ?? "Unknown error.";
}

function errorRecord(error: unknown) {
  return typeof error === "object" && error !== null ? error as Record<string, unknown> : null;
}

function nestedErrorRecord(error: unknown, key: string) {
  const record = errorRecord(error);
  const nested = record?.[key];
  return typeof nested === "object" && nested !== null ? nested as Record<string, unknown> : null;
}

function errorStatusCode(error: unknown) {
  const record = errorRecord(error);
  const response = nestedErrorRecord(error, "response");
  const status = record?.status ?? record?.statusCode ?? response?.status ?? response?.statusCode;
  return typeof status === "number" ? status : undefined;
}

function errorCode(error: unknown) {
  const record = errorRecord(error);
  return typeof record?.code === "string"
    ? record.code
    : typeof record?.name === "string"
      ? record.name
      : undefined;
}

function errorActionName(error: unknown) {
  const record = errorRecord(error);
  return typeof record?.actionName === "string" ? record.actionName : undefined;
}

function errorContentType(error: unknown) {
  const record = errorRecord(error);
  const response = nestedErrorRecord(error, "response");
  const direct = record?.contentType ?? response?.contentType;
  if (typeof direct === "string") return direct;
  const headers = response?.headers;
  if (headers && typeof (headers as Headers).get === "function") {
    return (headers as Headers).get("content-type") ?? undefined;
  }
  return undefined;
}

function errorResponseSnippet(error: unknown) {
  const record = errorRecord(error);
  const response = nestedErrorRecord(error, "response");
  return (
    safeResponseSnippet(record?.responseSnippet) ??
    safeResponseSnippet(record?.snippet) ??
    safeResponseSnippet(record?.body) ??
    safeResponseSnippet(response?.body) ??
    safeResponseSnippet(response?.data)
  );
}

function safeUrlHost(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value).host;
  } catch {
    return undefined;
  }
}

function relayFailureDetails(error: unknown): Partial<WalrusSdkRelayFailureDetails> {
  if (error instanceof WalrusSdkRelayClientError) return error.details;
  const details = errorRecord(error)?.details;
  return typeof details === "object" && details !== null
    ? details as Partial<WalrusSdkRelayFailureDetails>
    : {};
}

function recommendationForWalrusError(code: WalrusUploadErrorCode) {
  if (code === "wallet_rejected") return "Retry Step 06 and approve both Walrus wallet requests.";
  if (code === "insufficient_sui") return "Add SUI for Walrus registration/certification gas, then retry Step 06.";
  if (code === "insufficient_wal") return "Add WAL/SUI storage balance for Walrus Mainnet, then retry Step 06.";
  if (code === "wrong_network") return "Switch the connected wallet to Sui Mainnet, then retry Step 06.";
  if (code === "walrus_config_missing" || code === "relay_unavailable") {
    return "Check Walrus relay configuration/status, then retry Step 06.";
  }
  if (code === "blob_id_missing") return "Retry Step 06; the relay did not return a usable blob reference.";
  return "Retry Step 06 or check Walrus upload relay status.";
}

function classifyWalrusUploadError(error: unknown): WalrusUploadErrorCode {
  const message = shortErrorMessage(error).toLowerCase();
  const code = errorCode(error)?.toLowerCase() ?? "";
  if (isWalBalanceError(error) || (message.includes("::wal::wal") && message.includes("insufficient"))) {
    return "insufficient_wal";
  }
  if (isSuiGasError(error)) return "insufficient_sui";
  if (isWalletRejectedError(error)) return "wallet_rejected";
  if (isNetworkMismatchError(error)) return "wrong_network";
  if (/signer|signandexecutetransaction/i.test(message) || code.includes("signer_unavailable")) {
    return "wallet_signer_unavailable";
  }
  if (/prepared trace|trace artifacts|trace bundle.*(missing|not available|not found)|trace.*not found/i.test(message)) {
    return "invalid_trace_bundle";
  }
  if (/content-type|invalid json|non-json|html|invalid response/i.test(message)) {
    return "invalid_endpoint_response";
  }
  if (/blob id|blobid/i.test(message) && /missing|not return|did not|empty/i.test(message)) {
    return "blob_id_missing";
  }
  if (/relay|endpoint|fetch|network|timeout|unavailable|http\s+\d{3}/i.test(message)) {
    return "relay_unavailable";
  }
  return "upload_failed";
}

export function NewSessionForm({ rerunError, rerunId, rerunPrefill }: NewSessionFormProps = {}) {
  const router = useRouter();
  const walletAccount = useCurrentAccount();
  const walletNetwork = useCurrentNetwork();
  const dAppKit = useDAppKit();
  const [activeRerunPrefill, setActiveRerunPrefill] = useState<SessionRerunPrefill | null>(rerunPrefill ?? null);
  const [rerunLoadError, setRerunLoadError] = useState(rerunError ?? "");
  const [rerunLoading, setRerunLoading] = useState(false);
  const [title, setTitle] = useState(rerunPrefill?.title ?? "");
  const [prompt, setPrompt] = useState(rerunPrefill?.prompt ?? "");
  const [agentMode, setAgentMode] = useState<AgentMode>(rerunPrefill?.agentMode ?? "research");
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [storageEpochs, setStorageEpochs] = useState(rerunPrefill?.storageEpochs ?? 1);
  const [storageMode, setStorageMode] = useState<StorageMode>(rerunPrefill?.storageMode ?? "deletable");
  const [evidenceMenuOpen, setEvidenceMenuOpen] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [anchorMessages, setAnchorMessages] = useState<Array<{ id: string; message: string; tone: "pending" | "success" | "error" }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [artifacts, setArtifacts] = useState<ExecutionArtifacts>({});
  const [executionProgress, setExecutionProgress] = useState(initialExecutionProgress);
  const executionWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const configuredNetwork = getNetworkConfig();
  const proofContractConfigured = getSuiProofRegistryConfig().configured;
  const failedExecutionStep = executionProgress.find((step) => step.status === "error");
  const effectiveTitle = title.trim() || deriveTaskTitle(prompt, agentMode);
  const formReady = prompt.trim().length > 0;
  const rerunFileNames = activeRerunPrefill?.inputFiles.map((file) => file.name).filter(Boolean) ?? [];

  useEffect(() => {
    if (!rerunId || rerunPrefill || activeRerunPrefill?.sourceSessionId === rerunId) return;
    if (!walletAccount?.address) {
      setRerunLoadError("Connect the session owner wallet to load re-run prefill.");
      return;
    }

    const controller = new AbortController();
    const endpoint = `/api/sessions/${encodeURIComponent(rerunId)}?ownerWallet=${encodeURIComponent(walletAccount.address)}`;
    setRerunLoading(true);
    setRerunLoadError("");

    fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        const payload = await readJsonResponse<SessionLookupPayload>(response, `GET ${endpoint}`);
        if (!response.ok || !payload.data?.session) {
          throw new Error(payload.error?.message ?? payload.message ?? "Could not load previous session for re-run.");
        }
        return payload.data.session;
      })
      .then((sourceSession) => {
        const prefill = buildRerunPrefill(sourceSession);
        setActiveRerunPrefill(prefill);
        setTitle(prefill.title);
        setPrompt(prefill.prompt);
        setAgentMode(prefill.agentMode);
        setFiles([]);
        setStorageEpochs(prefill.storageEpochs);
        setStorageMode(prefill.storageMode);
        setRerunLoadError("");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setRerunLoadError(error instanceof Error ? error.message : "Could not load previous session for re-run.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setRerunLoading(false);
      });

    return () => controller.abort();
  }, [activeRerunPrefill?.sourceSessionId, rerunId, rerunPrefill, walletAccount?.address]);

  function clearRerunPrefill() {
    setActiveRerunPrefill(null);
    setTitle("");
    setPrompt("");
    setAgentMode("research");
    setFiles([]);
    setStorageEpochs(1);
    setStorageMode("deletable");
    router.replace("/sessions/new");
  }

  function activateStep(id: ExecutionStepId, status: Extract<ExecutionStatus, "running" | "rerunning"> = "running") {
    setExecutionProgress((steps) =>
      steps.map((step) =>
        step.id === id
          ? { ...step, status }
          : step.status === "running" || step.status === "rerunning"
            ? { ...step, status: "done" }
            : step,
      ),
    );
  }

  function completeStep(id: ExecutionStepId) {
    setExecutionProgress((steps) =>
      steps.map((step) => (step.id === id ? { ...step, status: "done" } : step)),
    );
  }

  function completeSteps(ids: ExecutionStepId[]) {
    setExecutionProgress((steps) =>
      steps.map((step) => (ids.includes(step.id) ? { ...step, status: "done" } : step)),
    );
  }

  function markExecutionFailure(fallbackStep: ExecutionStepId) {
    setExecutionProgress((steps) => {
      const activeIndex = steps.findIndex((step) => step.status === "running" || step.status === "rerunning");
      const failedIndex = activeIndex >= 0 ? activeIndex : getStepIndex(fallbackStep);
      return steps.map((step, index) =>
        index < failedIndex
          ? step
          : index === failedIndex
            ? { ...step, status: "error" }
            : { ...step, status: "pending" },
      );
    });
  }

  function handleWalletUploadProgress(step: UploadProgressStep, message: string) {
    if (step === "reading_back" || /reading blob/i.test(message)) {
      completeStep("uploading");
      activateStep("reading_back");
      return;
    }
    activateStep("uploading");
  }

  function validateWalletReady() {
    if (!walletAccount) {
      setError({
        title: "Connect wallet to store trace on Walrus Mainnet.",
        lines: ["Choose a Sui wallet before the Agent can create storage."],
      });
      document.getElementById("agent-wallet-requirement")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return false;
    }
    if (normalizeSuiNetwork(walletNetwork) !== configuredNetwork.network) {
      setError({
        title: "Switch to Sui Mainnet.",
        lines: ["Agent BlackBox is configured for Sui Mainnet."],
      });
      return false;
    }
    return true;
  }

  function walletSignerAvailable() {
    return typeof dAppKit.signAndExecuteTransaction === "function";
  }

  function getWalrusMissingConfigKeys(prepared?: NonNullable<PrepareSessionPayload["data"]>) {
    if (!prepared) return ["prepared trace bundle", "WALRUS_UPLOAD_RELAY_URL", "WALRUS_AGGREGATOR_URL"];
    const missing: string[] = [];
    if (!prepared.storageConfig.provider) missing.push("STORAGE_PROVIDER");
    if (prepared.storageConfig.provider && prepared.storageConfig.provider !== "walrus_sdk_relay") {
      missing.push("STORAGE_PROVIDER=walrus_sdk_relay");
    }
    if (!prepared.storageConfig.network) missing.push("WALRUS_NETWORK");
    if (configuredNetwork.network === "sui-mainnet" && prepared.storageConfig.network !== "mainnet") {
      missing.push("WALRUS_NETWORK=mainnet");
    }
    if (!prepared.storageConfig.relayUrl) missing.push("WALRUS_UPLOAD_RELAY_URL");
    if (!prepared.storageConfig.aggregatorUrl) missing.push("WALRUS_AGGREGATOR_URL");
    return Array.from(new Set(missing));
  }

  function getBalancePreflightResult(uploadError?: unknown) {
    if (uploadError && (isWalBalanceError(uploadError) || classifyWalrusUploadError(uploadError) === "insufficient_wal")) {
      return "failed: insufficient WAL reported by wallet or Walrus SDK";
    }
    if (uploadError && classifyWalrusUploadError(uploadError) === "insufficient_sui") {
      return "failed: insufficient SUI gas reported by wallet or Sui RPC";
    }
    return "not checked: balance preflight is not exposed by the current wallet SDK path";
  }

  function buildWalrusDiagnostics(
    prepared?: NonNullable<PrepareSessionPayload["data"]>,
    overrides: Partial<WalrusUploadDiagnostics> = {},
  ): WalrusUploadDiagnostics {
    const traceBundle = prepared?.traceBundle;
    const missingConfigKeys = getWalrusMissingConfigKeys(prepared);
    const storageEpochsValid = Boolean(
      prepared &&
        Number.isInteger(prepared.storageConfig.storageEpochs) &&
        prepared.storageConfig.storageEpochs > 0,
    );
    return {
      failedStep: "Storing on Walrus Mainnet",
      stepId: "storage_upload",
      routePath: "wallet:walrus-sdk-relay",
      actionName: "Walrus SDK Upload Relay",
      endpoint: prepared?.storageConfig.relayUrl || undefined,
      relayHost: safeUrlHost(prepared?.storageConfig.relayUrl),
      network: `wallet ${normalizeSuiNetwork(walletNetwork)}; app ${configuredNetwork.network}; walrus ${prepared?.storageConfig.network ?? "not prepared"}`,
      expectedNetwork: "Sui Mainnet / Walrus Mainnet",
      storageMode: prepared?.storageConfig.storageMode ?? storageMode,
      walletAddress: walletAccount?.address ?? null,
      walletConnected: Boolean(walletAccount?.address),
      signerAvailable: walletSignerAvailable(),
      traceBundleExists: Boolean(traceBundle),
      inputHashExists: Boolean(traceBundle?.inputHash),
      resultHashExists: Boolean(traceBundle?.resultHash),
      traceHashExists: Boolean(traceBundle?.traceHash),
      walrusConfigExists: missingConfigKeys.length === 0,
      missingConfigKeys,
      relayUrlConfigured: Boolean(prepared?.storageConfig.relayUrl),
      aggregatorUrlConfigured: Boolean(prepared?.storageConfig.aggregatorUrl),
      storageEpochsValid,
      balancePreflight: "not checked: balance preflight is not exposed by the current wallet SDK path",
      walletApprovalRequested: false,
      walletApprovalStage: "none",
      uploadJobIdReturned: false,
      blobIdReturned: false,
      blobIdRecorded: false,
      recommendation: "Retry Step 06 or check Walrus upload relay status.",
      ...overrides,
    };
  }

  function createWalrusStepError(
    code: WalrusUploadErrorCode,
    message: string,
    prepared?: NonNullable<PrepareSessionPayload["data"]>,
    diagnostics: Partial<WalrusUploadDiagnostics> = {},
  ) {
    return new WalrusUploadError(
      message,
      code,
      buildWalrusDiagnostics(prepared, {
        errorCode: diagnostics.errorCode ?? code,
        shortMessage: diagnostics.shortMessage ?? message,
        sanitizedMessage: diagnostics.sanitizedMessage ?? diagnostics.shortMessage ?? message,
        recommendation: diagnostics.recommendation ?? recommendationForWalrusError(code),
        ...diagnostics,
      }),
    );
  }

  async function prepareAgentSession(activeStatus: Extract<ExecutionStatus, "running" | "rerunning">) {
    activateStep("reading", activeStatus);
    completeStep("reading");
    activateStep("planning", activeStatus);
    const endpoint = "POST /api/agent/prepare";
    const response = await fetch("/api/agent/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rerunOf: activeRerunPrefill?.sourceSessionId,
        agentMode,
        taskTitle: effectiveTitle,
        taskPrompt: prompt,
        inputFiles: files,
        storageDuration: `${storageEpochs}-epochs`,
        storageMode,
        walletAddress: walletAccount?.address,
        network: configuredNetwork.network,
      }),
    });
    const payload = await readJsonResponse<PrepareSessionPayload>(response, endpoint);
    if (!response.ok || !payload.data?.session || !payload.data.traceBundle) {
      throw new Error(buildApiErrorMessage(payload, "The session could not be created."));
    }
    completeSteps(["planning", "tools", "report", "sealing"]);
    setArtifacts((current) => ({ ...current, prepared: payload.data }));
    return payload.data;
  }

  function assertPreparedArtifact(currentArtifacts: ExecutionArtifacts) {
    if (!currentArtifacts.prepared) {
      throw new Error("Prepared trace artifacts are not available. Restart trace capture from Run Agent.");
    }
    return currentArtifacts.prepared;
  }

  function assertStorageArtifact(currentArtifacts: ExecutionArtifacts) {
    if (!currentArtifacts.storage) {
      throw new Error("Walrus storage artifacts are not available. Re-run the agent from the Walrus storage step.");
    }
    return currentArtifacts.storage;
  }

  function validateStorageConfig(prepared: NonNullable<PrepareSessionPayload["data"]>) {
    if (!walletAccount?.address) {
      throw createWalrusStepError(
        "wallet_not_connected",
        "Wallet connection is required to pay for Walrus Mainnet storage.",
        prepared,
        {
          routePath: "wallet:preflight",
          recommendation: "Connect a Sui Mainnet wallet, then retry Step 06.",
        },
      );
    }
    if (!walletSignerAvailable()) {
      throw createWalrusStepError(
        "wallet_signer_unavailable",
        "Wallet signer not available.",
        prepared,
        {
          routePath: "wallet:preflight",
          recommendation: "Reconnect the wallet so the signer is available, then retry Step 06.",
        },
      );
    }
    if (normalizeSuiNetwork(walletNetwork) !== configuredNetwork.network) {
      throw createWalrusStepError(
        "wrong_network",
        "Switch to Sui Mainnet before storing this trace on Walrus.",
        prepared,
        {
          routePath: "wallet:preflight",
          recommendation: "Switch the connected wallet to Sui Mainnet, then retry Step 06.",
        },
      );
    }
    if (!prepared.traceBundle) {
      throw createWalrusStepError(
        "invalid_trace_bundle",
        "The sealed trace bundle is missing.",
        prepared,
        {
          routePath: "wallet:preflight",
          traceBundleExists: false,
          recommendation: "Restart trace capture so the sealed bundle can be rebuilt.",
        },
      );
    }
    if (!prepared.traceBundle.inputHash || !prepared.traceBundle.resultHash || !prepared.traceBundle.traceHash) {
      throw createWalrusStepError(
        "invalid_trace_bundle",
        "The sealed trace bundle is missing one or more required hashes.",
        prepared,
        {
          routePath: "wallet:preflight",
          recommendation: "Restart trace capture so input, result, and trace hashes are resealed.",
        },
      );
    }
    const storageEpochsValid =
      Number.isInteger(prepared.storageConfig.storageEpochs) &&
      prepared.storageConfig.storageEpochs > 0;
    if (!prepared.storageConfig.storageMode || !storageEpochsValid) {
      throw createWalrusStepError(
        "invalid_storage_policy",
        "Walrus storage duration or storage mode is invalid.",
        prepared,
        {
          routePath: "wallet:preflight",
          storageEpochsValid: false,
          recommendation: "Choose a positive whole-number storage epoch value, then retry Step 06.",
        },
      );
    }
    const missingConfigKeys = getWalrusMissingConfigKeys(prepared);
    if (missingConfigKeys.length > 0) {
      throw createWalrusStepError(
        "walrus_config_missing",
        "Walrus upload is not ready. Check relay configuration and wallet connection.",
        prepared,
        {
          routePath: "wallet:preflight",
          missingConfigKeys,
          walrusConfigExists: false,
          recommendation: "Set the missing Walrus env/config keys, then retry Step 06.",
        },
      );
    }
    if (configuredNetwork.network === "sui-mainnet" && prepared.storageConfig.network !== "mainnet") {
      throw createWalrusStepError(
        "wrong_network",
        "Walrus storage is not configured for Mainnet while the app is using Sui Mainnet.",
        prepared,
        {
          routePath: "wallet:preflight",
          recommendation: "Set WALRUS_NETWORK=mainnet for Sui Mainnet sessions.",
        },
      );
    }
    if (!prepared.storageConfig.relayUrl) {
      throw createWalrusStepError(
        "walrus_config_missing",
        "Walrus upload is not ready. Check relay configuration and wallet connection.",
        prepared,
        {
          routePath: "wallet:preflight",
          relayUrlConfigured: false,
          recommendation: "Set WALRUS_UPLOAD_RELAY_URL, then retry Step 06.",
        },
      );
    }
    if (!prepared.storageConfig.aggregatorUrl) {
      throw createWalrusStepError(
        "walrus_config_missing",
        "Walrus upload is not ready. Check relay configuration and wallet connection.",
        prepared,
        {
          routePath: "wallet:preflight",
          aggregatorUrlConfigured: false,
          recommendation: "Set WALRUS_AGGREGATOR_URL, then retry Step 06.",
        },
      );
    }
    if (prepared.storageConfig.relayStatus && prepared.storageConfig.relayStatus.reachable === false) {
      throw createWalrusStepError(
        "relay_unavailable",
        prepared.storageConfig.relayStatus.error ?? "Walrus Mainnet upload relay is unavailable.",
        prepared,
        {
          routePath: "/api/agent/prepare",
          relayHost: safeUrlHost(prepared.storageConfig.relayUrl),
          statusCode: prepared.storageConfig.relayStatus.statusCode,
          contentType: prepared.storageConfig.relayStatus.contentType,
          responseSnippet: prepared.storageConfig.relayStatus.responseSnippet,
          errorCode: "relay_unavailable",
          sanitizedMessage: prepared.storageConfig.relayStatus.error,
          recommendation: "Check the Walrus upload relay status, then retry Step 06.",
        },
      );
    }
  }

  async function uploadTraceBundle(
    prepared: NonNullable<PrepareSessionPayload["data"]>,
    activeStatus: Extract<ExecutionStatus, "running" | "rerunning">,
  ) {
    validateStorageConfig(prepared);
    activateStep("uploading", activeStatus);
    let storage: StorageReference;
    try {
      storage = await storeTraceBundleWithWallet({
        traceBundle: prepared.traceBundle,
        ownerAddress: walletAccount?.address ?? "",
        storageEpochs: prepared.storageConfig.storageEpochs,
        storageMode: prepared.storageConfig.storageMode,
        network: configuredNetwork.network,
        relayUrl: prepared.storageConfig.relayUrl,
        aggregatorUrl: prepared.storageConfig.aggregatorUrl,
        tipConfig: prepared.storageConfig.relayStatus?.tipConfig,
        signAndExecuteTransaction: ({ transaction }) =>
          dAppKit.signAndExecuteTransaction({ transaction: transaction as never }) as Promise<never>,
        onProgress: (step, message) => handleWalletUploadProgress(step, message),
      });
    } catch (uploadError) {
      const code = classifyWalrusUploadError(uploadError);
      const relayDetails = relayFailureDetails(uploadError);
      throw createWalrusStepError(
        code,
        shortErrorMessage(uploadError) || "Walrus storage request failed.",
        prepared,
        {
          actionName: errorActionName(uploadError) ?? "Walrus SDK Upload Relay",
          routePath: relayDetails.routePath ?? "wallet:walrus-sdk-relay",
          endpoint: prepared.storageConfig.relayUrl,
          relayHost: relayDetails.relayHost ?? safeUrlHost(prepared.storageConfig.relayUrl),
          statusCode: errorStatusCode(uploadError),
          contentType: errorContentType(uploadError),
          responseSnippet: errorResponseSnippet(uploadError),
          errorCode: errorCode(uploadError) ?? code,
          shortMessage: shortErrorMessage(uploadError),
          sanitizedMessage: shortErrorMessage(uploadError),
          failurePhase: relayDetails.phase,
          walletApprovalRequested: relayDetails.walletApprovalRequested,
          walletApprovalStage: relayDetails.walletApprovalStage,
          uploadJobIdReturned: relayDetails.uploadJobIdReturned,
          blobIdReturned: relayDetails.blobIdReturned,
          storageEpochsValid: relayDetails.storageEpochsValid,
          relayUrlConfigured: relayDetails.relayUrlConfigured,
          aggregatorUrlConfigured: relayDetails.aggregatorUrlConfigured,
          balancePreflight: getBalancePreflightResult(uploadError),
          recommendation: relayDetails.recommendation ?? recommendationForWalrusError(code),
          blobIdRecorded: false,
        },
      );
    }
    if (!storage.uploadJobId || !storage.blobId) {
      throw createWalrusStepError(
        "blob_id_missing",
        !storage.uploadJobId
          ? "Walrus relay did not return a valid upload job."
          : "Walrus relay did not return a valid blob reference.",
        prepared,
        {
          routePath: "wallet:walrus-sdk-relay",
          relayHost: safeUrlHost(prepared.storageConfig.relayUrl),
          errorCode: "blob_id_missing",
          failurePhase: !storage.uploadJobId ? "upload_job_reference" : "blob_reference",
          uploadJobIdReturned: Boolean(storage.uploadJobId),
          blobIdReturned: Boolean(storage.blobId),
          recommendation: "Retry Step 06; the relay did not return complete storage references.",
          blobIdRecorded: false,
        },
      );
    }
    completeSteps(["uploading", "reading_back"]);
    setArtifacts((current) => ({ ...current, prepared, storage }));
    return storage;
  }

  async function finalizeStoredTrace(
    prepared: NonNullable<PrepareSessionPayload["data"]>,
    storage: StorageReference,
    activeStatus: Extract<ExecutionStatus, "running" | "rerunning">,
  ) {
    activateStep("verifying", activeStatus);
    const endpoint = `POST /api/sessions/${prepared.session.id}/storage-finalize`;
    const finalizeResponse = await fetch(`/api/sessions/${prepared.session.id}/storage-finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerWallet: walletAccount?.address,
        uploadJobId: storage.uploadJobId,
        blobId: storage.blobId,
        blobObjectId: storage.blobObjectId,
        storageEpochs: storage.storageEpochs,
        storageMode,
        storageEndEpoch: storage.storageEndEpoch,
        relayUrl: storage.relayUrl,
        aggregatorUrl: storage.aggregatorUrl,
        feeEstimate: storage.feeEstimate,
        tipConfig: storage.tipConfig,
        warning: storage.warning,
      }),
    });
    const finalized = await readJsonResponse<FinalizeStoragePayload>(finalizeResponse, endpoint);
    if (!finalizeResponse.ok || !finalized.data?.session) {
      throw new Error(buildApiErrorMessage(finalized, "Walrus storage could not be finalized."));
    }
    completeStep("verifying");
    activateStep("saving", activeStatus);
    setArtifacts((current) => ({ ...current, prepared, storage, finalizedSession: finalized.data?.session }));
    completeStep("saving");
    return finalized.data.session;
  }

  function handleEvidenceFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []).map((file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    }));
    if (selected.length > 0) {
      setFiles((current) => [...current, ...selected]);
    }
    event.target.value = "";
    setEvidenceMenuOpen(false);
  }

  function addTextEvidence(kind: "link" | "note") {
    const value = window.prompt(kind === "link" ? "Paste a link or reference" : "Add a short note");
    const trimmed = value?.trim();
    if (!trimmed) return;
    setFiles((current) => [
      ...current,
      {
        name: trimmed.length > 72 ? `${trimmed.slice(0, 72)}...` : trimmed,
        type: kind === "link" ? "text/uri-list" : "text/plain",
        size: trimmed.length,
      },
    ]);
    setEvidenceMenuOpen(false);
  }

  function pushAnchorMessage(message: string, tone: "pending" | "success" | "error" = "pending") {
    setAnchorMessages((current) => [
      ...current,
      { id: `${Date.now()}-${current.length}`, message, tone },
    ]);
  }

  async function executeFromStep(
    startStep: ExecutionStepId,
    seedArtifacts: ExecutionArtifacts,
    mode: "run" | "rerun",
  ) {
    let currentStep = startStep;
    const activeStatus: Extract<ExecutionStatus, "running" | "rerunning"> = mode === "rerun" ? "rerunning" : "running";
    let nextArtifacts = { ...seedArtifacts };
    try {
      if (getStepIndex(startStep) <= getStepIndex("planning")) {
        currentStep = "planning";
        const prepared = await prepareAgentSession(activeStatus);
        nextArtifacts = { ...nextArtifacts, prepared };
      } else {
        nextArtifacts.prepared = assertPreparedArtifact(nextArtifacts);
      }

      if (getStepIndex(startStep) <= getStepIndex("uploading")) {
        currentStep = "uploading";
        const prepared = assertPreparedArtifact(nextArtifacts);
        const storage = await uploadTraceBundle(prepared, activeStatus);
        nextArtifacts = { ...nextArtifacts, storage };
      } else {
        nextArtifacts.storage = assertStorageArtifact(nextArtifacts);
      }

      if (startStep === "reading_back") {
        currentStep = "reading_back";
        activateStep("reading_back", activeStatus);
        completeStep("reading_back");
      }

      if (getStepIndex(startStep) <= getStepIndex("verifying")) {
        currentStep = "verifying";
        const prepared = assertPreparedArtifact(nextArtifacts);
        const storage = assertStorageArtifact(nextArtifacts);
        const finalizedSession = await finalizeStoredTrace(prepared, storage, activeStatus);
        nextArtifacts = { ...nextArtifacts, finalizedSession };
      } else if (startStep === "saving") {
        currentStep = "saving";
        activateStep("saving", activeStatus);
        if (!nextArtifacts.finalizedSession) {
          throw new Error("The finalized session artifact is not available.");
        }
        completeStep("saving");
      }

      setError(null);
      setArtifacts(nextArtifacts);
    } catch (requestError) {
      markExecutionFailure(currentStep);
      const diagnosticError =
        currentStep === "uploading" && !(requestError instanceof WalrusUploadError)
          ? createWalrusStepError(
              classifyWalrusUploadError(requestError),
              shortErrorMessage(requestError) || "Walrus storage request failed.",
              nextArtifacts.prepared,
              {
                actionName: errorActionName(requestError) ?? "Walrus SDK Upload Relay",
                statusCode: errorStatusCode(requestError),
                contentType: errorContentType(requestError),
                responseSnippet: errorResponseSnippet(requestError),
                errorCode: errorCode(requestError),
                shortMessage: shortErrorMessage(requestError),
                balancePreflight: getBalancePreflightResult(requestError),
                blobIdRecorded: Boolean(nextArtifacts.storage?.blobId),
              },
            )
          : requestError;
      setError(normalizeUserFacingError(diagnosticError));
    } finally {
      setSubmitting(false);
      setRerunning(false);
    }
  }

  async function runSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateWalletReady()) return;
    setError(null);
    setArtifacts({});
    setSubmittedPrompt(prompt.trim());
    setAnchorMessages([]);
    setEvidenceMenuOpen(false);
    setAgentMenuOpen(false);
    setExecutionProgress(initialExecutionProgress());
    setSubmitting(true);
    setRerunning(false);
    window.requestAnimationFrame(() => {
      executionWorkspaceRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    await executeFromStep("reading", {}, "run");
  }

  async function rerunFromFailedStep() {
    if (!failedExecutionStep || submitting || rerunning) return;
    if (failedExecutionStep.id !== "uploading" && !validateWalletReady()) return;
    setRerunning(true);
    await executeFromStep(failedExecutionStep.id as ExecutionStepId, artifacts, "rerun");
  }

  async function copyProofLink(sessionId: string) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    await navigator.clipboard?.writeText(`${origin}/verify/${sessionId}`);
  }

  const selectedAgent = AGENT_OPTIONS.find((option) => option.mode === agentMode) ?? AGENT_OPTIONS[1];
  const finalizedSession = artifacts.finalizedSession;
  const finalizedReport = finalizedSession?.trace.structuredOutput;
  const hasExecutionStarted =
    executionProgress.some((step) => step.status !== "pending") || Boolean(error) || Boolean(finalizedSession);
  const hasConversation = hasExecutionStarted || Boolean(submittedPrompt);
  const conversationPrompt = submittedPrompt || prompt.trim();
  const proofAnchored =
    finalizedSession?.proof.status === "verified" ||
    finalizedSession?.proof.status === "anchored" ||
    finalizedSession?.proof.status === "anchored_pending_object";
  const reportFindings = finalizedReport?.findings.slice(0, 4) ?? [];
  const reportLimitations = finalizedReport?.limitations.slice(0, 3) ?? [];
  const reportNextActions = finalizedReport?.recommendedNextActions.slice(0, 3) ?? [];
  const proofDetailRows = finalizedSession
    ? [
        ["Input hash", finalizedSession.trace.inputHash],
        ["Result hash", finalizedSession.trace.resultHash],
        ["Trace hash", finalizedSession.trace.traceHash],
        ["Walrus blob", finalizedSession.storage.blobId],
        ["Walrus object", finalizedSession.storage.blobObjectId],
        ["Sui transaction", finalizedSession.proof.transactionDigest],
        ["Sui proof object", finalizedSession.proof.suiObjectId],
      ].filter(([, value]) => Boolean(value))
    : [];

  return (
    <form onSubmit={runSession} className="relative min-h-[calc(100dvh-9rem)] pb-60 sm:pb-64">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleEvidenceFileSelection}
      />

      <div className="mx-auto max-w-[68rem]">
        {(activeRerunPrefill || rerunLoadError || rerunLoading) && (
          <div
            className={`mb-6 overflow-hidden rounded-2xl border p-4 ${
              activeRerunPrefill
                ? "border-cyan/15 bg-cyan/[0.035]"
                : "border-amber-200/15 bg-amber-300/[0.055]"
            }`}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  {activeRerunPrefill
                    ? "Re-running previous session"
                    : rerunLoading
                      ? "Loading re-run"
                      : "Re-run unavailable"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">
                  {activeRerunPrefill
                    ? `This workspace was prefilled from session ${activeRerunPrefill.sourceSessionId}.`
                    : rerunLoading
                      ? "Checking the connected wallet before loading the previous session."
                      : rerunLoadError}
                </p>
                {activeRerunPrefill && rerunFileNames.length > 0 && (
                  <p className="mt-2 text-xs leading-5 text-amber-100/80 [overflow-wrap:anywhere]">
                    Reattach files if needed. Previous evidence metadata: {rerunFileNames.slice(0, 3).join(", ")}
                    {rerunFileNames.length > 3 ? `, +${rerunFileNames.length - 3} more` : ""}.
                  </p>
                )}
              </div>
              {activeRerunPrefill && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button type="button" className="button-secondary w-full sm:w-auto" onClick={clearRerunPrefill}>
                    Clear prefill
                  </button>
                  <Link href={`/sessions/${activeRerunPrefill.sourceSessionId}`} className="button-secondary w-full sm:w-auto">
                    View original
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {!hasConversation ? (
          <section className="flex min-h-[calc(100dvh-25rem)] flex-col items-center justify-center py-14 text-center">
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
              Agent BlackBox
            </p>
            <h1 className="mt-5 text-4xl font-light tracking-tight text-white sm:text-5xl">
              What do you want to prove?
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
              Run an AI task and create a verifiable proof trail on Walrus and Sui.
            </p>
          </section>
        ) : (
          <section className="space-y-8 pt-3">
            <div className="flex justify-end">
              <div className="max-w-[44rem] rounded-[1.35rem] rounded-br-md border border-white/[0.08] bg-white/[0.055] px-4 py-3 text-sm leading-6 text-zinc-100 shadow-[0_24px_90px_-70px_rgba(0,0,0,0.9)] [overflow-wrap:anywhere]">
                {conversationPrompt}
              </div>
            </div>

            {hasExecutionStarted && (
              <div ref={executionWorkspaceRef} className="flex scroll-mt-24 gap-3">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan/15 bg-cyan/[0.045] text-cyan">
                  <iconify-icon icon="solar:shield-check-line-duotone" className="text-base" />
                </span>
                <div className="min-w-0 flex-1">
                  <AgentExecutionWorkspace
                    agentMode={agentMode}
                    error={error}
                    onRerunFromFailedStep={failedExecutionStep || rerunning ? rerunFromFailedStep : undefined}
                    rerunning={rerunning}
                    running={submitting || rerunning}
                    steps={executionProgress}
                  />
                </div>
              </div>
            )}

            {finalizedSession && (
              <div className="flex gap-3">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan/15 bg-cyan/[0.045] text-cyan">
                  <iconify-icon icon="solar:stars-line-duotone" className="text-base" />
                </span>
                <div className="min-w-0 flex-1 space-y-5">
                  <article className="max-w-[50rem] text-sm leading-7 text-zinc-300">
                    <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan">
                      Final answer
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white [overflow-wrap:anywhere]">
                      {finalizedReport ? finalizedReport.taskTitle : finalizedSession.title}
                    </h2>
                    <p className="mt-3 text-zinc-400 [overflow-wrap:anywhere]">
                      {finalizedReport?.executiveSummary ?? finalizedSession.trace.finalOutput}
                    </p>
                    <div className="mt-5 whitespace-pre-wrap text-zinc-200 [overflow-wrap:anywhere]">
                      {finalizedReport?.finalOutput ?? finalizedSession.trace.finalOutput}
                    </div>

                    {reportFindings.length > 0 && (
                      <div className="mt-5">
                        <p className="font-semibold text-white">Key findings</p>
                        <ul className="mt-2 space-y-2">
                          {reportFindings.map((finding) => (
                            <li key={`${finding.title}-${finding.evidence}`} className="text-zinc-400">
                              <span className="font-medium text-zinc-100">{finding.title}:</span>{" "}
                              {finding.detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(reportLimitations.length > 0 || reportNextActions.length > 0) && (
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        {reportLimitations.length > 0 && (
                          <div>
                            <p className="font-semibold text-white">Limitations</p>
                            <ul className="mt-2 space-y-1 text-zinc-500">
                              {reportLimitations.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {reportNextActions.length > 0 && (
                          <div>
                            <p className="font-semibold text-white">Next steps</p>
                            <ul className="mt-2 space-y-1 text-zinc-500">
                              {reportNextActions.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="mt-5 text-xs leading-5 text-cyan/80">
                      Proof trace has been sealed and stored on Walrus.
                    </p>
                  </article>

                  {anchorMessages.length > 0 && (
                    <div className="space-y-2">
                      {anchorMessages.map((item) => (
                        <div className="flex items-center gap-2 text-sm text-zinc-400" key={item.id}>
                          <span
                            className={
                              item.tone === "success"
                                ? "text-emerald-200"
                                : item.tone === "error"
                                  ? "text-amber-200"
                                  : "text-amber-200"
                            }
                          >
                            <iconify-icon
                              icon={
                                item.tone === "success"
                                  ? "solar:check-circle-bold-duotone"
                                  : item.tone === "error"
                                    ? "solar:danger-triangle-bold-duotone"
                                    : "solar:spinner-linear"
                              }
                              className={item.tone === "pending" ? "animate-spin" : ""}
                            />
                          </span>
                          {item.message}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="max-w-[48rem] rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-white">
                          {proofAnchored ? "Proof anchored" : "Proof ready"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">
                          {proofAnchored
                            ? "Your proof metadata was anchored on Sui and can be verified later."
                            : "Your agent trace is sealed and stored on Walrus. Anchor it on Sui to create an onchain proof reference."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            "Trace sealed",
                            finalizedSession.verification.directWalrusReadPassed ? "Walrus readback passed" : "Stored on Walrus",
                            finalizedSession.verification.hashMatched ? "Hash matched" : "Hash pending",
                            proofAnchored ? "Anchored on Sui" : "Ready for Sui anchor",
                          ].map((item) => (
                            <span
                              className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[0.68rem] text-zinc-400"
                              key={item}
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-48">
                        {proofAnchored ? (
                          <>
                            <Link className="button-primary justify-center" href={`/verify/${finalizedSession.id}`}>
                              Open Verification Page
                            </Link>
                            <button className="button-secondary justify-center" onClick={() => copyProofLink(finalizedSession.id)} type="button">
                              Copy Proof Link
                            </button>
                            <button className="button-secondary justify-center" onClick={() => exportSessionReport(finalizedSession)} type="button">
                              Export Report
                            </button>
                          </>
                        ) : (
                          <>
                            <AnchorProofPanel
                              session={finalizedSession}
                              variant="compact"
                              onStatusMessage={pushAnchorMessage}
                              onSessionUpdate={(updatedSession) =>
                                setArtifacts((current) => ({ ...current, finalizedSession: updatedSession }))
                              }
                            />
                            <Link className="button-secondary justify-center" href={`/verify/${finalizedSession.id}`}>
                              Open Verification Page
                            </Link>
                          </>
                        )}
                      </div>
                    </div>

                    <details className="group mt-4 border-t border-white/[0.07] pt-3">
                      <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.14em] text-cyan transition hover:text-white [&::-webkit-details-marker]:hidden">
                        View proof details
                      </summary>
                      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        {proofDetailRows.map(([label, value]) => (
                          <div className="min-w-0 rounded-xl border border-white/[0.06] bg-black/20 p-3" key={label}>
                            <dt className="text-zinc-600">{label}</dt>
                            <dd className="mt-1 break-all font-mono text-zinc-300">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link className="button-secondary" href={`/sessions/${finalizedSession.id}`}>
                          Open full session
                        </Link>
                        <button className="button-secondary" onClick={() => exportSessionReport(finalizedSession)} type="button">
                          Export Report
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-[#050507] via-[#050507]/95 to-transparent px-4 pb-4 pt-10 lg:left-[240px]">
        <div className="pointer-events-auto mx-auto max-w-[68rem]">
          {files.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {files.map((file, index) => (
                <span
                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-cyan/15 bg-cyan/[0.05] px-3 py-1.5 text-xs text-cyan backdrop-blur"
                  key={`${file.name}-${index}`}
                >
                  <span className="max-w-[14rem] truncate">{file.name}</span>
                  <button
                    aria-label={`Remove ${file.name}`}
                    className="text-cyan/70 transition hover:text-white"
                    onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    type="button"
                  >
                    <iconify-icon icon="solar:close-circle-line-duotone" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative rounded-[1.65rem] border border-white/10 bg-[#0b0a0d]/95 p-3 shadow-[0_30px_120px_-70px_rgba(0,0,0,0.95)] backdrop-blur-xl">
            <textarea
              required
              rows={2}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="What do you want to prove?"
              className="max-h-40 min-h-16 w-full resize-none rounded-[1.25rem] border border-transparent bg-transparent px-3 py-3 text-sm leading-6 text-white placeholder:text-zinc-600 outline-none transition focus:border-white/[0.08] sm:px-4"
            />

            <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div className="relative">
                  <button
                    aria-expanded={evidenceMenuOpen}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-zinc-300 transition hover:border-cyan/25 hover:bg-cyan/[0.065] hover:text-cyan"
                    onClick={() => {
                      setEvidenceMenuOpen((open) => !open);
                      setAgentMenuOpen(false);
                    }}
                    type="button"
                  >
                    <span className="text-xl leading-none">+</span>
                  </button>
                  {evidenceMenuOpen && (
                    <div className="absolute bottom-[calc(100%+0.75rem)] left-0 w-[18rem] rounded-2xl border border-white/[0.09] bg-[#0c0b10]/98 p-2 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.95)] backdrop-blur-xl">
                      {[
                        ["Add files or photos", () => fileInputRef.current?.click()],
                        ["Add screenshot", () => fileInputRef.current?.click()],
                        ["Add link/reference", () => addTextEvidence("link")],
                        ["Add notes", () => addTextEvidence("note")],
                      ].map(([label, action]) => (
                        <button
                          className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-white/[0.055] hover:text-white"
                          key={label as string}
                          onClick={action as () => void}
                          type="button"
                        >
                          {label as string}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    aria-expanded={agentMenuOpen}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 text-xs text-zinc-300 transition hover:border-cyan/25 hover:bg-cyan/[0.065] hover:text-white"
                    onClick={() => {
                      setAgentMenuOpen((open) => !open);
                      setEvidenceMenuOpen(false);
                    }}
                    type="button"
                  >
                    <iconify-icon icon="solar:stars-line-duotone" className="text-base text-cyan" />
                    {selectedAgent.label}
                    <iconify-icon icon="solar:alt-arrow-up-line-duotone" className="text-sm text-zinc-500" />
                  </button>
                  {agentMenuOpen && (
                    <div className="absolute bottom-[calc(100%+0.75rem)] left-0 w-[21rem] rounded-2xl border border-white/[0.09] bg-[#0c0b10]/98 p-2 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.95)] backdrop-blur-xl">
                      {AGENT_OPTIONS.map((option) => (
                        <button
                          className={`block w-full rounded-xl px-3 py-2.5 text-left transition ${
                            option.mode === agentMode
                              ? "bg-cyan/[0.08] text-white"
                              : "text-zinc-300 hover:bg-white/[0.055] hover:text-white"
                          }`}
                          key={option.mode}
                          onClick={() => {
                            setAgentMode(option.mode);
                            setAgentMenuOpen(false);
                          }}
                          type="button"
                        >
                          <span className="block text-sm font-semibold">{option.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-zinc-500">{option.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {walletAccount ? (
                  <span className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 text-xs text-zinc-400">
                    <ProtocolLogo protocol="sui" size="sm" />
                    {shortenSuiAddress(walletAccount.address)}
                  </span>
                ) : (
                  <WalletConnectButton />
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || rerunning || !formReady}
                className="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-zinc-950 transition-all hover:bg-indigo-100 hover:shadow-[0_0_34px_-10px_rgba(255,255,255,0.75)] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-zinc-500 disabled:shadow-none sm:w-auto"
              >
                <iconify-icon
                  icon={submitting || rerunning ? "solar:spinner-linear" : "solar:play-circle-line-duotone"}
                  className={`text-lg transition-transform ${submitting || rerunning ? "animate-spin" : "group-hover:scale-110"}`}
                />
                {submitting || rerunning ? "Running" : "Run"}
              </button>
            </div>

            <details className="group mt-3 border-t border-white/[0.07] pt-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 transition hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
                <iconify-icon icon="solar:alt-arrow-right-line-duotone" className="text-sm transition group-open:rotate-90" />
                Advanced proof settings
                <span className="ml-auto hidden font-normal normal-case tracking-normal text-zinc-600 sm:inline">
                  {configuredNetwork.displayNetwork} / Walrus Mainnet / {formatEpochOption(storageEpochs)}
                </span>
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <span className="mb-2 block text-xs text-zinc-500">Storage duration</span>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500/50"
                    value={storageEpochs}
                    onChange={(event) => setStorageEpochs(Number(event.target.value))}
                  >
                    {getStorageEpochOptions(storageEpochs).map((epochs) => (
                      <option value={epochs} key={epochs}>
                        {formatEpochOption(epochs)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs text-zinc-500">Storage mode</span>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-[#050507] px-3 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500/50"
                    value={storageMode}
                    onChange={(event) => setStorageMode(event.target.value as StorageMode)}
                  >
                    <option value="deletable">Deletable</option>
                    <option value="permanent">Permanent</option>
                  </select>
                </label>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
                  <p className="text-xs text-zinc-500">Network</p>
                  <p className="mt-2 text-sm text-white">{configuredNetwork.displayNetwork}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
                  <p className="text-xs text-zinc-500">Sui anchor</p>
                  <StatusBadge status={proofContractConfigured ? "Ready" : "Needs Setup"} size="sm" />
                </div>
                {!proofContractConfigured && (
                  <p className="sm:col-span-2 lg:col-span-4 rounded-xl border border-amber-200/15 bg-amber-300/[0.055] px-3 py-2 text-xs leading-5 text-amber-50/80">
                    Sui anchoring is disabled until the Mainnet proof package is configured. Walrus proof storage can still run.
                  </p>
                )}
              </div>
            </details>
          </div>
        </div>
      </div>
    </form>
  );
}
