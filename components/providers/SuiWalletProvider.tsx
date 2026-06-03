"use client";

import { DAppKitProvider } from "@mysten/dapp-kit-react";
import type { PropsWithChildren } from "react";

import { dAppKit } from "@/lib/dapp-kit";

export function SuiWalletProvider({ children }: PropsWithChildren) {
  return <DAppKitProvider dAppKit={dAppKit}>{children}</DAppKitProvider>;
}
