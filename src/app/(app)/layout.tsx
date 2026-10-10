import { api } from "@/app/_lib/api";
import { Shell } from "../_components/header";
import { requireActor } from "../_lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { actor, me, via } = await requireActor();
  const [approvalList, decisionList, inboxList] = await Promise.all([
    api.myApprovals(actor),
    api.myDecisions(actor),
    me.isCSuite ? api.inboxView(actor) : null,
  ]);
  const approvals = approvalList.length + decisionList.length;
  const inbox = inboxList ? inboxList.counts.decision + inboxList.counts.reply : 0;
  const roles = actor.kind === "user" ? [...new Set(actor.assignments.map((a) => a.role))] : [];
  return (
    <Shell
      me={{ name: me.name, title: me.title, isCSuite: me.isCSuite }}
      approvals={approvals}
      inbox={inbox}
      roles={roles}
      via={via}
    >
      {children}
    </Shell>
  );
}
