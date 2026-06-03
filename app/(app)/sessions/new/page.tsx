import { NewSessionForm } from "@/components/blackbox/NewSessionForm";
import { getSessionById } from "@/lib/session-service";
import type { AgentMode, AgentSession, SessionRerunPrefill, StorageMode } from "@/types/blackbox";

const AGENT_MODES = new Set<AgentMode>(["research", "risk_review", "delivery_proof", "onchain_monitor"]);
const STORAGE_MODES = new Set<StorageMode>(["deletable", "permanent"]);

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const rerunId = firstSearchParam(params.rerun)?.trim();
  let rerunPrefill: SessionRerunPrefill | undefined;
  let rerunError: string | undefined;

  if (rerunId) {
    const sourceSession = await getSessionById(rerunId);
    if (sourceSession) {
      rerunPrefill = buildRerunPrefill(sourceSession);
    } else {
      rerunError = "Could not load previous session for re-run.";
    }
  }

  return <NewSessionForm rerunError={rerunError} rerunPrefill={rerunPrefill} />;
}

