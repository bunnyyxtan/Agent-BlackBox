"use client";

import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useEffect, useState } from "react";

import { SessionDetailClient } from "@/components/blackbox/SessionDetailClient";
import { GlassCard } from "@/components/ui/GlassCard";
import { WalletConnectButton } from "@/components/ui/WalletConnectButton";
import { readJsonResponse } from "@/lib/http/safe-json";
import type { AgentSession } from "@/types/blackbox";

interface SessionDetailPayload {
  message?: string;
  data?: {
    session: AgentSession;
    redacted?: boolean;
  };
  error?: {
    message?: string;
  };
}

interface SessionDetailState {
  loading: boolean;
  error: string;
  session: AgentSession | null;
}

export function WalletScopedSessionDetail({ sessionId }: { sessionId: string }) {
  const account = useCurrentAccount();
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<SessionDetailState>({
    loading: true,
    error: "",
    session: null,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const controller = new AbortController();
    const ownerWallet = account?.address ?? "";
    const endpoint = ownerWallet
      ? `/api/sessions/${encodeURIComponent(sessionId)}?ownerWallet=${encodeURIComponent(ownerWallet)}`
      : `/api/sessions/${encodeURIComponent(sessionId)}`;

    setState({ loading: true, error: "", session: null });

    fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        const payload = await readJsonResponse<SessionDetailPayload>(response, `GET ${endpoint}`);
        if (!response.ok || !payload.data?.session || payload.data.redacted) {
          throw new Error(payload.error?.message ?? payload.message ?? "This session could not be loaded.");
        }
        return payload.data.session;
      })
      .then((session) => setState({ loading: false, error: "", session }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({
          loading: false,
          error: error instanceof Error ? error.message : "This session could not be loaded.",
          session: null,
        });
      });

    return () => controller.abort();
  }, [account?.address, mounted, sessionId]);

  if (state.loading) {
    return (
      <GlassCard className="p-6">
        <p className="text-sm text-slate-400">Loading wallet-scoped session...</p>
      </GlassCard>
    );
  }

  if (state.session) {
    return <SessionDetailClient session={state.session} />;
  }

  return (
    <GlassCard className="border-indigo-300/15 bg-indigo-300/[0.035] p-6">
      <p className="eyebrow">Wallet-Scoped Session</p>
      <h1 className="mt-2 text-xl font-semibold text-white">Connect the session owner wallet</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        {state.error || "Real Agent BlackBox sessions are private to the wallet that created them."}
      </p>
      <div className="mt-5">
        <WalletConnectButton />
      </div>
    </GlassCard>
  );
}
