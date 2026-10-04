/**
 * The dashboard every persona lands on, and every unit drill-down uses (Eran, 2026-10-04: "the CEO should see a clean
 * and clear dashboard"; risks and opportunities live on their own tabs, the home page carries only their summary).
 */
import Link from "next/link";
import { headlineFor } from "@/application/facade";
import type { api, KpiStat } from "@/application/facade";
import { ActionList, Breadcrumb, ChildTable, DepartmentPulse, HEALTH, type View } from "./unit";
import { Band, Card, Dot, fmtIls, fmtKpi, LineChart, Pill, Ring, SectionTitle } from "./ui";
import { DependenciesCard, type CommitmentsView } from "./commitments";
import { ActionsSummary, CommitmentsSummary } from "./home-cards";
import { getT } from "../_lib/locale";

type ActionsView = Awaited<ReturnType<typeof api.actions>>;
type OutcomesView = Awaited<ReturnType<typeof api.outcomes>>;

type Item = View["items"][number];

const TYPE_LABEL: Record<string, string> = {
  group: "Group",
  region: "Region",
  branch: "Branch",
  department: "Department",
};

/** Where the full list lives: the workstream tab, scoped to this unit when it is not the viewer's own. */
export const laneHref = (ws: "risk" | "opportunity", unitId?: string, band?: string) => {
  const q = new URLSearchParams();
  if (unitId) q.set("unit", unitId);
  if (band) q.set("band", band);
  const qs = q.toString();
  return `/${ws === "risk" ? "risks" : "opportunities"}${qs ? `?${qs}` : ""}`;
};

