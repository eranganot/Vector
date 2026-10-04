import { notFound, redirect } from "next/navigation";
import { api } from "@/application/facade";
import { requireActor } from "../../_lib/session";

/** Phase 2's Performance page is now the unit view of your own unit (Phase 3). */
export default async function PerformancePage() {
  const { actor } = await requireActor();
  const v = await api.performance(actor);
  if (!v) notFound();
  redirect(`/units/${v.scope.id}`);
}
