"use client";

import { useCurrentAccount } from "@mysten/dapp-kit-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SessionsListClient } from "@/components/blackbox/SessionsListClient";
import { StorageJobCard } from "@/components/blackbox/StorageJobCard";
import { WalrusVerificationPanel } from "@/components/blackbox/WalrusVerificationPanel";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo } from "@/components/ui/ProtocolLogo";
import { StatCard } from "@/components/ui/StatCard";
import { WalletConnectButton } from "@/components/ui/WalletConnectButton";
import { readJsonResponse } from "@/lib/http/safe-json";
import type { SessionListItem } from "@/types/blackbox";

interface SessionStats {
  total: number;
  walrusStored: number;
  suiAnchored: number;
  fullyVerified: number;
}

interface WalletSessionsState {
  loading: boolean;
  error: string;
  message: string;
  sessions: SessionListItem[];
  stats: SessionStats;
  realCount: number;
  sampleFallback: boolean;
  walletRequired: boolean;
}

interface WalletSessionsPayload {
  sessions?: SessionListItem[];
  source?: "supabase" | "local-json" | "demo";
  ownerWallet?: string | null;
  isWalletScoped?: boolean;
  stats?: SessionStats;
  realCount?: number;
  sampleFallback?: boolean;
  walletRequired?: boolean;
  message?: string;
  data?: {
    sessions: SessionListItem[];
    source?: "supabase" | "local-json" | "demo";
    ownerWallet?: string | null;
    isWalletScoped?: boolean;
    stats: SessionStats;
    realCount: number;
    sampleFallback: boolean;
    walletRequired: boolean;
  };
  error?: string | {
    message?: string;
  };
}

const EMPTY_STATS: SessionStats = {
  total: 0,
  walrusStored: 0,
  suiAnchored: 0,
  fullyVerified: 0,
};

const SESSION_LIST_RESPONSE_MAX_BYTES = 6 * 1024 * 1024;

function readPayloadError(error: WalletSessionsPayload["error"]) {
  if (!error) return "";
  return typeof error === "string" ? error : error.message ?? "";
}

function parseWalletSessionsPayload(payload: WalletSessionsPayload) {
  const data = payload.data ?? payload;

  if (!Array.isArray(data.sessions)) {
    console.error("Malformed /api/sessions response: expected a sessions array.", {
      keys: Object.keys(payload ?? {}),
      preview: JSON.stringify(payload).slice(0, 500),
    });
    throw new Error("Wallet sessions response was malformed.");
  }

  return {
    sessions: data.sessions,
    stats: data.stats ?? EMPTY_STATS,
    realCount: data.realCount ?? data.sessions.filter((session) => !session.isSample).length,
    sampleFallback: Boolean(data.sampleFallback),
    walletRequired: Boolean(data.walletRequired),
    message: payload.message ?? "",
    error: readPayloadError(payload.error),
  };
}

