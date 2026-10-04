import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/application/facade";
import type { KpiStat } from "@/application/facade";
import { Band, Card, Dot, fmtIls, fmtKpi, LineChart, Meter, Pill, Ring, SectionTitle } from "../../_components/ui";
import { requireActor } from "../../_lib/session";

type View = NonNullable<Awaited<ReturnType<typeof api.performance>>>;

const ACTION_STATUS: Record<string, { label: string; tone: "neutral" | "strong" | "good" | "warn" | "bad" }> = {
  proposed: { label: "Proposed", tone: "neutral" },
  pending_approval: { label: "Awaiting approval", tone: "warn" },
  ready: { label: "Ready", tone: "strong" },
  executing: { label: "Executing", tone: "strong" },
  executed: { label: "Done", tone: "good" },
  failed: { label: "Failed", tone: "bad" },
  rejected: { label: "Rejected", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const HEALTH: Record<string, { label: string; tone: "good" | "watch" | "bad" }> = {
  on_track: { label: "On track", tone: "good" },
  watch: { label: "Watch", tone: "watch" },
  at_risk: { label: "At risk", tone: "bad" },
  healthy: { label: "Healthy", tone: "good" },
};

const POSITION_TITLE: Record<string, string> = {
  group: "Group performance",
  region: "Region performance",
  branch: "Branch performance",
  department: "Department performance",
};

function change(k: KpiStat) {
  const ratio = k.code === "net_sales" || k.code === "transactions";
  const v = k.changeVsPrevious;
  if (!Number.isFinite(v)) return null;
  const good = k.higherIsBetter ? v >= 0 : v <= 0;
  const text = ratio
    ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`
    : `${v >= 0 ? "+" : ""}${v.toFixed(k.unit === "count" ? 0 : 1)}${k.unit === "pct" ? " pts" : ""}`;
  return { text, good };
}

function KpiCard({ k, chart = true }: { k: KpiStat; chart?: boolean }) {
  const d = change(k);
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted">{k.name}</span>
        <Dot tone={k.status} />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[26px] font-semibold tracking-tight">{fmtKpi(k.value, k.unit)}</span>
        {d && <span className={`text-[13px] font-semibold ${d.good ? "text-good" : "text-p1"}`}>{d.text}</span>}
      </div>
      <span className="text-xs text-muted">
        {k.target !== null ? `Target ${fmtKpi(k.target, k.unit)} · ` : ""}usual {fmtKpi(k.usual, k.unit)} · vs last week
      </span>
      {chart && k.series.length > 1 && (
        <LineChart
          days={k.series}
          unit={k.unit}
          compact
          height={44}
          expectedLabel={k.target !== null ? "target" : "usual"}
        />
      )}
    </Card>
  );
}

function Summary({ v }: { v: View }) {
  const p1 = v.workstreams.risks.find((r) => r.band === "P1")!.count;
  const riskTotal = v.workstreams.risks.reduce((a, r) => a + r.count, 0);
  const o1 = v.workstreams.opportunities.find((r) => r.band === "O1")!.count;
  const oppTotal = v.workstreams.opportunities.reduce((a, r) => a + r.count, 0);
  const cells = [
    {
      label: "Open risks",
      value: String(riskTotal),
      sub: `${p1} P1 · ${fmtIls(v.workstreams.atStakeIls)}/week at stake`,
      tone: p1 ? "bad" : "good",
    },
    {
      label: "Opportunities",
      value: String(oppTotal),
      sub: `${o1} to pursue now · ${fmtIls(v.workstreams.upsideIls)}/week upside`,
      tone: "good",
    },
    {
      label: "Waiting for approval",
      value: String(v.execution.approvalsWaiting),
      sub: `${v.execution.pendingApproval} actions held for a decision-maker`,
      tone: v.execution.approvalsWaiting ? "watch" : "good",
    },
    {
      label: "Actions",
      value: String(v.execution.proposed + v.execution.pendingApproval + v.execution.executed),
      sub: `${v.execution.executed} done · ${v.execution.proposed} awaiting a decision · ${v.execution.overdue} overdue`,
      tone: v.execution.overdue ? "bad" : "good",
    },
  ] as const;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cells.map((c) => (
        <Card key={c.label} className="flex flex-col gap-1.5 p-4">
          <span className="flex items-center justify-between text-[13px] text-muted">
            {c.label} <Dot tone={c.tone} />
          </span>
          <span className="text-[30px] font-semibold leading-none tracking-tight">{c.value}</span>
          <span className="text-xs text-muted">{c.sub}</span>
        </Card>
      ))}
    </div>
  );
}

function ChildTable({
  rows,
  unitLabel,
}: {
  rows: Extract<View, { children: unknown }>["children"];
  unitLabel: string;
}) {
  const col = (r: (typeof rows)[number], code: string) => {
    const s = r.stats[code];
    if (!s) return <td />;
    const d = change(s);
    return (
      <td className="px-3 py-2.5 font-mono text-[13px]">
        <span className="inline-flex items-center gap-1.5">
          <Dot tone={s.status} />
          {code === "net_sales"
            ? `${s.usual ? ((s.value / s.usual - 1) * 100 >= 0 ? "+" : "") + ((s.value / s.usual - 1) * 100).toFixed(1) + "%" : "—"}`
            : fmtKpi(s.value, s.unit)}
        </span>
        {code === "net_sales" && d && <span className="ml-1 text-[11px] text-muted">({fmtIls(s.value)})</span>}
      </td>
    );
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th className="px-3 py-2 font-medium">{unitLabel}</th>
            <th className="px-3 py-2 font-medium">Health</th>
            <th className="px-3 py-2 font-medium">Sales vs usual</th>
            <th className="px-3 py-2 font-medium">OSA</th>
            <th className="px-3 py-2 font-medium">Labor %</th>
            <th className="px-3 py-2 font-medium">Shrink %</th>
            <th className="px-3 py-2 font-medium">NPS</th>
            <th className="px-3 py-2 font-medium">Risks · Opps</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line/60 last:border-0">
              <td className="px-3 py-2.5 font-semibold">{r.name}</td>
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5">
                  <Dot tone={HEALTH[r.health].tone} /> {HEALTH[r.health].label}
                </span>
              </td>
              {col(r, "net_sales")}
              {col(r, "osa")}
              {col(r, "labor_pct")}
              {col(r, "shrink_pct")}
              {col(r, "nps")}
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-2">
                  {r.worstBand && <Band band={r.worstBand} />}
                  <span className="text-muted">
                    {r.risks} · {r.opportunities}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionList({
  items,
  empty,
}: {
  items: { id: string; title: string; status: string; owner: string; department: string; insightId: string | null }[];
  empty: string;
}) {
  if (items.length === 0) return <p className="mt-3 text-sm text-muted">{empty}</p>;
  return (
    <ul className="mt-3 flex flex-col divide-y divide-line/60">
      {items.map((a) => (
        <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2.5 text-sm">
          <span className="text-[13px] font-semibold text-accent">
            {a.department} <span className="font-normal text-muted">· {a.owner}</span>
          </span>
          <span className="row-span-2">
            <Pill tone={ACTION_STATUS[a.status]?.tone}>{ACTION_STATUS[a.status]?.label ?? a.status}</Pill>
          </span>
          <Link href={`/insights/${a.insightId}`} className="min-w-0 no-underline hover:underline">
            {a.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NeedsHandling({ items }: { items: Awaited<ReturnType<typeof api.listInsights>> }) {
  const live = items.filter((i) => i.status === "open" || i.status === "acknowledged");
  if (live.length === 0) return <p className="mt-3 text-sm text-muted">Nothing open in your scope.</p>;
  return (
    <ul className="mt-3 flex flex-col gap-2.5">
      {live.map((i) => (
        <li key={i.id} className="flex items-start gap-3 text-sm">
          <Band band={i.local?.band ?? i.priorityBand} score={i.local?.score ?? i.priorityScore} />
          <span className="flex min-w-0 flex-col">
            <Link href={`/insights/${i.id}`} className="no-underline hover:underline">
              {i.title}
            </Link>
            <span className="text-xs text-muted">
              {i.ownerDepartmentName ?? i.primaryUnitName}
              {i.local && i.local.band !== i.priorityBand ? ` · group-wide ${i.priorityBand}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function PerformancePage() {
  const { actor, me } = await requireActor();
  const [v, list] = await Promise.all([api.performance(actor), api.listInsights(actor)]);
  if (!v) notFound();
  const asOf = new Date(`${v.asOf}T00:00:00Z`);
  const weekEnd = new Date(asOf.getTime() - 86_400_000).toISOString().slice(5, 10);
  const weekStart = new Date(asOf.getTime() - 7 * 86_400_000).toISOString().slice(5, 10);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-semibold tracking-tight">{POSITION_TITLE[v.position]}</h1>
          <p className="text-sm text-muted">
            {v.scope.name} · {me.name}, {me.title} · last 7 days ({weekStart} → {weekEnd}) vs the week before, the usual
            level and target
          </p>
        </div>
        <Pill>Synthetic data</Pill>
      </div>

      <Summary v={v} />

      {"children" in v && (
        <>
          <section className="flex flex-col gap-3">
            <SectionTitle>Key results</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {v.kpis.map((k) => (
                <KpiCard key={k.code} k={k} />
              ))}
            </div>
          </section>

          {v.position === "group" && (
            <div className="grid gap-6">
              <Card>
                <SectionTitle aside={<span className="text-xs text-muted">items specific to a region</span>}>
                  Health by region
                </SectionTitle>
                <div className="mt-3">
                  <ChildTable rows={v.children} unitLabel="Region" />
                </div>
              </Card>
              <Card>
                <SectionTitle
                  aside={<span className="text-xs text-muted">100 − open risks it owns or must act on</span>}
                >
                  Organization pulse
                </SectionTitle>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 xl:grid-cols-8">
                  {v.departmentPulse.map((d) => (
                    <div key={d.id} className="flex flex-col items-center gap-1.5 text-center">
                      <Ring
                        value={d.health}
                        tone={HEALTH[d.status]?.tone ?? (d.status === "at_risk" ? "bad" : "watch")}
                      />
                      <span className="text-[13px] font-semibold leading-tight">{d.name}</span>
                      <span className="text-[11px] text-muted">
                        owns {d.ownedRisks} risk{d.ownedRisks === 1 ? "" : "s"}
                        {d.ownedOpportunities ? ` · ${d.ownedOpportunities} opp.` : ""} · in {d.involved} more
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {v.position === "region" && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,2fr)]">
              <Card>
                <SectionTitle aside={<span className="text-xs text-muted">items specific to a branch</span>}>
                  Branches in {v.scope.name}
                </SectionTitle>
                <div className="mt-3">
                  <ChildTable rows={v.children} unitLabel="Branch" />
                </div>
              </Card>
              <Card>
                <SectionTitle aside={<span className="text-xs text-muted">ranked for your region</span>}>
                  Needs handling
                </SectionTitle>
                <NeedsHandling items={list} />
              </Card>
            </div>
          )}

          {v.position === "branch" && (
            <>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <Card>
                  <SectionTitle>Net sales by day vs usual level · 4 weeks</SectionTitle>
                  <div className="mt-3">
                    <LineChart
                      days={v.kpis.find((k) => k.code === "net_sales")!.series}
                      unit="ILS"
                      height={230}
                      width={760}
                    />
                  </div>
                </Card>
                <Card>
                  <SectionTitle aside={<span className="text-xs text-muted">ranked for your branch</span>}>
                    Needs handling
                  </SectionTitle>
                  <NeedsHandling items={list} />
                </Card>
              </div>
              <Card>
                <SectionTitle aside={<span className="text-xs text-muted">who your open items depend on</span>}>
                  Dependencies on other departments
                </SectionTitle>
                <ActionList items={v.dependencies} empty="No open actions on your branch's items." />
              </Card>
            </>
          )}
        </>
      )}

      {"pulse" in v && (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
            <Card className="flex flex-col items-center justify-center gap-2 text-center">
              <SectionTitle>Department health</SectionTitle>
              <Ring
                value={v.pulse.health}
                size={120}
                tone={HEALTH[v.pulse.status]?.tone ?? (v.pulse.status === "at_risk" ? "bad" : "watch")}
              />
              <span className="text-xs text-muted">
                100 − open risks you own (P1 20 · P2 10 · P3 4 · P4 1) and must act on (P1 6 · P2 3 · P3 1)
              </span>
            </Card>
            <section className="flex flex-col gap-3">
              <SectionTitle>Department results</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {v.kpis.map((k) => (
                  <KpiCard key={k.code} k={k} />
                ))}
              </div>
            </section>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <SectionTitle>
                Owned by {v.scope.name} · {v.owned.length}
              </SectionTitle>
              <ul className="mt-3 flex flex-col gap-2">
                {v.owned.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 text-sm">
                    <Band band={i.band} score={i.score} />
                    <Link href={`/insights/${i.id}`} className="no-underline hover:underline">
                      {i.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <SectionTitle>Your department must act on · {v.involved.length}</SectionTitle>
              <ul className="mt-3 flex flex-col gap-2">
                {v.involved.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 text-sm">
                    <Band band={i.band} score={i.score} />
                    <Link href={`/insights/${i.id}`} className="min-w-0 grow no-underline hover:underline">
                      {i.title}
                    </Link>
                    <span className="shrink-0 text-xs text-muted">{i.owner}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <SectionTitle>We depend on · {v.weDependOn.length}</SectionTitle>
              <ActionList items={v.weDependOn} empty="Your items don't wait on other departments." />
            </Card>
            <Card>
              <SectionTitle>Others depend on us · {v.dependOnUs.length}</SectionTitle>
              <ActionList items={v.dependOnUs} empty="No other department is waiting on you." />
            </Card>
          </div>
        </>
      )}

      <Card className="flex flex-col gap-3">
        <SectionTitle>Workstreams in your scope</SectionTitle>
        <div className="grid gap-6 md:grid-cols-2">
          {(["risks", "opportunities"] as const).map((ws) => {
            const rows = v.workstreams[ws];
            const total = Math.max(
              1,
              rows.reduce((a, r) => a + r.count, 0),
            );
            return (
              <div key={ws} className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold">
                  {ws === "risks" ? "Risk workstream" : "Opportunity workstream"}
                </span>
                {rows.map((r) => (
                  <div key={r.band} className="grid grid-cols-[56px_minmax(0,1fr)_28px] items-center gap-3 text-sm">
                    <Band band={r.band} />
                    <Meter
                      value={(r.count / total) * 100}
                      tone={
                        r.band === "P1" ? "bad" : r.band === "P2" ? "warn" : r.band.startsWith("O") ? "good" : "accent"
                      }
                    />
                    <span className="text-right font-mono">{r.count}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
