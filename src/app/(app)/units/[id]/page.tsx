import { notFound } from "next/navigation";
import { api } from "@/application/facade";
import { UnitView } from "../../../_components/unit";
import { WaitingCard } from "../../../_components/waiting";
import { requireActor } from "../../../_lib/session";

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor } = await requireActor();
  const [v, own, approvals, decisions] = await Promise.all([
    api.unit(actor, id),
    api.performance(actor),
    api.myApprovals(actor),
    api.myDecisions(actor),
  ]);
  if (!v) notFound(); // out of scope looks exactly like missing
  return (
    <UnitView
      v={v}
      top={
        own?.scope.id === v.scope.id ? (
          <WaitingCard
            approvals={approvals}
            decisions={decisions}
            bandOf={Object.fromEntries(v.items.map((i) => [i.id, i.band]))}
          />
        ) : undefined
      }
    />
  );
}
