import { NewSessionForm } from "@/components/blackbox/NewSessionForm";

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const rerunId = firstSearchParam(params.rerun)?.trim();

  return <NewSessionForm rerunId={rerunId || undefined} />;
}
