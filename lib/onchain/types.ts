export type OnchainFamily = "sui" | "unknown";

export type OnchainTargetType =
  | "sui_wallet"
  | "sui_transaction"
  | "sui_object"
  | "sui_package"
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

export interface OnchainDetectedTarget {
  family: OnchainFamily;
  chain: string;
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

export interface SuiTokenBalance {
  coinType: string;
  rawTotalBalance: string;
  decimals: number;
  symbol: string;
  name?: string;
  formattedBalance: string;
}

export interface SuiOnchainReport {
  header: {
    agent: "Sui Onchain Analyzer";
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
  tokenBalances?: SuiTokenBalance[];
  balanceLookupStatus?: "completed" | "empty" | "failed" | "skipped";
  balanceLookupMessage?: string;
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
  report: SuiOnchainReport;
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
