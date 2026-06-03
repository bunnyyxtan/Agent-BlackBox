"use client";

import { useState } from "react";

import { CopyButton } from "@/components/ui/CopyButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProtocolLogo } from "@/components/ui/ProtocolLogo";
import { formatStatusLabel, StatusBadge } from "@/components/ui/StatusBadge";
import { UserFacingErrorAlert } from "@/components/ui/UserFacingErrorAlert";
import { formatBytes, formatDate, shortHash } from "@/lib/constants";
import { normalizeUserFacingError, type UserFacingError } from "@/lib/errors/user-facing-errors";
import { readJsonResponse } from "@/lib/http/safe-json";
import type { StorageReference, WalrusVerification } from "@/types/blackbox";

export function StorageJobCard({
  job,
  expectedTraceHash,
  verification,
  walrusNetworkLabel = "Walrus Mainnet",
}: {
  job: StorageReference;
  expectedTraceHash: string;
  verification: WalrusVerification;
  walrusNetworkLabel?: string;
}) {
  const [status, setStatus] = useState(job.storageStatus);
  const [readStatus, setReadStatus] = useState(verification.readStatus);
  const [hashMatched, setHashMatched] = useState<boolean | null>(job.hashMatched);
  const [action, setAction] = useState("");
  const [message, setMessage] = useState(job.warning ?? "");
  const [error, setError] = useState<UserFacingError | null>(null);
  const hashStatus = hashMatched === null ? "Not checked" : hashMatched ? "Matched" : "Failed";

  async function requestJson(url: string, options?: RequestInit) {
    const response = await fetch(url, options);
    const payload = await readJsonResponse<{
      data?: Record<string, unknown>;
      error?: { message?: string };
      message?: string;
    }>(response, `${options?.method ?? "GET"} ${url}`);
    if (!response.ok) throw new Error(payload.error?.message ?? payload.message ?? "Storage action failed.");
    return payload;
  }

  async function viewStatus() {
    setAction("status");
    setMessage("");
    setError(null);
    try {
      const payload = await requestJson(
        `/api/storage/status/${encodeURIComponent(job.uploadJobId)}?adapter=${job.storageProvider}`,
      );
      const nextStatus = String(payload.data?.storageStatus ?? status) as typeof status;
      setStatus(nextStatus);
      setMessage(`Storage status: ${formatStatusLabel(nextStatus)}.`);
    } catch (error) {
      setError(normalizeUserFacingError(error));
    } finally {
      setAction("");
    }
  }

  async function directRead() {
    setAction("read");
    setMessage("");
    setError(null);
    try {
      const payload = await requestJson(
        `/api/storage/read/${encodeURIComponent(job.blobId)}?adapter=${job.storageProvider}`,
      );
      setReadStatus(String(payload.data?.readStatus ?? "available") as typeof readStatus);
      setMessage("Stored trace bundle read successfully.");
    } catch (error) {
      setReadStatus("unavailable");
      setError(normalizeUserFacingError(error));
    } finally {
      setAction("");
    }
  }

  async function verifyBlob() {
    setAction("verify");
    setMessage("");
    setError(null);
    try {
      const payload = await requestJson(`/api/storage/verify/${encodeURIComponent(job.blobId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedTraceHash, storageProvider: job.storageProvider }),
      });
      const matched = Boolean(payload.data?.hashMatched);
      setReadStatus(String(payload.data?.readStatus ?? "available") as typeof readStatus);
      setHashMatched(matched);
      setMessage(matched ? "Stored trace hash matched." : "Stored trace hash mismatch detected.");
    } catch (error) {
      setHashMatched(false);
      setError(normalizeUserFacingError(error));
    } finally {
      setAction("");
    }
  }

  return (
    <GlassCard className="group min-w-0 p-4 transition-all duration-300 hover:border-indigo-500/30 hover:bg-white/[0.04] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <ProtocolLogo protocol="walrus" size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-white [overflow-wrap:anywhere]">{job.fileName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="font-mono text-[0.65rem] text-zinc-500 [overflow-wrap:anywhere]">{job.uploadJobId}</p>
            </div>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      
      <dl className="-mx-4 mt-5 grid grid-cols-1 gap-4 border-y border-white/[0.05] bg-black/10 px-4 py-4 text-xs sm:-mx-5 sm:grid-cols-2 sm:px-5">
        <div>
          <dt className="text-zinc-600 uppercase tracking-widest font-mono text-[0.6rem] mb-1">Provider</dt>
          <dd className="flex min-w-0 items-center gap-2 text-zinc-300 font-medium [overflow-wrap:anywhere]">
            <ProtocolLogo protocol="walrus" size="sm" />
            <StatusBadge status={job.storageProvider} size="sm" />
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-widest font-mono text-[0.6rem] mb-1">Upload adapter</dt>
          <dd className="text-zinc-300 font-medium [overflow-wrap:anywhere]">
            <StatusBadge status={job.uploadAdapter} size="sm" />
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-widest font-mono text-[0.6rem] mb-1">Network</dt>
          <dd className="flex min-w-0 items-center gap-2 text-zinc-300 font-medium [overflow-wrap:anywhere]">
            <ProtocolLogo protocol="walrus" size="sm" />
            <StatusBadge status={job.storageNetwork ?? walrusNetworkLabel} size="sm" />
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-widest font-mono text-[0.6rem] mb-1">Upload Relay</dt>
          <dd className="text-zinc-300 font-medium [overflow-wrap:anywhere]">
            <StatusBadge status={job.relayUrl ? "Configured" : "Not used"} size="sm" />
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-widest font-mono text-[0.6rem] mb-1">Type</dt>
          <dd className="text-zinc-300 font-medium [overflow-wrap:anywhere]">{job.fileType ?? "application/json"}</dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-widest font-mono text-[0.6rem] mb-1">Size</dt>
          <dd className="text-zinc-300 font-medium">{formatBytes(job.fileSize ?? 0)}</dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-widest font-mono text-[0.6rem] mb-1">Expiry</dt>
          <dd className="text-zinc-300 font-medium">{formatDate(job.expiryDate)}</dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-widest font-mono text-[0.6rem] mb-1">Renewal</dt>
          <dd className="text-zinc-300 font-medium">
            <StatusBadge status={job.noRenewal ? "Cancelled" : "Active"} size="sm" />
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-widest font-mono text-[0.6rem] mb-1">Direct read</dt>
          <dd className="text-zinc-300 font-medium">
            <StatusBadge status={readStatus} size="sm" />
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600 uppercase tracking-widest font-mono text-[0.6rem] mb-1">Hash integrity</dt>
          <dd className="text-zinc-300 font-medium">
            <StatusBadge status={hashStatus} size="sm" />
          </dd>
        </div>
      </dl>
      
      <div className="mt-4 space-y-2">
        <p className="inline-block max-w-full rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 font-mono text-[0.65rem] text-indigo-400/70 [overflow-wrap:anywhere]">
          Blob: {shortHash(job.blobId, 10, 8)}
        </p>
        <p className="font-mono text-[0.65rem] text-zinc-500 [overflow-wrap:anywhere]" title={job.blobObjectId || "Not available"}>
          Object: {job.blobObjectId ? shortHash(job.blobObjectId, 10, 8) : "Not available"}
        </p>
      </div>
      
      <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
        <button type="button" onClick={viewStatus} disabled={Boolean(action)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white transition hover:border-indigo-400/40 hover:bg-indigo-400/10 disabled:cursor-wait disabled:opacity-55">
          <iconify-icon icon="solar:eye-line-duotone" />
          {action === "status" ? "Checking..." : "View Status"}
        </button>
        <CopyButton value={job.uploadJobId} label="Copy Upload ID" />
        <button type="button" onClick={directRead} disabled={Boolean(action)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white transition hover:border-indigo-400/40 hover:bg-indigo-400/10 disabled:cursor-wait disabled:opacity-55">
          <iconify-icon icon="solar:download-minimalistic-line-duotone" />
          {action === "read" ? "Reading..." : "Direct Read"}
        </button>
        <button type="button" onClick={verifyBlob} disabled={Boolean(action)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white transition hover:border-indigo-400/40 hover:bg-indigo-400/10 disabled:cursor-wait disabled:opacity-55">
          <iconify-icon icon="solar:shield-check-line-duotone" />
          {action === "verify" ? "Verifying..." : "Verify Blob"}
        </button>
      </div>
      {message && <p className="mt-4 text-xs leading-5 text-amber-100/75">{message}</p>}
      {error && (
        <div className="mt-4">
          <UserFacingErrorAlert error={error} />
        </div>
      )}
    </GlassCard>
  );
}
