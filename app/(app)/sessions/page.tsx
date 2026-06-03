import { PlusCircle } from "lucide-react";
import Link from "next/link";

import { SessionsListClient } from "@/components/blackbox/SessionsListClient";
import { listSessions } from "@/lib/session-service";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const sessions = await listSessions();
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
      <div className="mt-6">
        <SessionsListClient sessions={sessions} />
      </div>
    </>
  );
}

