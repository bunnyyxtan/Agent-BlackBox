import { getNetworkConfig } from "@/lib/network-config";

export type SuiExplorerLinkType = "transaction" | "object" | "address" | "package";

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function isMissingExplorerValue(value: string) {
  return (
    !value.trim() ||
    value.includes("pending") ||
    value.includes("not-") ||
    value === "0x"
  );
}

function getSuiVisionPath(type: SuiExplorerLinkType) {
  switch (type) {
    case "transaction":
      return "txblock";
    case "address":
      return "account";
    case "package":
    case "object":
      return "object";
  }
}

function getGenericPath(type: SuiExplorerLinkType) {
  switch (type) {
    case "transaction":
      return "tx";
    case "address":
      return "address";
    case "package":
    case "object":
      return "object";
  }
}

export function buildSuiExplorerUrl(
  type: SuiExplorerLinkType,
  value?: string | null,
  network?: string | null,
) {
  if (!value || isMissingExplorerValue(value)) return undefined;

  const base = normalizeBaseUrl(getNetworkConfig(network).suiExplorerBaseUrl);
  const path = /suivision\.xyz$/i.test(base) ? getSuiVisionPath(type) : getGenericPath(type);
  return `${base}/${path}/${encodeURIComponent(value)}`;
}
