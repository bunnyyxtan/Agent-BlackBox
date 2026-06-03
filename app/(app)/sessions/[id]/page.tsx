import { notFound } from "next/navigation";

import { SessionDetailClient } from "@/components/blackbox/SessionDetailClient";
import { getSessionById } from "@/lib/session-service";

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) notFound();
  return (
    <>
      <SessionDetailClient session={session} />
    </>
  );
}
