import { notFound } from "next/navigation";
import { api } from "@/application/facade";
import { Dashboard } from "../../../_components/dashboard";
import { requireActor } from "../../../_lib/session";

/** Any unit you may read, as the same dashboard as your home (drill-down). Out of scope looks exactly like missing. */
export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor } = await requireActor();
  const v = await api.unit(actor, id);
  if (!v) notFound();
  return <Dashboard v={v} />;
}
