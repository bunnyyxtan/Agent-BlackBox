import type { EvmChainConfig, EvmChainKey } from "@/lib/onchain/types";

export const EVM_CHAIN_REGISTRY: Record<EvmChainKey, EvmChainConfig> = {
  ethereum: {
    key: "ethereum",
    chainId: 1,
    name: "Ethereum Mainnet",
    explorerBaseUrl: "https://etherscan.io",
  },
  base: {
    key: "base",
    chainId: 8453,
    name: "Base",
    explorerBaseUrl: "https://basescan.org",
  },
  arbitrum: {
    key: "arbitrum",
    chainId: 42161,
    name: "Arbitrum One",
    explorerBaseUrl: "https://arbiscan.io",
  },
  optimism: {
    key: "optimism",
    chainId: 10,
    name: "Optimism",
    explorerBaseUrl: "https://optimistic.etherscan.io",
  },
  polygon: {
    key: "polygon",
    chainId: 137,
    name: "Polygon",
    explorerBaseUrl: "https://polygonscan.com",
  },
  bsc: {
    key: "bsc",
    chainId: 56,
    name: "BNB Smart Chain",
    explorerBaseUrl: "https://bscscan.com",
  },
  avalanche: {
    key: "avalanche",
    chainId: 43114,
    name: "Avalanche C-Chain",
    explorerBaseUrl: "https://snowtrace.io",
  },
  linea: {
    key: "linea",
    chainId: 59144,
    name: "Linea",
    explorerBaseUrl: "https://lineascan.build",
  },
};

export function getEvmChain(key: EvmChainKey) {
  return EVM_CHAIN_REGISTRY[key];
}
