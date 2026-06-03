"use client";

import {
  useCurrentAccount,
  useCurrentNetwork,
  useDAppKit,
  useWalletConnection,
} from "@mysten/dapp-kit-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { PremiumWalletConnectModal } from "@/components/ui/PremiumWalletConnectModal";
import { getNetworkConfig } from "@/lib/network-config";
import { shortenSuiAddress, toDAppKitNetwork } from "@/lib/sui-client-helpers";

interface WalletConnectButtonProps {
  fullWidth?: boolean;
  variant?: "default" | "cta";
}

const MENU_WIDTH = 260;
const MENU_MARGIN = 12;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function WalletConnectButton({
  fullWidth = false,
  variant = "default",
}: WalletConnectButtonProps) {
  const account = useCurrentAccount();
  const currentNetwork = useCurrentNetwork();
  const connection = useWalletConnection();
  const dAppKit = useDAppKit();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: MENU_MARGIN, left: MENU_MARGIN, width: MENU_WIDTH });
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const configuredNetwork = toDAppKitNetwork(process.env.NEXT_PUBLIC_SUI_NETWORK);
  const visibleAccount = mounted ? account : null;
  const visibleNetwork = mounted ? currentNetwork : configuredNetwork;
  const wrongNetwork = Boolean(visibleAccount && visibleNetwork !== configuredNetwork);
  const connecting = mounted && (connection.isConnecting || connection.isReconnecting);

  const baseClasses = `
    group relative inline-flex min-h-11 items-center justify-center gap-2 rounded-full
    backdrop-blur-md transition-all duration-300 focus-visible:outline-none
    focus-visible:ring-2 active:scale-[0.98] overflow-hidden
    ${fullWidth ? "w-full" : "w-auto"}
  `;
  const spacingClasses = variant === "cta" ? "px-8 py-4" : "px-5 py-2.5";
  const disconnectedClasses =
    variant === "cta"
      ? "border border-white/10 bg-white text-sm font-medium text-zinc-900 hover:bg-indigo-100 hover:shadow-[0_0_50px_-5px_rgba(255,255,255,0.6)] focus-visible:ring-indigo-200"
      : "border border-white/10 bg-white/[0.04] text-sm font-medium text-zinc-200 hover:border-indigo-400/40 hover:bg-indigo-400/10 hover:text-white hover:shadow-[0_0_28px_-14px_rgba(99,102,241,0.5)] focus-visible:ring-indigo-400/45";

  function handlePrimaryClick() {
    if (!mounted) return;
    if (wrongNetwork) {
      dAppKit.switchNetwork(configuredNetwork);
      return;
    }
    if (visibleAccount) {
      setMenuOpen((open) => !open);
      return;
    }
    setWalletModalOpen(true);
  }

  function disconnectWallet() {
    dAppKit.disconnectWallet();
    setMenuOpen(false);
  }

  function updateMenuPosition() {
    if (!triggerRef.current || typeof window === "undefined") return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 230;
    const width = Math.min(MENU_WIDTH, window.innerWidth - MENU_MARGIN * 2);
    const preferredLeft = fullWidth ? trigger.left : trigger.right - width;
    const left = Math.min(
      Math.max(preferredLeft, MENU_MARGIN),
      Math.max(MENU_MARGIN, window.innerWidth - width - MENU_MARGIN),
    );
    const preferredTop = fullWidth ? trigger.top - menuHeight - 10 : trigger.bottom + 10;
    const fallbackTop = trigger.top - menuHeight - 10;
    const unclampedTop =
      preferredTop + menuHeight > window.innerHeight - MENU_MARGIN ? fallbackTop : preferredTop;
    const top = Math.min(
      Math.max(unclampedTop, MENU_MARGIN),
      Math.max(MENU_MARGIN, window.innerHeight - menuHeight - MENU_MARGIN),
    );
    setMenuPosition({ top, left, width });
  }

  async function copyAddress() {
    if (!visibleAccount) return;
    await navigator.clipboard.writeText(visibleAccount.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!menuOpen) return;
    updateMenuPosition();
    const frame = window.requestAnimationFrame(updateMenuPosition);
    return () => window.cancelAnimationFrame(frame);
  }, [menuOpen, fullWidth, visibleAccount?.address]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleWindowChange() {
      updateMenuPosition();
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  let button = (
    <button
      type="button"
      onClick={handlePrimaryClick}
      className={`${baseClasses} ${spacingClasses} ${disconnectedClasses}`}
    >
      <iconify-icon
        icon={variant === "cta" ? "solar:arrow-right-up-linear" : "solar:wallet-money-bold-duotone"}
        className="text-base text-indigo-400 transition-transform group-hover:scale-110"
      />
      <span>Connect Wallet</span>
    </button>
  );

  if (connecting) {
    button = (
      <button
        type="button"
        disabled
        className={`${baseClasses} ${spacingClasses} border border-white/10 bg-white/[0.04] text-sm font-medium text-zinc-400`}
      >
        <iconify-icon icon="solar:spinner-linear" className="text-base text-indigo-400 animate-spin" />
        <span>Connecting...</span>
      </button>
    );
  }

  if (wrongNetwork) {
    button = (
      <button
        type="button"
        onClick={handlePrimaryClick}
        className={`${baseClasses} ${spacingClasses} border border-red-500/30 bg-red-500/10 text-sm font-medium text-red-200 hover:border-red-400/50 hover:bg-red-400/20`}
      >
        <iconify-icon icon="solar:danger-triangle-line-duotone" className="text-base text-red-400" />
        <span>Switch to Sui</span>
      </button>
    );
  }

  if (visibleAccount && !wrongNetwork) {
    button = (
      <button
        type="button"
        onClick={handlePrimaryClick}
        aria-expanded={menuOpen}
        ref={triggerRef}
        className={`${baseClasses} ${spacingClasses} border border-indigo-500/30 bg-indigo-500/10 text-sm font-medium text-indigo-100 hover:border-indigo-400/50 hover:bg-indigo-400/20 focus-visible:ring-indigo-400/50`}
      >
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        <iconify-icon icon="solar:wallet-money-line-duotone" className="text-base text-indigo-300" />
        <span className="font-mono text-xs tracking-wide">{shortenSuiAddress(visibleAccount.address)}</span>
      </button>
    );
  }

  return (
    <div className={`relative ${fullWidth ? "w-full" : "inline-flex"}`}>
      {button}
      <PremiumWalletConnectModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
      {mounted && visibleAccount && menuOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            maxWidth: "calc(100vw - 24px)",
            zIndex: 2147483647,
          }}
          className="rounded-2xl border border-white/10 bg-[#09090d]/95 p-3 text-left shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Connected wallet
          </p>
          <p className="mt-2 truncate font-mono text-xs text-zinc-300" title={visibleAccount.address}>
            {shortenSuiAddress(visibleAccount.address)}
          </p>
          <p className="mt-1 text-xs text-indigo-300">{getNetworkConfig(visibleNetwork).displayNetwork}</p>
          <button
            type="button"
            onClick={copyAddress}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-indigo-100"
          >
            <iconify-icon icon="solar:copy-line-duotone" className="text-sm" />
            {copied ? "Address copied" : "Copy address"}
          </button>
          <button
            type="button"
            onClick={disconnectWallet}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200"
          >
            <iconify-icon icon="solar:logout-2-line-duotone" className="text-sm" />
            Disconnect wallet
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
