import { notFound } from "next/navigation";
import { demoNow } from "@/application/facade";
import { api, localized } from "@/app/_lib/api";
import { Dashboard } from "../_components/dashboard";
import { ExecutiveHomeView } from "../_components/executive";
import { WaitingCard } from "../_components/waiting";
import { getT } from "../_lib/locale";
import { can, requireActor } from "../_lib/session";

/**
 * Home: a clean dashboard of your own scope (Eran, 2026-10-04). The Executive, the board observer and the admin get the
 * group (Executive Command Center, with what changed); managers get their region, branch or department. Risks and
 * opportunities appear here only as a summary; the full lists are the Risks and Opportunities tabs.
 */
export default async function Home({ searchParams }: { searchParams: Promise<{ unit?: string; by?: string }> }) {
  const { actor, me } = await requireActor();
  const t = await getT();
  const { unit, by } = await searchParams;
  // C-suite (plan v2, E2): health and money lead (executive-home.md). Everyone else keeps the dashboard below.
  if (me.isCSuite) {
    const v = await api.executiveHome(actor, unit);
    if (!v) {
      if (unit) notFound();
      return <p className="text-sm text-muted">{t("Nothing in your scope yet.")}</p>;
    }
    const [deps, approvals, decisions, actions] = await Promise.all([
      api.commitments(actor, v.scope.kind === "department" ? v.scope.unitId : undefined),
      api.myApprovals(actor),
      api.myDecisions(actor),
      api.myActions(actor),
    ]);
    return (
      <ExecutiveHomeView
        v={v}
        greeting={await greeting(me, t)}
        by={by}
        deps={deps}
        waiting={<WaitingCard approvals={approvals} decisions={decisions} actions={actions} showEmpty bandOf={{}} />}
      />
    );
  }
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
  const greet = await greeting(me, t, now);
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

async function greeting(me: { name: string }, t: Awaited<ReturnType<typeof getT>>, at?: Date) {
  const now = at ?? (await demoNow());
  const h = (now.getUTCHours() + 3) % 24; // Israel time for the synthetic organization
  const name = (await localized(me)).name.split(" ")[0];
  return h < 12
    ? t("Good morning, {name}", { name })
    : h < 18
      ? t("Good afternoon, {name}", { name })
      : t("Good evening, {name}", { name });
}
