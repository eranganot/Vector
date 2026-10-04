import { WorkstreamPage } from "../../_components/workstream";
import { requireActor } from "../../_lib/session";

export default async function RisksPage({ searchParams }: { searchParams: Promise<{ unit?: string; band?: string }> }) {
  const { actor } = await requireActor();
  return <WorkstreamPage actor={actor} ws="risk" params={await searchParams} />;
}