function useWalletScopedSessions() {
  const account = useCurrentAccount();
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<WalletSessionsState>({
    loading: true,
    error: "",
    message: "",
    sessions: [],
    stats: EMPTY_STATS,
    realCount: 0,
    sampleFallback: false,
    walletRequired: true,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const controller = new AbortController();
    const ownerWallet = account?.address ?? "";
    const endpoint = ownerWallet
      ? `/api/sessions?ownerWallet=${encodeURIComponent(ownerWallet)}`
      : "/api/sessions";

    setState((current) => ({
      ...current,
      loading: true,
      error: "",
      walletRequired: !ownerWallet,
    }));

    fetch(endpoint, { signal: controller.signal })
      .then((response) =>
        readJsonResponse<WalletSessionsPayload>(response, `GET ${endpoint}`, {
          maxBytes: SESSION_LIST_RESPONSE_MAX_BYTES,
        }),
      )
      .then((payload) => {
        const data = parseWalletSessionsPayload(payload);
        setState({
          loading: false,
          error: data.error ?? "",
          message: data.message,
          sessions: data.sessions,
          stats: data.stats ?? EMPTY_STATS,
          realCount: data.realCount,
          sampleFallback: data.sampleFallback,
          walletRequired: data.walletRequired,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({
          loading: false,
          error: error instanceof Error ? error.message : "Wallet sessions could not be loaded.",
          message: "",
          sessions: [],
          stats: EMPTY_STATS,
          realCount: 0,
          sampleFallback: false,
          walletRequired: !ownerWallet,
        });
      });

    return () => controller.abort();
  }, [account?.address, mounted]);

  return {
    ownerWallet: account?.address ?? "",
    ...state,
  };
}

function WalletScopeNotice({
  error,
  sampleFallback,
  walletRequired,
}: {
  error: string;
  sampleFallback: boolean;
  walletRequired: boolean;
}) {
  if (error) {
    return (
      <GlassCard className="border-rose-300/15 bg-rose-300/[0.035] p-4">
        <p className="text-xs leading-5 text-rose-100/80">{error}</p>
      </GlassCard>
    );
  }

  if (walletRequired) {
    return (
      <GlassCard className="border-indigo-300/15 bg-indigo-300/[0.035] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-400">
            Connect wallet to view your private Agent BlackBox sessions. Sample traces are shown until a wallet is connected.
          </p>
          <WalletConnectButton />
        </div>
      </GlassCard>
    );
  }

  if (sampleFallback) {
    return (
      <p className="rounded-2xl border border-cyan/15 bg-cyan/[0.035] px-4 py-3 text-xs leading-5 text-slate-400">
        Sample traces are shown because this wallet has no recorded sessions yet.
      </p>
    );
  }

  return null;
}

export function DashboardWalletScope() {
  const { error, loading, sampleFallback, sessions, stats, walletRequired } = useWalletScopedSessions();
  const statDetail = walletRequired
    ? "Connect wallet to view"
    : sampleFallback
      ? "Real sessions after first run"
      : "Wallet-scoped records";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Sessions"
          value={loading ? "..." : stats.total}
          detail={statDetail}
          icon="solar:document-text-line-duotone"
        />
        <StatCard
          label="Stored Blobs"
          value={loading ? "..." : stats.walrusStored}
          detail={walletRequired ? "Connect wallet to view" : "Walrus readback matched"}
          icon="solar:database-line-duotone"
          protocol="walrus"
        />
        <StatCard
          label="Sui Anchors"
          value={loading ? "..." : stats.suiAnchored}
          detail={walletRequired ? "Connect wallet to view" : "Onchain proof references"}
          icon="solar:waterdrop-line-duotone"
          protocol="sui"
        />
        <StatCard
          label="Fully Verified"
          value={loading ? "..." : stats.fullyVerified}
          detail={walletRequired ? "Connect wallet to view" : "Walrus and Sui checks passed"}
          icon="solar:verified-check-bold-duotone"
        />
      </div>

      <div className="mt-5 space-y-4 xl:pt-6">
        <div className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-sm font-medium text-white">Recent sessions</h2>
            {walletRequired || sampleFallback || error ? (
              <p className="mt-1 text-xs text-slate-500">
                {walletRequired
                  ? "Wallet-scoped privacy is active. Real sessions load after wallet connection."
                  : sampleFallback
                    ? "Sample traces are shown for this wallet."
                    : "Session loading needs attention."}
              </p>
            ) : null}
          </div>
          <Link
            href="/sessions"
            prefetch
            className="text-xs font-medium uppercase tracking-[0.1em] text-indigo-300 transition-colors hover:text-indigo-200"
          >
            View all
          </Link>
        </div>
        <WalletScopeNotice error={error} sampleFallback={sampleFallback} walletRequired={walletRequired} />
        {loading ? (
          <GlassCard className="p-5">
            <p className="text-sm text-slate-400">Loading wallet-scoped sessions...</p>
          </GlassCard>
        ) : (
          <SessionsListClient sessions={sessions} limit={4} />
        )}
      </div>
    </>
  );
}

export function SessionsArchiveWalletScope() {
  const { error, loading, sampleFallback, sessions, walletRequired } = useWalletScopedSessions();

  return (
    <div className="mt-6 space-y-4">
      <WalletScopeNotice error={error} sampleFallback={sampleFallback} walletRequired={walletRequired} />
      {loading ? (
        <GlassCard className="p-5">
          <p className="text-sm text-slate-400">Loading wallet-scoped sessions...</p>
        </GlassCard>
      ) : (
        <SessionsListClient sessions={sessions} />
      )}
    </div>
  );
}

export function StorageOperationsWalletScope({ walrusNetworkLabel }: { walrusNetworkLabel: string }) {
  const { error, loading, sampleFallback, sessions, walletRequired } = useWalletScopedSessions();

  return (
    <div className="mt-6 space-y-7">
      <WalletScopeNotice error={error} sampleFallback={sampleFallback} walletRequired={walletRequired} />
      {loading ? (
        <GlassCard className="p-5">
          <p className="text-sm text-slate-400">Loading wallet-scoped storage references...</p>
        </GlassCard>
      ) : (
        <>
          <section>
            <div className="mb-3 flex items-center gap-2">
              <ProtocolLogo protocol="walrus" size="sm" />
              <div>
                <h2 className="text-base font-semibold text-white">{walrusNetworkLabel} Blob Storage</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Blob references, upload adapter metadata, expiry, and renewal lifecycle.
                </p>
              </div>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {sessions.map((session) => (
                <StorageJobCard
                  expectedTraceHash={session.trace.traceHash}
                  job={session.storage}
                  key={`${session.id}-${session.storage.uploadJobId}`}
                  verification={session.walrusVerification}
                  walrusNetworkLabel={walrusNetworkLabel}
                />
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <ProtocolLogo protocol="walrus" size="sm" />
              <div>
                <h2 className="text-base font-semibold text-white">Direct {walrusNetworkLabel} Verification</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Blob IDs, Walrus object references, read status, hash comparison, and replay readiness.
                </p>
              </div>
            </div>
            <div className="grid gap-3 xl:grid-cols-3">
              {sessions.map((session) => (
                <WalrusVerificationPanel verification={session.walrusVerification} key={session.id} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
