"use client";

import { useCurrentAccount, useCurrentNetwork, useDAppKit } from "@mysten/dapp-kit-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { AgentExecutionWorkspace } from "@/components/blackbox/AgentExecutionWorkspace";
import { AgentModeSelector } from "@/components/blackbox/AgentModeSelector";
import { FileDropzone } from "@/components/blackbox/FileDropzone";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo, type Protocol } from "@/components/ui/ProtocolLogo";
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
import { storeTraceBundleWithWallet } from "@/lib/walrus-sdk-relay-client";
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
  { id: "reading", label: "Reading intent", detail: "Parsing the task prompt, files, mode, and wallet context." },
  { id: "planning", label: "Building execution plan", detail: "Agent Runtime is shaping the auditable work plan." },
  { id: "tools", label: "Running tool checks", detail: "Recording deterministic tool evidence for the trace timeline." },
  { id: "report", label: "Writing agent report", detail: "Producing the structured answer that will be sealed." },
  { id: "sealing", label: "Sealing trace bundle", detail: "Computing input, result, and trace hashes." },
  {
    id: "uploading",
    label: "Storing on Walrus Mainnet",
    detail:
      "Walrus storage may request two wallet approvals: one to register the blob and one to certify its availability after storage nodes confirm it.",
  },
  { id: "reading_back", label: "Replaying stored blob", detail: "Reading the stored trace through the Walrus aggregator." },
  { id: "verifying", label: "Matching trace hash", detail: "Comparing the stored payload against the sealed trace hash." },
  { id: "saving", label: "Saving verified session", detail: "Persisting the BlackBox session for replay and verification." },
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

interface ExecutionArtifacts {
  prepared?: NonNullable<PrepareSessionPayload["data"]>;
  storage?: StorageReference;
  finalizedSession?: AgentSession;
}

interface NewSessionFormProps {
  rerunError?: string;
  rerunPrefill?: SessionRerunPrefill;
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

function buildApiErrorMessage(payload: { message?: string; details?: string }, fallback: string) {
  return [payload.message ?? fallback, payload.details ? `Technical detail: ${payload.details}` : ""]
    .filter(Boolean)
    .join("\n");
}

function safeTrimmedText(value: unknown, maxLength = 800) {
  if (typeof value !== "string") return undefined;
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength) || undefined;
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
    safeTrimmedText(record?.responseSnippet, 240) ??
    safeTrimmedText(record?.snippet, 240) ??
    safeTrimmedText(record?.body, 240) ??
    safeTrimmedText(response?.body, 240) ??
    safeTrimmedText(response?.data, 240)
  );
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

