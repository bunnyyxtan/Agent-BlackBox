"use client";

import { useDAppKit, useWalletConnection, useWallets } from "@mysten/dapp-kit-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { UserFacingErrorAlert } from "@/components/ui/UserFacingErrorAlert";
import { normalizeUserFacingError, type UserFacingError } from "@/lib/errors/user-facing-errors";

type Wallet = ReturnType<typeof useWallets>[number];

interface PremiumWalletConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function walletKey(wallet: Wallet) {
  return `${wallet.name}:${wallet.icon}`;
}

export function PremiumWalletConnectModal({ open, onOpenChange }: PremiumWalletConnectModalProps) {
  const wallets = useWallets();
  const dAppKit = useDAppKit();
  const connection = useWalletConnection();
  const [mounted, setMounted] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState("");
  const [connectedWallet, setConnectedWallet] = useState("");
  const [error, setError] = useState<UserFacingError | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setConnectingWallet("");
      setConnectedWallet("");
      setError(null);
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open || !connection.isConnected || !connection.wallet) return;
    setConnectedWallet(connection.wallet.name);
    const timeout = window.setTimeout(() => onOpenChange(false), 420);
    return () => window.clearTimeout(timeout);
  }, [connection.isConnected, connection.wallet, onOpenChange, open]);

  async function connectWallet(wallet: Wallet) {
    if (connectingWallet) return;
    setError(null);
    setConnectedWallet("");
    setConnectingWallet(wallet.name);
    try {
      await dAppKit.connectWallet({ wallet });
      setConnectedWallet(wallet.name);
      window.setTimeout(() => onOpenChange(false), 420);
    } catch (connectError) {
      setError(normalizeUserFacingError(connectError));
    } finally {
      setConnectingWallet("");
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483647] grid place-items-center bg-black/70 px-4 py-8 backdrop-blur-xl"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        aria-modal="true"
        role="dialog"
        aria-labelledby="wallet-connect-title"
        className="relative w-full max-w-[27rem] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#07070c]/95 p-[1px] text-left shadow-[0_30px_120px_-55px_rgba(99,102,241,0.65)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.22),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(34,211,238,0.16),transparent_34%)]" />
        <div className="relative rounded-[1.68rem] bg-[#08080d]/95 p-5 backdrop-blur-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-indigo-300">
                Wallet access
              </p>
              <h2 id="wallet-connect-title" className="mt-2 text-xl font-medium tracking-tight text-white">
                Connect to Agent BlackBox
              </h2>
              <p className="mt-2 text-xs leading-5 text-zinc-400">
                Choose a Sui wallet to create verifiable agent traces.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close wallet selector"
              onClick={() => onOpenChange(false)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-indigo-300/30 hover:bg-indigo-400/10 hover:text-white"
            >
              <iconify-icon icon="solar:close-circle-line-duotone" className="text-lg" />
            </button>
          </div>

          <div className="mt-5 space-y-2.5">
            {wallets.length === 0 ? (
              <div className="rounded-2xl border border-amber-200/15 bg-amber-300/[0.045] p-4">
                <p className="text-xs font-semibold text-amber-50">Wallet not available.</p>
                <p className="mt-1 text-xs leading-5 text-amber-50/70">
                  Install or enable a Sui wallet extension, then refresh this page.
                </p>
              </div>
            ) : (
              wallets.map((wallet) => {
                const connecting = connectingWallet === wallet.name;
                const connected = connectedWallet === wallet.name || connection.wallet?.name === wallet.name && connection.isConnected;
                return (
                  <button
                    type="button"
                    onClick={() => connectWallet(wallet)}
                    disabled={Boolean(connectingWallet)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3 text-left transition duration-300 hover:border-indigo-300/35 hover:bg-indigo-500/[0.09] hover:shadow-[0_0_28px_-18px_rgba(99,102,241,0.8)] disabled:cursor-wait disabled:opacity-70"
                    key={walletKey(wallet)}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      {wallet.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={wallet.icon} alt={`${wallet.name} logo`} className="h-7 w-7 rounded-md object-contain" />
                      ) : (
                        <iconify-icon icon="solar:wallet-money-line-duotone" className="text-xl text-indigo-300" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{wallet.name}</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {connected ? "Connected" : connecting ? "Awaiting wallet approval..." : "Connect wallet"}
                      </span>
                    </span>
                    <span className="text-indigo-300">
                      <iconify-icon
                        icon={connected ? "solar:check-circle-bold-duotone" : connecting ? "solar:spinner-linear" : "solar:arrow-right-up-linear"}
                        className={`text-lg ${connecting ? "animate-spin" : ""}`}
                      />
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {error && (
            <div className="mt-4">
              <UserFacingErrorAlert error={error} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
