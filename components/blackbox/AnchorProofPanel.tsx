"use client";

import {
  useCurrentAccount,
  useCurrentNetwork,
  useDAppKit,
} from "@mysten/dapp-kit-react";
import { Anchor, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo } from "@/components/ui/ProtocolLogo";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UserFacingErrorAlert } from "@/components/ui/UserFacingErrorAlert";
import { WalletConnectButton } from "@/components/ui/WalletConnectButton";
import { normalizeUserFacingError, type UserFacingError } from "@/lib/errors/user-facing-errors";
import { readJsonResponse } from "@/lib/http/safe-json";
import { getNetworkConfig, normalizeSuiNetwork } from "@/lib/network-config";
import {
  isValidSuiObjectId,
  normalizeSuiAddressForCompare,
  toDAppKitNetwork,
} from "@/lib/sui-client-helpers";
import {
  extractProofObjectIdFromTransactionResult,
  getProofExplorerUrl,
  getSuiProofRegistryConfig,
  isAnchoredProof,
} from "@/lib/sui-proof";
import { buildCreateSessionProofTransaction } from "@/lib/sui-proof-transaction";
import { formatProofStatus } from "@/lib/tatum-rpc-labels";
import type { AgentSession } from "@/types/blackbox";

interface AnchorProofResponse {
  ok: boolean;
  message: string;
  data?: {
    session: AgentSession;
  };
}

interface AnchorProofPanelProps {
  session: AgentSession;
  onSessionUpdate?: (session: AgentSession) => void;
}

