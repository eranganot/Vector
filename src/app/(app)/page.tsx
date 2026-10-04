import Link from "next/link";
import { redirect } from "next/navigation";
import { api, demoNow } from "@/application/facade";
import { Band, Card, fmtKpi, SectionTitle } from "../_components/ui";
import { ChildTable, DepartmentPulse, Lanes } from "../_components/unit";
import { WaitingCard } from "../_components/waiting";
import { can, requireActor } from "../_lib/session";

/**
 * Home, routed by role (docs/phases/PHASE_3.md): the Executive, the board observer and the admin get the Executive
 * Command Center; managers land on their own unit.
 */
export default async function Home() {
  const { actor, me } = await requireActor();
  if (!can(actor, "executive") && !can(actor, "viewer") && !can(actor, "admin")) {
    const own = await api.performance(actor);
    if (own) redirect(`/units/${own.scope.id}`);
  }
  const [cc, approvals, decisions, now] = await Promise.all([
    api.commandCenter(actor),
    api.myApprovals(actor),
    api.myDecisions(actor),
    demoNow(),
  ]);
  if (!cc) return <p className="text-sm text-muted">Nothing in your scope yet.</p>;
  const h = (now.getUTCHours() + 3) % 24; // Israel time for the synthetic organization
  const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted">
          {greet}, {me.name.split(" ")[0]} · Executive Command Center
        </p>
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight">{cc.headline}</h1>
        <p className="text-sm text-muted">{cc.subline}</p>
      </div>
      <WaitingCard approvals={approvals} decisions={decisions} />
      <Lanes items={cc.items} limit={3} />
      <p className="-mt-2 text-sm">
        <Link href={`/units/${cc.scope.id}`} className="text-accent">
          All {cc.items.length} risks and opportunities, key results and departments →
        </Link>
      </p>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionTitle aside={<span className="text-xs text-muted">last 24 h (demo clock)</span>}>
            What changed
          </SectionTitle>
          {cc.changes.counts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No change in the last 24 hours.</p>
          ) : (
            <>
              <p className="mt-3 text-sm">
                {cc.changes.counts.map((c) => `${c.n} ${c.verb.toLowerCase()}`).join(" · ")}
              </p>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {cc.changes.feed.map((f) => (
                  <li key={f.id} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted">{f.verb}</span>
                    <Band band={f.band} />
                    <Link href={`/insights/${f.insightId}`} className="min-w-0 truncate no-underline hover:underline">
                      {f.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
        <Card>
          <SectionTitle aside={<span className="text-xs text-muted">branches furthest from target this week</span>}>
            Biggest moves
          </SectionTitle>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {cc.moves.map((m) => (
              <li key={`${m.unitId}-${m.kpi}`} className="flex flex-wrap items-baseline gap-x-2">
                <Link href={`/units/${m.unitId}`} className="font-semibold no-underline hover:underline">
                  {m.unitName}
                </Link>
                <span>{m.kpi}</span>
                <span className="font-mono text-p1">{fmtKpi(m.value, m.unit)}</span>
                <span className="text-xs text-muted">
                  vs {m.against} {fmtKpi(m.ref, m.unit)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <SectionTitle aside={<span className="text-xs text-muted">click a region to drill down</span>}>
          Health by region
        </SectionTitle>
        <div className="mt-3">
          <ChildTable rows={cc.children} unitLabel="Region" />
        </div>
      </Card>
      <DepartmentPulse pulse={cc.departmentPulse} />
    </>
  );
}
