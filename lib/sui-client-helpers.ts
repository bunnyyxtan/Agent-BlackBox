import { normalizeSuiNetwork } from "@/lib/network-config";

export type DAppKitNetwork = "mainnet" | "testnet";

const SUI_HEX_ID_PATTERN = /^0x[0-9a-fA-F]{1,64}$/;
const SUI_TRANSACTION_DIGEST_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,88}$/;

export function toDAppKitNetwork(value?: string | null): DAppKitNetwork {
  return normalizeSuiNetwork(value) === "sui-mainnet" ? "mainnet" : "testnet";
}

export function shortenSuiAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function normalizeSuiAddressForCompare(address?: string | null) {
  const trimmed = address?.trim();
  if (!trimmed) return "";
  const hex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
  if (!/^[0-9a-fA-F]{1,64}$/.test(hex)) {
    return trimmed.toLowerCase();
  }
  return `0x${hex.toLowerCase().padStart(64, "0")}`;
}

export function normalizeSuiAddress(address: string) {
  return normalizeSuiAddressForCompare(address);
}

export function normalizeSuiObjectId(objectId: string) {
  return normalizeSuiAddressForCompare(objectId);
}

export function isValidSuiAddress(value?: string | null) {
  return isValidSuiObjectId(value);
}

export function isValidSuiObjectId(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return SUI_HEX_ID_PATTERN.test(trimmed);
}

export function isValidTransactionDigest(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "transaction-pending") return false;
  return SUI_TRANSACTION_DIGEST_PATTERN.test(trimmed);
}
