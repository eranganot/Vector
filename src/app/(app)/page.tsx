import { api, demoNow } from "@/application/facade";
import { Dashboard } from "../_components/dashboard";
import { WaitingCard } from "../_components/waiting";
import { getT } from "../_lib/locale";
import { can, requireActor } from "../_lib/session";

/**
 * Home: a clean dashboard of your own scope (Eran, 2026-10-04). The Executive, the board observer and the admin get the
 * group (Executive Command Center, with what changed); managers get their region, branch or department. Risks and
 * opportunities appear here only as a summary; the full lists are the Risks and Opportunities tabs.
 */
export default async function Home() {
  const { actor, me } = await requireActor();
  const t = await getT();
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
  if (!v) return <p className="text-sm text-muted">{t("Nothing in your scope yet.")}</p>;
  const h = (now.getUTCHours() + 3) % 24; // Israel time for the synthetic organization
  const name = me.name.split(" ")[0];
  const greet =
    h < 12
      ? t("Good morning, {name}", { name })
      : h < 18
        ? t("Good afternoon, {name}", { name })
        : t("Good evening, {name}", { name });
  return (
    <Dashboard
      v={v}
      greeting={cc ? t("{greeting} · Executive Command Center", { greeting: greet }) : greet}
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
