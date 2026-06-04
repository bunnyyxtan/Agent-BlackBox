import { WalletScopedSessionDetail } from "@/components/blackbox/WalletScopedSessionDetail";

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <WalletScopedSessionDetail sessionId={id} />
    </>
  );
}
