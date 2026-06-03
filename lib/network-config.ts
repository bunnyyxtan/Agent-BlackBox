import type { SuiNetwork } from "@/types/blackbox";

const TESTNET_RPC_URL = "https://sui-testnet.gateway.tatum.io";
const MAINNET_RPC_URL = "https://sui-mainnet.gateway.tatum.io";
const TESTNET_EXPLORER_URL = "https://testnet.suivision.xyz";
const MAINNET_EXPLORER_URL = "https://suivision.xyz";

export interface NetworkConfig {
  network: SuiNetwork;
  displayNetwork: string;
  tatumRpcUrl: string;
  suiExplorerBaseUrl: string;
  rpcNetworkMismatch: boolean;
}

export function normalizeSuiNetwork(value?: string | null): SuiNetwork {
  const normalized = value?.trim().toLowerCase();
  return normalized === "testnet" || normalized === "sui-testnet"
    ? "sui-testnet"
    : "sui-mainnet";
}

function inferSuiNetworkFromUrl(value?: string | null): SuiNetwork | null {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("sui-testnet") || normalized.includes("testnet.sui")) return "sui-testnet";
  if (normalized.includes("sui-mainnet") || normalized.includes("mainnet.sui")) return "sui-mainnet";
  return null;
}

export function getNetworkConfig(value?: string | null): NetworkConfig {
  const network = normalizeSuiNetwork(
    value ?? process.env.SUI_NETWORK ?? process.env.NEXT_PUBLIC_SUI_NETWORK,
  );
  const mainnet = network === "sui-mainnet";
  const tatumRpcUrl = process.env.TATUM_SUI_RPC_URL?.trim() || (mainnet ? MAINNET_RPC_URL : TESTNET_RPC_URL);
  const rpcNetwork = inferSuiNetworkFromUrl(tatumRpcUrl);
  return {
    network,
    displayNetwork: mainnet ? "Sui Mainnet" : "Sui Testnet",
    tatumRpcUrl,
    suiExplorerBaseUrl:
      process.env.SUI_EXPLORER_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SUI_EXPLORER_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SUI_EXPLORER_URL?.trim() ||
      (mainnet ? MAINNET_EXPLORER_URL : TESTNET_EXPLORER_URL),
    rpcNetworkMismatch: Boolean(rpcNetwork && rpcNetwork !== network),
  };
}
