import { api, demoNow } from "@/application/facade";
import { Dashboard } from "../_components/dashboard";
import { WaitingCard } from "../_components/waiting";
import { can, requireActor } from "../_lib/session";

/**
 * Home: a clean dashboard of your own scope (Eran, 2026-10-04). The Executive, the board observer and the admin get the
 * group (Executive Command Center, with what changed); managers get their region, branch or department. Risks and
 * opportunities appear here only as a summary; the full lists are the Risks and Opportunities tabs.
 */
export default async function Home() {
  const { actor, me } = await requireActor();
  const group = can(actor, "executive") || can(actor, "viewer") || can(actor, "admin");
  const [cc, own, approvals, decisions, actions, now, deps] = await Promise.all([
    group ? api.commandCenter(actor) : Promise.resolve(null),
    group ? Promise.resolve(null) : api.performance(actor),
    api.myApprovals(actor),
    api.myDecisions(actor),
    api.myActions(actor),
    demoNow(),
    api.commitments(actor),
  ]);
  const [workActions, workOutcomes] = await Promise.all([api.actions(actor, "open"), api.outcomes(actor)]);
  const v = cc ?? own;
  if (!v) return <p className="text-sm text-muted">Nothing in your scope yet.</p>;
  const h = (now.getUTCHours() + 3) % 24; // Israel time for the synthetic organization
  const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return (
    <Dashboard
      v={v}
      greeting={`${greet}, ${me.name.split(" ")[0]}${cc ? " · Executive Command Center" : ""}`}
      changes={cc?.changes}
      deps={deps}
      work={{ actions: workActions, outcomes: workOutcomes }}
      waiting={
        <WaitingCard
          approvals={approvals}
          decisions={decisions}
          actions={actions}
          showEmpty
          bandOf={cc ? {} : Object.fromEntries(v.items.map((i) => [i.id, i.band]))}
        />
      }
    />
  );
}
