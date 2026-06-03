import type { InputFile } from "@/types/blackbox";

export type TaskQuestionType =
  | "collaboration_claim"
  | "project_research"
  | "wallet_analysis"
  | "risk_review"
  | "delivery_receipt"
  | "proof_verification"
  | "general_research";

export interface TaskContext {
  text: string;
  normalizedText: string;
  urls: string[];
  protocols: string[];
  chains: string[];
  wallets: string[];
  transactionDigests: string[];
  questionType: TaskQuestionType;
  requestedOutputStyle?: string;
  claims: string[];
  files: Array<Pick<InputFile, "name" | "type" | "size">>;
}

const PROTOCOL_PATTERNS: Array<[string, RegExp]> = [
  ["Agent BlackBox", /\bagent\s+blackbox\b/i],
  ["Tatum", /\btatum\b/i],
  ["Walrus", /\bwalrus\b/i],
  ["Sui", /\bsui\b/i],
];

const URL_PATTERN = /\bhttps?:\/\/[^\s)]+/gi;
const SUI_ADDRESS_PATTERN = /\b0x[a-fA-F0-9]{64}\b/g;
const SUI_DIGEST_PATTERN = /\b[1-9A-HJ-NP-Za-km-z]{43,88}\b/g;

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function splitClaims(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const pieces = normalized
    .split(/(?:\?|\.|;|\n|\b(?:and|also|plus)\b)/i)
    .map((item) => item.trim())
    .filter((item) => item.length > 8);
  return uniqueValues(pieces).slice(0, 6);
}

function detectQuestionType(text: string): TaskQuestionType {
  if (/\b(collaboration|collaborat|partner|partnership|officially working|ecosystem work)\b/i.test(text)) {
    return "collaboration_claim";
  }
  if (/\b(risk|threat|exposure|red flag|mitigation|abuse|failure|mistake)\b/i.test(text)) {
    return "risk_review";
  }
  if (/\b(deliver|delivery|receipt|handoff|completed|acceptance|submission|prototype)\b/i.test(text)) {
    return "delivery_receipt";
  }
  if (/\b(verify|proof|anchor|hash|tamper|walrus blob|trace)\b/i.test(text)) {
    return "proof_verification";
  }
  if (/\b(wallet|balance|holdings|token|transaction|object|package)\b/i.test(text)) {
    return "wallet_analysis";
  }
  if (/\b(research|explain|what is|how does|system|architecture|storage)\b/i.test(text)) {
    return "project_research";
  }
  return "general_research";
}

function detectRequestedOutputStyle(text: string) {
  if (/\b(table|matrix)\b/i.test(text)) return "matrix";
  if (/\b(receipt|handoff)\b/i.test(text)) return "receipt";
  if (/\b(checklist)\b/i.test(text)) return "checklist";
  if (/\b(brief|summary|report)\b/i.test(text)) return "brief";
  return undefined;
}

export function extractTaskContext(
  title: string,
  prompt: string,
  files: Array<Pick<InputFile, "name" | "type" | "size">> = [],
): TaskContext {
  const text = `${title}\n${prompt}`;
  const protocols = PROTOCOL_PATTERNS.flatMap(([name, pattern]) => (pattern.test(text) ? [name] : []));
  const chains = uniqueValues([
    ...(/\bsui\b/i.test(text) ? ["Sui"] : []),
    ...(/\bmainnet\b/i.test(text) ? ["mainnet"] : []),
    ...(/\btestnet\b/i.test(text) ? ["testnet"] : []),
  ]);
  return {
    text,
    normalizedText: text.toLowerCase(),
    urls: uniqueValues(text.match(URL_PATTERN) ?? []),
    protocols: uniqueValues(protocols),
    chains,
    wallets: uniqueValues(text.match(SUI_ADDRESS_PATTERN) ?? []),
    transactionDigests: uniqueValues((text.match(SUI_DIGEST_PATTERN) ?? []).filter((item) => !/^0x/i.test(item))),
    questionType: detectQuestionType(text),
    requestedOutputStyle: detectRequestedOutputStyle(text),
    claims: splitClaims(prompt || title),
    files,
  };
}
