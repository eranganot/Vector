import { api } from "@/application/facade";
import { Shell } from "../_components/header";
import { requireActor } from "../_lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { actor, me, via } = await requireActor();
  const [approvalList, decisionList] = await Promise.all([api.myApprovals(actor), api.myDecisions(actor)]);
  const approvals = approvalList.length + decisionList.length;
  const roles = actor.kind === "user" ? [...new Set(actor.assignments.map((a) => a.role))] : [];
  return (
    <Shell me={{ name: me.name, title: me.title }} approvals={approvals} roles={roles} via={via}>
      {children}
    </Shell>
  );
}