export function AnchorProofPanel({ onSessionUpdate, session }: AnchorProofPanelProps) {
  const account = useCurrentAccount();
  const currentNetwork = useCurrentNetwork();
  const dAppKit = useDAppKit();
  const [submitting, setSubmitting] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [persistedSession, setPersistedSession] = useState(session);
  const config = getSuiProofRegistryConfig();
  const proof = persistedSession.proof;
  const anchored = isAnchoredProof(proof);
  const hasProofObject = isValidSuiObjectId(proof.suiObjectId);
  const explorerUrl = getProofExplorerUrl(proof);
  const retrying = Boolean(error) || proof.status === "failed";
  const expectedNetwork = toDAppKitNetwork(proof.network);
  const wrongNetwork = Boolean(account && currentNetwork !== expectedNetwork);
  const wrongOwner = Boolean(
    account &&
      persistedSession.ownerAddress &&
      normalizeSuiAddressForCompare(account.address) !==
        normalizeSuiAddressForCompare(persistedSession.ownerAddress),
  );
  const walrusReady =
    persistedSession.storage.storageProvider !== "local" &&
    Boolean(persistedSession.storage.blobId);
  const sampleTrace = Boolean(persistedSession.isSample);

  useEffect(() => {
    setPersistedSession(session);
  }, [session]);

  async function anchorProof() {
    if (!account || submitting || anchored) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const transaction = buildCreateSessionProofTransaction(persistedSession);
      const result = await dAppKit.signAndExecuteTransaction({ transaction });
      if (result.$kind !== "Transaction") {
        throw new Error("Sui did not execute the proof-anchor transaction successfully.");
      }
      const transactionDigest = result.Transaction.digest;
      const proofObjectId = extractProofObjectIdFromTransactionResult(result);
      const response = await fetch(`/api/sessions/${persistedSession.id}/proof-anchor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionDigest,
          proofObjectId,
          packageId: config.packageId,
          network: normalizeSuiNetwork(currentNetwork),
          owner: account.address,
        }),
      });
      const payload = await readJsonResponse<AnchorProofResponse>(
        response,
        `POST /api/sessions/${persistedSession.id}/proof-anchor`,
      );
      if (!response.ok || !payload.ok || !payload.data?.session) {
        throw new Error(payload.message || "The proof anchor could not be persisted.");
      }
      setPersistedSession(payload.data.session);
      onSessionUpdate?.(payload.data.session);
      setMessage(payload.message);
    } catch (anchorError) {
      setError(normalizeUserFacingError(anchorError));
    } finally {
      setSubmitting(false);
    }
  }

  async function recheckProof() {
    if (!anchored || rechecking) return;
    setRechecking(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/verify/${persistedSession.id}/recheck`, {
        method: "POST",
      });
      const payload = await readJsonResponse<AnchorProofResponse>(
        response,
        `POST /api/verify/${persistedSession.id}/recheck`,
      );
      if (!response.ok || !payload.ok || !payload.data?.session) {
        throw new Error(payload.message || "The Sui proof could not be rechecked.");
      }
      setPersistedSession(payload.data.session);
      onSessionUpdate?.(payload.data.session);
      setMessage(payload.message);
    } catch (recheckError) {
      setError(normalizeUserFacingError(recheckError));
    } finally {
      setRechecking(false);
    }
  }

  let prerequisiteMessage: string | null = null;
  if (sampleTrace) {
    prerequisiteMessage = "Run a real agent session to anchor your own Sui proof. Sample traces are not wallet-signed.";
  } else if (!config.configured) {
    prerequisiteMessage = "Proof contract not configured";
  } else if (!walrusReady) {
    prerequisiteMessage = "A real Walrus-backed trace blob is required before proof anchoring.";
  } else if (wrongOwner) {
    prerequisiteMessage = "Connect the wallet that created this session before anchoring its proof.";
  } else if (wrongNetwork) {
    prerequisiteMessage = `Switch the connected wallet to ${getNetworkConfig(proof.network).displayNetwork}.`;
  }

  return (
    <GlassCard className="border-cyan/15 bg-cyan/[0.025] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ProtocolLogo protocol="sui" size="md" />
          <div className="min-w-0">
            <p className="eyebrow">Wallet-Signed Sui Action</p>
            <h2 className="mt-2 text-base font-semibold text-white">Anchor Proof on Sui</h2>
          </div>
        </div>
        <StatusBadge status={formatProofStatus(proof.status)} />
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        After Walrus storage is complete, anchor the final blob ID and trace hashes on Sui. This is a separate proof transaction.
      </p>

      {sampleTrace ? (
        <div className="mt-4 rounded-xl border border-cyan/15 bg-cyan/[0.045] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan">
            Sample Trace
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            This public sample shows the proof flow only. It is not stored by your wallet and cannot be anchored as your proof.
          </p>
        </div>
      ) : null}

      {anchored ? (
        <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
          <div className="flex items-start gap-2">
            <ProtocolLogo protocol="sui" size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-200">
                {hasProofObject
                  ? "Proof anchor recorded"
                  : "Transaction anchored. Proof object extraction pending."}
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-emerald-100/50">
                  Transaction digest
                </p>
                <p className="font-mono text-[0.68rem] text-emerald-100/70 [overflow-wrap:anywhere]" title={proof.transactionDigest}>
                  {proof.transactionDigest}
                </p>
              </div>
              {hasProofObject && (
                <div className="mt-2 space-y-1">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-emerald-100/50">
                    Proof object
                  </p>
                  <p className="font-mono text-[0.68rem] text-emerald-100/70 [overflow-wrap:anywhere]" title={proof.suiObjectId}>
                    {proof.suiObjectId}
                  </p>
                </div>
              )}
              {explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-cyan transition hover:text-white"
                >
                  Open Sui transaction
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <div className="mt-2">
                  <StatusBadge status="Transaction Pending" size="sm" />
                </div>
              )}
              <button
                type="button"
                onClick={recheckProof}
                disabled={rechecking}
                className="mt-3 flex min-h-10 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-cyan transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${rechecking ? "animate-spin" : ""}`} />
                {rechecking ? "Rechecking Proof..." : "Recheck Proof"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          {sampleTrace ? (
            <button
              type="button"
              disabled
              className="button-primary min-h-11 w-full justify-center disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Anchor className="h-4 w-4" />
              Anchor Real Session Only
            </button>
          ) : !account ? (
            <>
              <p className="mb-2 text-xs text-slate-500">Connect Wallet to anchor proof.</p>
              <WalletConnectButton fullWidth />
            </>
          ) : (
            <button
              type="button"
              onClick={anchorProof}
              disabled={submitting || Boolean(prerequisiteMessage)}
              className="button-primary min-h-11 w-full justify-center disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Anchor className="h-4 w-4" />
              {submitting ? "Anchoring proof..." : retrying ? "Retry Anchor" : "Anchor Proof on Sui"}
            </button>
          )}
        </div>
      )}

      {prerequisiteMessage && !anchored && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-200/80" />
          <p className="text-xs leading-5 text-amber-100/75">{prerequisiteMessage}</p>
        </div>
      )}
      {message && <p className="mt-3 text-xs leading-5 text-emerald-200/80">{message}</p>}
      {error && (
        <div className="mt-3">
          <UserFacingErrorAlert error={error} />
        </div>
      )}
    </GlassCard>
  );
}
