import { createDAppKit } from "@mysten/dapp-kit-core";
import { SuiGrpcClient } from "@mysten/sui/grpc";

import { toDAppKitNetwork, type DAppKitNetwork } from "@/lib/sui-client-helpers";

const GRPC_URLS: Record<DAppKitNetwork, string> = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
};

export { shortenSuiAddress, toDAppKitNetwork } from "@/lib/sui-client-helpers";
export type { DAppKitNetwork } from "@/lib/sui-client-helpers";

export const dAppKit = createDAppKit({
  networks: ["mainnet", "testnet"],
  defaultNetwork: toDAppKitNetwork(process.env.NEXT_PUBLIC_SUI_NETWORK),
  // The Slush web bridge needs the DOM; browser builds still register it normally.
  slushWalletConfig: typeof document === "undefined" ? null : undefined,
  createClient: (network) =>
    new SuiGrpcClient({
      network,
      baseUrl: GRPC_URLS[network],
    }),
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
