export type OnchainFamily = "sui" | "evm" | "unknown";

export type OnchainTargetType =
  | "sui_wallet"
  | "sui_transaction"
  | "sui_object"
  | "sui_package"
  | "evm_wallet"
  | "evm_transaction"
  | "evm_contract"
  | "unknown";

export type OnchainConfidence = "low" | "medium" | "high";

export type OnchainSeverity = "info" | "low" | "medium" | "high" | "critical";

export type OnchainDataSourceStatus =
  | "used"
  | "partial"
  | "not_configured"
  | "skipped"
  | "failed";

export type OnchainEnrichmentStatus =
  | "live"
  | "partial"
  | "preliminary"
  | "not_configured"
  | "failed";

export type EvmChainKey =
  | "ethereum"
  | "base"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "bsc"
  | "avalanche"
  | "linea";

export interface EvmChainConfig {
  key: EvmChainKey;
  chainId: number;
  name: string;
  explorerBaseUrl: string;
}

export interface OnchainDetectedTarget {
  family: OnchainFamily;
  chain: string;
  chainId?: number;
  network: string;
  targetType: OnchainTargetType;
  target: string | null;
  confidence: OnchainConfidence;
  assumptions: string[];
  signals: string[];
}

export interface OnchainDataSource {
  name: string;
  status: OnchainDataSourceStatus;
  configured: boolean;
  used: boolean;
  message: string;
}

export interface OnchainFinding {
  title: string;
  detail: string;
  severity: OnchainSeverity;
  evidence: string;
}

export interface OnchainExplorerLink {
  label: string;
  url: string;
}

export interface OnchainMcpToolEvidence {
  provider: "Tatum MCP";
  packageName: "@tatumio/blockchain-mcp";
  toolName: string;
  network?: string;
  target?: string;
  status: "completed" | "failed" | "skipped";
  summary: string;
  startedAt: string;
  completedAt: string;
  inputHash: string;
  outputHash?: string;
  resultUsedInReport: boolean;
  error?: {
    code: string;
    message: string;
    status?: string;
    details?: string;
  };
}

export interface OnchainMcpStatusSnapshot {
  enabled: boolean;
  configured: boolean;
  status: "disabled" | "configured" | "missing_api_key" | "package_unavailable" | "runtime_unavailable";
  provider: "Tatum Blockchain MCP";
  packageName: "@tatumio/blockchain-mcp";
  command: string;
  serverName: string;
  apiKeyPresent: boolean;
  nodeVersion?: string;
  checkedAt: string;
  message: string;
  availableTools?: string[];
  details?: string;
}

export interface MultichainOnchainReport {
  header: {
    agent: "Multichain Onchain Analyzer";
    detectedChain: string;
    targetType: OnchainTargetType;
    target: string | null;
    confidence: OnchainConfidence;
    timestamp: string;
    enrichmentStatus: OnchainEnrichmentStatus;
    dataSourcesUsed: string[];
  };
  detected: OnchainDetectedTarget;
  dataSources: OnchainDataSource[];
  executiveSummary: string;
  targetProfile: string[];
  activityAnalysis: string[];
  riskSignals: OnchainFinding[];
  evidenceStatus: string[];
  limitations: string[];
  recommendedNextActions: string[];
  proofMetadata: {
    proofSystem: string;
    storageLayer: string;
    anchorLayer: string;
    rpcVerification: string;
    notes: string[];
  };
  explorerLinks: OnchainExplorerLink[];
  mcpStatus?: OnchainMcpStatusSnapshot;
  mcpToolCalls?: OnchainMcpToolEvidence[];
}

export interface OnchainAnalyzeRequest {
  title: string;
  prompt: string;
  agentMode?: "onchain-analyzer" | "onchain_monitor" | string;
  network?: string;
  target?: string;
  sessionId?: string;
  evidence?: unknown;
}

export interface OnchainAnalyzeSuccess {
  ok: true;
  report: MultichainOnchainReport;
  detected: OnchainDetectedTarget;
  dataSources: OnchainDataSource[];
}

export interface OnchainAnalyzeFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

export type OnchainAnalyzeResponse = OnchainAnalyzeSuccess | OnchainAnalyzeFailure;
