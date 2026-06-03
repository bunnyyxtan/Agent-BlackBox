import { notFound } from "next/navigation";

import { VerifySessionClient } from "@/components/blackbox/VerifySessionClient";
import { verifySession } from "@/lib/session-service";

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await verifySession(id);
  if (!report) notFound();
  return (
    <>
      <VerifySessionClient session={report.session} />
    </>
  );
}
