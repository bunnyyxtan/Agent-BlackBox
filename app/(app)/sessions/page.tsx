import { PlusCircle } from "lucide-react";
import Link from "next/link";

import { SessionsArchiveWalletScope } from "@/components/blackbox/WalletScopedSessions";

export const dynamic = "force-dynamic";

export default function SessionsPage() {
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Trace Archive</p>
          <h1 className="mt-2 text-3xl font-light tracking-tight text-white sm:text-4xl">
            BlackBox Sessions
          </h1>
          <p className="muted mt-2">Inspect replayable agent evidence and proof preparation status.</p>
        </div>
        <Link href="/sessions/new" prefetch className="button-primary w-full sm:w-auto">
          <PlusCircle className="h-4 w-4" />
          Use Agent
        </Link>
      </div>
      <SessionsArchiveWalletScope />
    </>
  );
}

