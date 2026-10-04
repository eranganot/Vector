/** The unit view: one template for the group, a region, a branch and a department (docs/phases/PHASE_3.md). */
import Link from "next/link";
import { api } from "@/application/facade";
import type { KpiStat } from "@/application/facade";
import { Band, Card, Dot, fmtIls, fmtKpi, LineChart, Pill, Ring, SectionTitle } from "./ui";

export type View = NonNullable<Awaited<ReturnType<typeof api.performance>>>;

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

export const HEALTH: Record<string, { label: string; tone: "good" | "watch" | "bad" }> = {
  on_track: { label: "On track", tone: "good" },
  watch: { label: "Watch", tone: "watch" },
  at_risk: { label: "At risk", tone: "bad" },
  healthy: { label: "Healthy", tone: "good" },
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

export function KpiCard({
  k,
  chart = true,
  links = [],
}: {
  k: KpiStat;
  chart?: boolean;
  links?: { id: string; title: string; band: string }[];
}) {
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
      {links.length > 0 ? (
        <ul className="flex flex-col gap-1 border-t border-line pt-2 text-xs">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <span className="text-muted">Explained by</span>
              <Band band={l.band} />
              <Link href={`/insights/${l.id}`} className="truncate text-ink no-underline hover:underline">
                {l.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        k.status === "bad" && (
          <p className="border-t border-line pt-2 text-xs text-warn">No insight explains this yet.</p>
        )
      )}
    </Card>
  );
}

export function Summary({ v }: { v: View }) {
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

export function ChildTable({
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
              <td className="px-3 py-2.5 font-semibold">
                <Link href={`/units/${r.id}`} className="no-underline hover:text-accent hover:underline">
                  {r.name}
                </Link>
              </td>
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

export function ActionList({
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

/** Breadcrumb from the group root to this unit; every step links to its unit view. */
export function Breadcrumb({ items }: { items: { id: string; name: string }[] }) {
  return (
    <nav aria-label="Organization" className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
      {items.map((b, i) => (
        <span key={b.id} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>›</span>}
          {i === items.length - 1 ? (
            <span className="text-ink">{b.name}</span>
          ) : (
            <Link href={`/units/${b.id}`} className="no-underline hover:text-accent hover:underline">
              {b.name}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export type CardItem = View["items"][number];

/** An actionable insight card: what, how bad and why, what should happen, and who it is waiting on. */
export function InsightCard({ i }: { i: CardItem }) {
  return (
    <Link
      href={`/insights/${i.id}`}
      className="group flex items-start gap-4 rounded-xl border border-line bg-panel/90 px-4 py-3.5 no-underline transition-colors hover:border-accent/60"
    >
      <Band
        band={i.band}
        score={i.score}
        title={i.local ? `For ${i.local.scopeName}: ${i.local.band}. Group-wide: ${i.groupBand}.` : undefined}
      />
      <span className="flex min-w-0 grow flex-col gap-1">
        <span className="text-[15px] font-semibold leading-snug group-hover:text-accent">{i.title}</span>
        <span className="text-[13px] text-ink/90">
          <span className="text-muted">Why: </span>
          {i.why}
          {i.local && i.local.band !== i.groupBand && (
            <span className="text-muted">
              {" "}
              · {i.local.band} for {i.local.scopeName} (group {i.groupBand})
            </span>
          )}
        </span>
        {i.recommendation && (
          <span className="text-[13px] text-ink/90">
            <span className="text-muted">{i.workstream === "risk" ? "Recommended: " : "Play: "}</span>
            {i.recommendation}
          </span>
        )}
        <span className="text-xs text-muted">
          {i.ownerDepartmentName ? `Owner: ${i.ownerDepartmentName}` : i.primaryUnitName}
          {i.ownerDepartmentName && i.primaryUnitName !== i.ownerDepartmentName ? ` · ${i.primaryUnitName}` : ""}
        </span>
      </span>
      {i.waiting && <Pill tone={i.waiting.startsWith("Decision") ? "strong" : "warn"}>{i.waiting}</Pill>}
    </Link>
  );
}

export function Lanes({ items, limit }: { items: CardItem[]; limit?: number }) {
  const risks = items.filter((i) => i.workstream === "risk");
  const opps = items.filter((i) => i.workstream === "opportunity");
  const cut = <T,>(xs: T[]) => (limit ? xs.slice(0, limit) : xs);
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="flex min-w-0 flex-col gap-3">
        <SectionTitle aside={<span className="text-xs text-muted">ranked by priority (P1–P4)</span>}>
          Risks · {risks.length}
        </SectionTitle>
        {risks.length === 0 && <p className="text-sm text-muted">No open risks here.</p>}
        {cut(risks).map((i) => (
          <InsightCard key={i.id} i={i} />
        ))}
      </section>
      <section className="flex min-w-0 flex-col gap-3">
        <SectionTitle aside={<span className="text-xs text-muted">O1 pursue · O2 plan · O3 watch</span>}>
          Opportunities · {opps.length}
        </SectionTitle>
        {opps.length === 0 && <p className="text-sm text-muted">No opportunities here.</p>}
        {cut(opps).map((i) => (
          <InsightCard key={i.id} i={i} />
        ))}
      </section>
    </div>
  );
}

export function DepartmentPulse({ pulse }: { pulse: Extract<View, { departmentPulse: unknown }>["departmentPulse"] }) {
  return (
    <Card>
      <SectionTitle aside={<span className="text-xs text-muted">100 − open risks it owns or must act on</span>}>
        Organization pulse
      </SectionTitle>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 xl:grid-cols-8">
        {pulse.map((d) => (
          <Link
            key={d.id}
            href={`/units/${d.id}`}
            className="flex flex-col items-center gap-1.5 rounded-lg p-1 text-center no-underline hover:bg-soft"
          >
            <Ring value={d.health} tone={HEALTH[d.status]?.tone ?? (d.status === "at_risk" ? "bad" : "watch")} />
            <span className="text-[13px] font-semibold leading-tight">{d.name}</span>
            <span className="text-[11px] text-muted">
              owns {d.ownedRisks} risk{d.ownedRisks === 1 ? "" : "s"}
              {d.ownedOpportunities ? ` · ${d.ownedOpportunities} opp.` : ""} · in {d.involved} more
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