function change(k: KpiStat) {
  const ratio = k.code === "net_sales" || k.code === "transactions";
  const v = k.changeVsPrevious;
  if (!Number.isFinite(v)) return null;
  const good = k.higherIsBetter ? v >= 0 : v <= 0;
  const text = ratio
    ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`
    : `${v >= 0 ? "+" : ""}${v.toFixed(k.unit === "count" ? 0 : 1)}${k.unit === "pct" ? " pts" : ""}`;
  // "pts" is translated where it is shown (see KpiTile).
  return { text, good };
}

const STATUS_WORD: Record<string, string> = { good: "on target", watch: "watch", bad: "off target", neutral: "" };

/** A compact KPI tile: value, change, reference, trend, and the insight that explains it (one line). */
export async function KpiTile({ k, links }: { k: KpiStat; links: { id: string; title: string; band: string }[] }) {
  const t = await getT();
  const d = change(k);
  const first = links[0];
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] text-muted">{t(k.name)}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
          <Dot tone={k.status} />
          {STATUS_WORD[k.status] ? t(STATUS_WORD[k.status]) : ""}
        </span>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
        <div className="flex flex-col">
          <span className="flex items-baseline gap-2">
            <span className="num text-[26px] font-semibold leading-tight tracking-tight">
              {fmtKpi(k.value, k.unit)}
            </span>
            {d && (
              <span className={`num text-[13px] font-semibold ${d.good ? "text-good" : "text-p1"}`}>
                {d.text.replace(" pts", ` ${t("pts")}`)}
              </span>
            )}
          </span>
          <span className="text-xs text-muted">
            {k.target !== null
              ? t("Target {value}", { value: fmtKpi(k.target, k.unit) })
              : t("Usual {value}", { value: fmtKpi(k.usual, k.unit) })}{" "}
            · {t("vs last week")}
          </span>
        </div>
        {k.series.length > 1 && (
          <LineChart
            days={k.series}
            unit={k.unit}
            compact
            height={40}
            expectedLabel={k.target !== null ? "target" : "usual"}
          />
        )}
      </div>
      {first ? (
        <Link
          href={`/insights/${first.id}`}
          className="flex min-w-0 items-center gap-2 border-t border-line pt-2 text-xs text-ink no-underline hover:underline"
        >
          <span className="shrink-0 text-muted">{t("Explained by")}</span>
          <Band band={first.band} />
          <span className="truncate">{first.title}</span>
          {links.length > 1 && <span className="shrink-0 text-muted">+{links.length - 1}</span>}
        </Link>
      ) : k.status === "bad" ? (
        <p className="border-t border-line pt-2 text-xs text-warn">{t("No insight explains this yet.")}</p>
      ) : (
        <p className="border-t border-line pt-2 text-xs text-muted">{t("No open item on this result.")}</p>
      )}
    </Card>
  );
}

const MIX_STYLE: Record<string, string> = {
  P1: "bg-p1",
  P2: "bg-warn",
  P3: "bg-accent",
  P4: "bg-line",
  O1: "bg-good",
  O2: "bg-good/50",
  O3: "bg-line",
};

/** Band mix as one thin stacked bar with a labeled legend (counts never carried by colour alone). */
function BandMix({
  mix,
  ws,
  unitId,
}: {
  mix: { band: string; count: number }[];
  ws: "risk" | "opportunity";
  unitId?: string;
}) {
  const total = mix.reduce((a, m) => a + m.count, 0);
  if (total === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {mix
          .filter((m) => m.count > 0)
          .map((m) => (
            <span key={m.band} className={`h-full ${MIX_STYLE[m.band]}`} style={{ flexGrow: m.count }} />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {mix.map((m) => (
          <Link
            key={m.band}
            href={laneHref(ws, unitId, m.band)}
            className={`flex items-center gap-1.5 no-underline hover:underline ${m.count ? "text-ink" : "text-muted"}`}
          >
            <span className={`inline-block h-2 w-2 rounded-sm ${MIX_STYLE[m.band]}`} />
            {m.band} <span className="font-semibold">{m.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Summary of one workstream: band mix, value at stake, the top three, and a link to the full tab. */
export async function WorkstreamSummary({ v, ws, unitId }: { v: View; ws: "risk" | "opportunity"; unitId?: string }) {
  const t = await getT();
  const items = v.items.filter((i) => i.workstream === ws);
  const mix = ws === "risk" ? v.workstreams.risks : v.workstreams.opportunities;
  const top = items.slice(0, 3);
  const label = ws === "risk" ? t("Risks") : t("Opportunities");
  const money =
    ws === "risk"
      ? t("{money}/week at stake", { money: fmtIls(v.workstreams.atStakeIls) })
      : t("{money}/week upside", { money: fmtIls(v.workstreams.upsideIls) });
  return (
    <Card className="flex min-w-0 flex-col gap-4">
      <SectionTitle aside={<span className="text-xs text-muted">{items.length ? money : ""}</span>}>
        {label} · {items.length}
      </SectionTitle>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{ws === "risk" ? t("No open risks here.") : t("No opportunities here.")}</p>
      ) : (
        <>
          <BandMix mix={mix} ws={ws} unitId={unitId} />
          <ul className="flex flex-col divide-y divide-line">
            {top.map((i, n) => (
              <SummaryRow key={i.id} i={i} detail={n === 0} />
            ))}
          </ul>
        </>
      )}
      <Link href={laneHref(ws, unitId)} className="mt-auto text-sm text-accent">
        {items.length > 1
          ? ws === "risk"
            ? t("All {n} risks →", { n: items.length })
            : t("All {n} opportunities →", { n: items.length })
          : items.length === 1
            ? ws === "risk"
              ? t("Open the risk list →")
              : t("Open the opportunity list →")
            : ws === "risk"
              ? t("Open Risks →")
              : t("Open Opportunities →")}
      </Link>
    </Card>
  );
}

async function SummaryRow({ i, detail }: { i: Item; detail: boolean }) {
  const t = await getT();
  return (
    <li className="py-2.5 first:pt-0">
      <Link href={`/insights/${i.id}`} className="flex flex-col gap-1 text-ink no-underline hover:[&_.t]:underline">
        <span className="flex items-start gap-3">
          <Band band={i.band} score={i.score} />
          <span className="t min-w-0 flex-1 text-sm font-semibold leading-snug">{i.title}</span>
          {i.waiting && (
            <span className="hidden shrink-0 text-xs text-warn md:inline">
              {i.waiting.replace(/^(Decision by the manager of |החלטה בידי המנהל\/ת של )/, `${t("Decision")}: `)}
            </span>
          )}
        </span>
        {detail && (
          <span className="flex flex-col gap-0.5 ps-[3.25rem] text-[13px] leading-snug">
            <span>
              <span className="text-muted">{t("Why:")} </span>
              {i.why}
              {i.local && i.local.band !== i.groupBand && (
                <span className="text-muted">
                  {" "}
                  ·{" "}
                  {t("{band} for {scope} (group {group})", {
                    band: i.local.band,
                    scope: i.local.scopeName,
                    group: i.groupBand,
                  })}
                </span>
              )}
            </span>
            {i.recommendation && (
              <span>
                <span className="text-muted">{i.workstream === "risk" ? t("Recommended:") : t("Play:")} </span>
                {i.recommendation}
              </span>
            )}
          </span>
        )}
      </Link>
    </li>
  );
}

type Changes = {
  counts: { verb: string; n: number }[];
  feed: { id: string; verb: string; band: string; insightId: string; title: string }[];
};

async function WhatChanged({ changes }: { changes: Changes }) {
  const t = await getT();
  return (
    <Card className="flex min-w-0 flex-col gap-3">
      <SectionTitle aside={<span className="text-xs text-muted">{t("last 24 h (demo clock)")}</span>}>
        {t("What changed")}
      </SectionTitle>
      {changes.counts.length === 0 ? (
        <p className="text-sm text-muted">{t("No change in the last 24 hours.")}</p>
      ) : (
        <>
          <p className="text-sm">{changes.counts.map((c) => `${c.n} ${t(c.verb).toLowerCase()}`).join(" · ")}</p>
          <ul className="flex flex-col gap-2 text-sm">
            {changes.feed.slice(0, 5).map((f) => (
              <li key={f.id} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs uppercase tracking-wide text-muted">{t(f.verb)}</span>
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
  );
}

/**
 * The dashboard. `home` renders the greeting and makes the headline the page heading; a drill-down names the unit.
 * `waiting` is shown only on the viewer's own scope; `changes` only where the read model provides them (group).
 */
export async function Dashboard({
  v,
  greeting,
  waiting,
  changes,
  deps,
  work,
}: {
  v: View;
  greeting?: string;
  waiting?: React.ReactNode;
  changes?: Changes;
  /** Phase 4: real dependencies on commitments for this scope. */
  deps?: CommitmentsView | null;
  /** Phase 4 on the home (Eran, 2026-10-05): actions & outcomes for this scope. */
  work?: { actions: ActionsView; outcomes: OutcomesView };
}) {
  const t = await getT();
  const { headline, subline } = headlineFor(v, t);
  const own = !!greeting;
  const unitId = own ? undefined : v.scope.id;
  const asOf = new Date(`${v.asOf}T00:00:00Z`);
  const weekEnd = new Date(asOf.getTime() - 86_400_000).toISOString().slice(5, 10);
  const weekStart = new Date(asOf.getTime() - 7 * 86_400_000).toISOString().slice(5, 10);
  return (
    <>
      <div className="flex flex-col gap-2">
        {v.breadcrumb.length > 1 && <Breadcrumb items={v.breadcrumb} />}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {own ? (
              <>
                <p className="text-sm text-muted">
                  {greeting} · {v.scope.name}
                </p>
                <h1 className="text-[30px] font-semibold leading-tight tracking-tight">{headline}</h1>
              </>
            ) : (
              <>
                <h1 className="text-[28px] font-semibold tracking-tight">{v.scope.name}</h1>
                <p className="text-lg leading-snug">{headline}</p>
              </>
            )}
            <p className="text-sm text-muted">{subline}</p>
          </div>
          <Pill>
            {t(TYPE_LABEL[v.scope.type])} · {t("week")}{" "}
            <span className="num">
              {weekStart} → {weekEnd}
            </span>
          </Pill>
        </div>
      </div>

      {waiting}

      <section className="flex flex-col gap-3">
        <SectionTitle
          aside={
            <span className="text-xs text-muted">{t("last 7 days vs the week before · target or usual level")}</span>
          }
        >
          {v.position === "department" ? t("Department results") : t("Key results")}
        </SectionTitle>
        {v.kpis.length === 0 ? (
          <p className="text-sm text-muted">{t("No key results are owned here.")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {v.kpis.map((k) => (
              <KpiTile key={k.code} k={k} links={v.kpiLinks[k.code] ?? []} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkstreamSummary v={v} ws="risk" unitId={unitId} />
        <WorkstreamSummary v={v} ws="opportunity" unitId={unitId} />
      </div>

      {(deps || work) && (
        <div className="grid gap-6 xl:grid-cols-2">
          {deps ? <CommitmentsSummary v={deps} unitId={unitId} /> : <div />}
          {work ? <ActionsSummary a={work.actions} o={work.outcomes} /> : <div />}
        </div>
      )}

      {"children" in v && v.position === "group" && (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card className="min-w-0">
              <SectionTitle aside={<span className="text-xs text-muted">{t("click a region to drill down")}</span>}>
                {t("Health by region")}
              </SectionTitle>
              <div className="mt-3">
                <ChildTable rows={v.children} unitLabel={t("Region")} />
              </div>
            </Card>
            {deps ? <DependenciesCard v={deps} unitId={unitId} /> : null}
          </div>
          {changes && <WhatChanged changes={changes} />}
          <DepartmentPulse pulse={v.departmentPulse} />
        </>
      )}

      {"children" in v && v.position === "region" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card className="min-w-0">
            <SectionTitle aside={<span className="text-xs text-muted">{t("items specific to a branch")}</span>}>
              {t("Branches in {name}", { name: v.scope.name })}
            </SectionTitle>
            <div className="mt-3">
              <ChildTable rows={v.children} unitLabel={t("Branch")} />
            </div>
          </Card>
          {deps ? <DependenciesCard v={deps} unitId={unitId} /> : null}
        </div>
      )}

      {"children" in v && v.position === "branch" && (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card className="min-w-0">
              <SectionTitle>{t("Net sales by day vs usual level · 4 weeks")}</SectionTitle>
              <div className="mt-3">
                <LineChart
                  days={v.kpis.find((k) => k.code === "net_sales")!.series}
                  unit="ILS"
                  height={200}
                  width={760}
                />
              </div>
            </Card>
            {deps ? <DependenciesCard v={deps} unitId={unitId} /> : null}
          </div>
          <Card className="min-w-0">
            <SectionTitle
              aside={<span className="text-xs text-muted">{t("who owns the work on this branch's items")}</span>}
            >
              {t("Open actions")} · {v.dependencies.length}
            </SectionTitle>
            <ActionList items={v.dependencies} empty={t("No open actions on this branch's items.")} />
          </Card>
        </>
      )}

      {"pulse" in v && (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
            <Card className="flex flex-col items-center justify-center gap-2 text-center">
              <SectionTitle>{t("Department health")}</SectionTitle>
              <Ring
                value={v.pulse.health}
                size={110}
                tone={HEALTH[v.pulse.status]?.tone ?? (v.pulse.status === "at_risk" ? "bad" : "watch")}
              />
              <span className="text-xs text-muted">
                {t("100 − open risks it owns and must act on, weighted by band")}
              </span>
            </Card>
            {deps ? <DependenciesCard v={deps} unitId={unitId} /> : null}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="min-w-0">
              <SectionTitle
                aside={<span className="text-xs text-muted">{t("actions other departments own on our items")}</span>}
              >
                {t("We depend on")} · {v.weDependOn.length}
              </SectionTitle>
              <ActionList items={v.weDependOn} empty={t("This department's items don't wait on other departments.")} />
            </Card>
            <Card className="min-w-0">
              <SectionTitle
                aside={<span className="text-xs text-muted">{t("our actions on other departments' items")}</span>}
              >
                {t("Others depend on us")} · {v.dependOnUs.length}
              </SectionTitle>
              <ActionList items={v.dependOnUs} empty={t("No other department is waiting on this one.")} />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