export function NewSessionForm({ rerunError, rerunPrefill }: NewSessionFormProps = {}) {
  const router = useRouter();
  const walletAccount = useCurrentAccount();
  const walletNetwork = useCurrentNetwork();
  const dAppKit = useDAppKit();
  const [activeRerunPrefill, setActiveRerunPrefill] = useState<SessionRerunPrefill | null>(rerunPrefill ?? null);
  const [title, setTitle] = useState(rerunPrefill?.title ?? "");
  const [prompt, setPrompt] = useState(rerunPrefill?.prompt ?? "");
  const [agentMode, setAgentMode] = useState<AgentMode>(rerunPrefill?.agentMode ?? "research");
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [storageEpochs, setStorageEpochs] = useState(rerunPrefill?.storageEpochs ?? 1);
  const [storageMode, setStorageMode] = useState<StorageMode>(rerunPrefill?.storageMode ?? "deletable");
  const [submitting, setSubmitting] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [artifacts, setArtifacts] = useState<ExecutionArtifacts>({});
  const [executionProgress, setExecutionProgress] = useState(initialExecutionProgress);
  const configuredNetwork = getNetworkConfig();
  const proofContractConfigured = getSuiProofRegistryConfig().configured;
  const completedStepCount = executionProgress.filter((step) => step.status === "done").length;
  const activeExecutionStep = executionProgress.find(
    (step) => step.status === "running" || step.status === "rerunning" || step.status === "error",
  );
  const failedExecutionStep = executionProgress.find((step) => step.status === "error");
  const executionProgressPercent = Math.round((completedStepCount / EXECUTION_STEPS.length) * 100);
  const formReady = title.trim().length > 0 && prompt.trim().length > 0;
  const rerunFileNames = activeRerunPrefill?.inputFiles.map((file) => file.name).filter(Boolean) ?? [];

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

  function handleWalletUploadProgress(message: string) {
    if (/reading blob/i.test(message)) {
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
    return {
      failedStep: "Storing on Walrus Mainnet",
      actionName: "Walrus SDK Upload Relay",
      endpoint: prepared?.storageConfig.relayUrl || undefined,
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
      balancePreflight: "not checked: balance preflight is not exposed by the current wallet SDK path",
      blobIdRecorded: false,
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
        taskTitle: title,
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
      );
    }
    if (!walletSignerAvailable()) {
      throw createWalrusStepError(
        "wallet_signer_unavailable",
        "Wallet signer not available.",
        prepared,
      );
    }
    if (normalizeSuiNetwork(walletNetwork) !== configuredNetwork.network) {
      throw createWalrusStepError(
        "wrong_network",
        "Switch to Sui Mainnet before storing this trace on Walrus.",
        prepared,
      );
    }
    if (!prepared.traceBundle) {
      throw createWalrusStepError(
        "invalid_trace_bundle",
        "The sealed trace bundle is missing.",
        prepared,
        { traceBundleExists: false },
      );
    }
    if (!prepared.traceBundle.inputHash || !prepared.traceBundle.resultHash || !prepared.traceBundle.traceHash) {
      throw createWalrusStepError(
        "invalid_trace_bundle",
        "The sealed trace bundle is missing one or more required hashes.",
        prepared,
      );
    }
    if (!prepared.storageConfig.storageMode || !Number.isFinite(prepared.storageConfig.storageEpochs) || prepared.storageConfig.storageEpochs < 1) {
      throw createWalrusStepError(
        "invalid_storage_policy",
        "Walrus storage duration or storage mode is invalid.",
        prepared,
      );
    }
    const missingConfigKeys = getWalrusMissingConfigKeys(prepared);
    if (missingConfigKeys.length > 0) {
      throw createWalrusStepError(
        "walrus_config_missing",
        "Walrus storage config is missing.",
        prepared,
        { missingConfigKeys, walrusConfigExists: false },
      );
    }
    if (configuredNetwork.network === "sui-mainnet" && prepared.storageConfig.network !== "mainnet") {
      throw createWalrusStepError(
        "wrong_network",
        "Walrus storage is not configured for Mainnet while the app is using Sui Mainnet.",
        prepared,
      );
    }
    if (!prepared.storageConfig.relayUrl) {
      throw createWalrusStepError(
        "walrus_config_missing",
        "Walrus Mainnet upload relay is not configured.",
        prepared,
        { endpoint: "missing relay URL" },
      );
    }
    if (!prepared.storageConfig.aggregatorUrl) {
      throw createWalrusStepError(
        "walrus_config_missing",
        "Walrus Mainnet aggregator is not configured.",
        prepared,
        { endpoint: "missing aggregator URL" },
      );
    }
    if (prepared.storageConfig.relayStatus && prepared.storageConfig.relayStatus.reachable === false) {
      throw createWalrusStepError(
        "relay_unavailable",
        prepared.storageConfig.relayStatus.error ?? "Walrus Mainnet upload relay is unavailable.",
        prepared,
        {
          endpoint: prepared.storageConfig.relayUrl,
          statusCode: prepared.storageConfig.relayStatus.statusCode,
          contentType: prepared.storageConfig.relayStatus.contentType,
          responseSnippet: prepared.storageConfig.relayStatus.responseSnippet,
          errorCode: "relay_unavailable",
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
        onProgress: (_, message) => handleWalletUploadProgress(message),
      });
    } catch (uploadError) {
      const code = classifyWalrusUploadError(uploadError);
      throw createWalrusStepError(
        code,
        shortErrorMessage(uploadError) || "Walrus storage request failed.",
        prepared,
        {
          actionName: errorActionName(uploadError) ?? "Walrus SDK Upload Relay",
          endpoint: prepared.storageConfig.relayUrl,
          statusCode: errorStatusCode(uploadError),
          contentType: errorContentType(uploadError),
          responseSnippet: errorResponseSnippet(uploadError),
          errorCode: errorCode(uploadError) ?? code,
          shortMessage: shortErrorMessage(uploadError),
          balancePreflight: getBalancePreflightResult(uploadError),
          blobIdRecorded: false,
        },
      );
    }
    if (!storage.blobId) {
      throw createWalrusStepError(
        "blob_id_missing",
        "Walrus storage failed before a blob ID was recorded.",
        prepared,
        {
          endpoint: prepared.storageConfig.relayUrl,
          errorCode: "blob_id_missing",
          blobIdRecorded: false,
        },
      );
    }
    completeStep("reading_back");
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
        session: prepared.session,
        storage,
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
      if (nextArtifacts.finalizedSession) {
        router.push(`/sessions/${nextArtifacts.finalizedSession.id}`);
        router.refresh();
      }
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
    setExecutionProgress(initialExecutionProgress());
    setSubmitting(true);
    setRerunning(false);
    await executeFromStep("reading", {}, "run");
  }

  async function rerunFromFailedStep() {
    if (!failedExecutionStep || submitting || rerunning) return;
    if (failedExecutionStep.id !== "uploading" && !validateWalletReady()) return;
    setRerunning(true);
    await executeFromStep(failedExecutionStep.id as ExecutionStepId, artifacts, "rerun");
  }

  return (
    <form onSubmit={runSession} className="space-y-8">
      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
        <div className="min-w-0 space-y-6">
          <div>
            <p className="eyebrow">Use Agent</p>
            <h1 className="mt-2 text-3xl font-light tracking-tight text-white sm:text-4xl">
              Use an agent
            </h1>
            <p className="muted mt-2 max-w-3xl text-zinc-500">
              Choose an agent, give it a task, and Agent BlackBox will create the proof trail automatically.
              Analyze Sui wallets, objects, packages, and EVM addresses with a sealed Agent BlackBox trace.
            </p>
          </div>

          {(activeRerunPrefill || rerunError) && (
            <div
              className={`relative overflow-hidden rounded-2xl border p-4 ${
                activeRerunPrefill
                  ? "border-cyan/15 bg-cyan/[0.035]"
                  : "border-amber-200/15 bg-amber-300/[0.055]"
              }`}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                    {activeRerunPrefill ? "Re-running previous session" : "Re-run prefill unavailable"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">
                    {activeRerunPrefill
                      ? `This form was prefilled from session ${activeRerunPrefill.sourceSessionId}. Review or edit before running.`
                      : rerunError}
                  </p>
                  {activeRerunPrefill && rerunFileNames.length > 0 && (
                    <p className="mt-2 text-xs leading-5 text-amber-100/80 [overflow-wrap:anywhere]">
                      Original file evidence cannot be automatically reattached. Upload files again if needed.
                      Previously recorded metadata: {rerunFileNames.slice(0, 3).join(", ")}
                      {rerunFileNames.length > 3 ? `, +${rerunFileNames.length - 3} more` : ""}.
                    </p>
                  )}
                </div>
                {activeRerunPrefill && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" className="button-secondary" onClick={clearRerunPrefill}>
                      Clear prefill
                    </button>
                    <Link href={`/sessions/${activeRerunPrefill.sourceSessionId}`} className="button-secondary">
                      View original session
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          <GlassCard className="p-6 sm:p-8">
            <div>
              <p className="mb-2 font-mono text-xs uppercase tracking-widest text-indigo-400">Agent Task</p>
              <h2 className="text-xl font-medium tracking-tight text-white">Agent parameters</h2>
              <p className="mt-2 text-sm font-light text-zinc-400">
                Capture the intent and evidence context before the session is sealed.
              </p>
            </div>
            <div className="mt-8 space-y-6">
              <label className="block">
                <span className="mb-3 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Task title
                </span>
                <input
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Review autonomous settlement exception"
                  className="w-full rounded-xl border border-white/10 bg-[#050507] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                />
              </label>
              <label className="block">
                <span className="mb-3 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Agent instruction / task prompt
                </span>
                <textarea
                  required
                  rows={4}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Record the decision path, inspect the attached evidence metadata, and generate an auditable operator summary."
                  className="w-full resize-y rounded-xl border border-white/10 bg-[#050507] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                />
              </label>
              <div>
                <span className="mb-3 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Agent mode
                </span>
                <AgentModeSelector value={agentMode} onChange={setAgentMode} />
              </div>
              <div>
                <span className="mb-3 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Optional file evidence
                </span>
                <FileDropzone files={files} onChange={setFiles} />
              </div>
            </div>
          </GlassCard>

          <div className="relative overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#08080d]/85 p-4 shadow-[0_24px_80px_-55px_rgba(99,102,241,0.7)] sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
            <div>
              <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Trace capture
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {formReady
                  ? "Run Agent will record the execution path, seal evidence, and start the Walrus Mainnet storage flow."
                  : "Complete the task title and instruction to enable trace capture."}
              </p>
            </div>
            <button
              type="submit"
              disabled={submitting || rerunning || !formReady}
              className="group mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-semibold text-zinc-950 transition-all hover:bg-indigo-100 hover:shadow-[0_0_34px_-10px_rgba(255,255,255,0.75)] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-zinc-500 disabled:shadow-none sm:mt-0 sm:w-auto sm:min-w-44"
            >
              <iconify-icon
                icon={submitting ? "solar:spinner-linear" : "solar:play-circle-line-duotone"}
                className={`text-lg transition-transform ${submitting ? "animate-spin" : "group-hover:scale-110"}`}
              />
              Run Agent
            </button>
          </div>
        </div>

        <aside className="space-y-6">
          <GlassCard className="p-6">
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-indigo-400">Storage Policy</p>
            <p className="mb-4 text-xs leading-5 text-zinc-400">
              Your wallet will pay a small Walrus storage + Sui gas fee. Keep a small SUI/WAL balance
              available for storage and gas.
            </p>
            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-medium tracking-wide text-zinc-400">Storage duration</span>
                <select
                  className="w-full rounded-xl border border-white/10 bg-[#050507] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500/50"
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
                <span className="mb-2 block text-xs font-medium tracking-wide text-zinc-400">Storage mode</span>
                <select
                  className="w-full rounded-xl border border-white/10 bg-[#050507] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500/50"
                  value={storageMode}
                  onChange={(event) => setStorageMode(event.target.value as StorageMode)}
                >
                  <option value="deletable">Deletable</option>
                  <option value="permanent">Permanent</option>
                </select>
              </label>
            </div>
          </GlassCard>

          <GlassCard className="group relative overflow-hidden border-indigo-500/20 bg-gradient-to-b from-indigo-500/5 to-transparent p-6">
            <div className="pointer-events-none absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03]" />

            <div className="relative mb-5 flex items-center gap-2 text-indigo-400">
              <iconify-icon icon="solar:shield-check-bold-duotone" className="text-lg" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">BlackBox Preview</p>
            </div>

            <div className="relative rounded-2xl border border-white/[0.08] bg-black/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">
                    {activeExecutionStep?.label ?? (completedStepCount === EXECUTION_STEPS.length ? "Trace sealed" : "Trace ready")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {activeExecutionStep?.status === "error"
                      ? "Execution is paused at the highlighted step."
                      : "The forensic timeline updates in the execution workspace below."}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-2.5 py-1 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-cyan-100">
                  {completedStepCount}/{EXECUTION_STEPS.length}
                </span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-300 transition-all duration-500"
                  style={{ width: `${executionProgressPercent}%` }}
                />
              </div>
            </div>

            <div className="relative mt-4 grid gap-2">
              {[
                { label: "Trace bundle", value: executionProgress.some((step) => step.id === "sealing" && step.status === "done") ? "Sealed" : "Pending" },
                { label: "Walrus Mainnet", value: executionProgress.some((step) => step.id === "uploading" && step.status === "error") ? "Action Needed" : "Ready", protocol: "walrus" as Protocol },
                { label: "Sui proof", value: proofContractConfigured ? "Configured" : "Contract Pending", protocol: "sui" as Protocol },
              ].map(({ label, protocol, value }) => (
                <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2" key={label}>
                  <span className="inline-flex min-w-0 items-center gap-2 text-xs text-zinc-400">
                    {protocol && <ProtocolLogo protocol={protocol} size="sm" />}
                    {label}
                  </span>
                  <StatusBadge status={value} size="sm" />
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-start gap-3 border-t border-white/[0.08] pt-4">
              <iconify-icon icon="solar:lock-keyhole-bold-duotone" className="mt-0.5 shrink-0 text-lg text-amber-200/80" />
              <p className="text-[0.7rem] leading-relaxed text-zinc-400">
                Walrus blobs are public by default. Encrypt sensitive traces before production upload.
              </p>
            </div>
          </GlassCard>

          <div
            id="agent-wallet-requirement"
            className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4"
          >
            {walletAccount ? (
              <div className="flex items-center gap-3">
                <ProtocolLogo protocol="sui" size="md" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white">Session owner connected</p>
                  <p className="mt-1 truncate font-mono text-[0.68rem] text-zinc-400">
                    {shortenSuiAddress(walletAccount.address)} / {getNetworkConfig(walletNetwork).displayNetwork}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-3 text-xs leading-relaxed text-zinc-300">
                  Connect wallet to store trace on Walrus Mainnet.
                </p>
                <WalletConnectButton fullWidth />
              </div>
            )}
          </div>

          {!proofContractConfigured && (
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/15 bg-amber-300/[0.055] p-4">
              <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-amber-200/60 to-transparent" />
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-200/15 bg-amber-200/[0.08] text-amber-200">
                  <iconify-icon icon="solar:shield-warning-line-duotone" className="text-lg" />
                </span>
                <p className="text-xs leading-5 text-amber-50/80">
                  Proof contract not configured. Walrus storage can be created first; Sui proof
                  anchoring stays disabled until the Mainnet package ID is set.
                </p>
              </div>
            </div>
          )}
        </aside>
      </section>

      <AgentExecutionWorkspace
        agentMode={agentMode}
        error={error}
        onRerunFromFailedStep={failedExecutionStep || rerunning ? rerunFromFailedStep : undefined}
        proofConfigured={proofContractConfigured}
        rerunning={rerunning}
        running={submitting || rerunning}
        steps={executionProgress}
        storageMode={storageMode}
        taskTitle={title}
        walletAddress={walletAccount?.address}
      />
    </form>
  );
}
