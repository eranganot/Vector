/**
 * Report data (plan v2, E5; reports.md §2–§3): resolves each block of a report layout from the same read models as the
 * screens (executive home, initiatives, commitments, insights), as of the demo clock. Scope: the group or a department
 * the viewer may read (ADR-008); a block may narrow to a department inside the report's scope. Read-only.
 */
import { and, arrayOverlaps, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { addDays } from "@/domain/calendar";
import { dependencyStatus } from "@/domain/commitments";
import { hasPermission } from "@/domain/policy/permissions";
import { METRICS, periodWeeks, type Block, type Layout, type MetricId } from "@/domain/report";
import type { Actor } from "@/domain/types";
import {
  barrier,
  commitment,
  decision,
  demoClock,
  dependency,
  finAccount,
  finActual,
  finBudget,
  initiative,
  insight,
  orgUnit,
  report as reportT,
  reportLayout,
  user as userT,
} from "@/infra/db/schema";
import type { DbOrTx } from "../db";
import { DEPARTMENT_MONEY, executiveHome, Ledger, monthOf, type ExecutiveHome, type MoneyLine } from "./executive";
import { peopleWithAssignments, readScope } from "./insights";

const DAY = 86_400_000;

/** ISO week number of a day ("2026-10-21" → 43). */
function isoWeek(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / DAY - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

export type ReportScopeOption = { unitId: string; name: string; kind: "group" | "department" };

/** Units the viewer may generate a report for: the group (C-suite who read it) and the departments they read. */
export async function reportScopes(db: DbOrTx, orgId: string, actor: Actor): Promise<ReportScopeOption[]> {
  const home = await executiveHome(db, orgId, actor);
  if (!home) return [];
  const depts = home.departments.map((d) => ({ unitId: d.unitId, name: d.name, kind: "department" as const }));
  return home.scope.readsGroup
    ? [{ unitId: home.scope.unitId, name: home.scope.name, kind: "group" }, ...depts]
    : depts;
}

export type ResolvedBlock = Block & { title: string; scopeName: string; data: BlockData };

export type Row = {
  label: string;
  values: (number | string | null)[];
  tone?: "good" | "watch" | "bad" | null;
  sub?: string;
};

export type BlockData =
  | { type: "headline"; health: number; change: number; status: string; sentences: Sentence[] }
  | { type: "series"; unit: "ils"; line: string; points: { label: string; actual: number; budget: number }[] }
  | {
      type: "bars";
      unit: "pct" | "ils" | "score";
      rows: { label: string; value: number; reference?: number; tone: string }[];
    }
  | { type: "ring"; value: number; total: number; label: string; rows: Row[]; columns: string[] }
  | { type: "table"; columns: string[]; rows: Row[]; empty?: string; more?: number }
  | {
      type: "waterfall";
      unit: "ils";
      start: { label: string; value: number };
      steps: { label: string; value: number }[];
      end: { label: string; value: number };
    }
  | { type: "empty"; reason: string };

/** A sentence from a template (FB-11), with its parameters; the screen translates it. */
export type Sentence = { text: string; params?: Record<string, string | number> };

type Tone = "good" | "watch" | "bad";
/** Response states in words the screens already use (executive home "Risks & opportunities"). */
const RESPONSE_WORD: Record<string, string> = {
  proposed: "proposed",
  pending_approval: "approval",
  ready: "ready",
  executing: "executing",
  executed: "done",
  failed: "failed",
  cancelled: "cancelled",
  recommended: "to decide",
  accepted: "accepted",
  declined: "declined",
};
const toneOfGap = (gapPct: number): Tone => (gapPct >= 0 ? "good" : gapPct > -3 ? "watch" : "bad");
const toneOfStatus = (s: string): Tone => (s === "healthy" ? "good" : s === "watch" ? "watch" : "bad");

export async function resolveReport(
  db: DbOrTx,
  orgId: string,
  actor: Actor,
  input: { scopeUnitId: string; layout: Layout },
) {
  const scopes = await reportScopes(db, orgId, actor);
  const scope = scopes.find((s) => s.unitId === input.scopeUnitId);
  if (!scope) return null;
  const inScope = (unitId: string | null) =>
    !!unitId && scopes.some((s) => s.unitId === unitId) && (scope.kind === "group" || unitId === scope.unitId);
  const homes = new Map<string, ExecutiveHome>();
  const homeFor = async (unitId: string) => {
    if (!homes.has(unitId)) {
      const h = await executiveHome(
        db,
        orgId,
        actor,
        scopes.find((s) => s.unitId === unitId)?.kind === "group" ? {} : { unitId },
      );
      homes.set(unitId, h!);
    }
    return homes.get(unitId)!;
  };
  const [clock] = await db.select().from(demoClock).where(eq(demoClock.orgId, orgId));
  const now = clock?.now ?? new Date();
  const asOf = now.toISOString().slice(0, 10);
  const units = await db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId));
  const unit = new Map(units.map((u) => [u.id, u]));

  const blocks: ResolvedBlock[] = [];
  for (const b of input.layout.blocks) {
    const unitId = b.scopeUnitId && inScope(b.scopeUnitId) ? b.scopeUnitId : scope.unitId;
    const kind = scopes.find((s) => s.unitId === unitId)!.kind;
    const home = await homeFor(unitId);
    const data = await resolveBlock(b, { unitId, kind, home, asOf, now, unit });
    blocks.push({
      ...b,
      scopeUnitId: unitId === scope.unitId ? null : unitId,
      title: METRICS[b.metric].title,
      scopeName: unit.get(unitId)?.name ?? scope.name,
      data,
    });
  }
  return { asOf, scope, scopes, blocks };

  async function resolveBlock(
    b: Block,
    c: {
      unitId: string;
      kind: "group" | "department";
      home: ExecutiveHome;
      asOf: string;
      now: Date;
      unit: Map<string, (typeof units)[number]>;
    },
  ): Promise<BlockData> {
    const { home } = c;
    const lines: MoneyLine[] = c.kind === "group" ? home.groupLines : (home.financials[0]?.lines ?? []);
    switch (b.metric as MetricId) {
      case "headline": {
        const sentences: Sentence[] = [];
        const h = home.tiles.health;
        sentences.push({
          text: "Health is {score} ({change} in a week).",
          params: { score: Math.round(h.score), change: `${h.change >= 0 ? "+" : ""}${h.change}` },
        });
        const hl = home.tiles.headline;
        if (hl)
          sentences.push({
            text: "{line}: {gap}% vs budget month to date.",
            params: { line: hl.name, gap: `${hl.gapPct >= 0 ? "+" : ""}${hl.gapPct.toFixed(1)}` },
          });
        for (const d of [...home.departments]
          .filter((d) => d.change < 0)
          .sort((a, b) => a.change - b.change)
          .slice(0, 3))
          sentences.push({
            text: d.cause?.name ? "{dept} fell {points} points — {cause}." : "{dept} fell {points} points.",
            params: { dept: d.name, points: Math.abs(d.change).toFixed(1), cause: d.cause?.name ?? "" },
          });
        if (home.tiles.p1.count)
          sentences.push({
            text: "{n} P1 risks, {ils} a week at stake.",
            params: { n: home.tiles.p1.count, ils: Math.round(home.tiles.p1.ils) },
          });
        return { type: "headline", health: Math.round(h.score), change: h.change, status: h.status, sentences };
      }
      case "health_by_department": {
        const rows = [...home.departments]
          .sort((a, b) => a.score - b.score)
          .map((d) => ({
            label: d.name,
            value: Math.round(d.score),
            tone: toneOfStatus(d.status),
          }));
        if (b.kind === "table")
          return {
            type: "table",
            columns: ["Department", "Health", "Change", "Cause"],
            rows: home.departments.map((d) => ({
              label: d.name,
              values: [Math.round(d.score), d.change, d.cause?.name ?? "—"],
              tone: toneOfStatus(d.status),
            })),
          };
        return { type: "bars", unit: "score", rows };
      }
      case "sales_vs_budget":
      case "headcount_cost": {
        const code =
          b.metric === "headcount_cost"
            ? "headcount_cost"
            : c.kind === "group"
              ? "rev_net_sales"
              : home.monthChart.code;
        const deptCode = c.kind === "department" ? c.unit.get(c.unitId)?.code : null;
        if (
          b.metric === "headcount_cost" &&
          c.kind === "department" &&
          !(DEPARTMENT_MONEY[deptCode ?? ""] ?? []).includes(code)
        )
          return { type: "empty", reason: "Headcount cost is reported by HR and the group." };
        const series = await weekly(code, periodWeeks(b.period), c.kind === "department" ? c.unitId : null);
        const [acct] = await db
          .select({ name: finAccount.name })
          .from(finAccount)
          .where(and(eq(finAccount.orgId, orgId), eq(finAccount.code, code)));
        const line = lines.find((l) => l.code === code)?.name ?? acct?.name ?? code;
        if (b.kind === "table")
          return {
            type: "table",
            columns: ["Week", "Actual", "Budget", "vs budget"],
            rows: series.map((p) => ({
              label: p.label,
              values: [
                p.actual,
                p.budget,
                p.budget ? `${(((p.actual - p.budget) / p.budget) * 100).toFixed(1)}%` : "—",
              ],
            })),
          };
        return { type: "series", unit: "ils", line, points: series };
      }
      case "pnl_vs_budget": {
        if (b.kind === "waterfall") {
          const ls = lines.filter((l) => l.unit === "ils");
          const diff = ls.map((l) => ({
            label: l.name,
            value: Math.round((l.actual - l.budget) * (l.higherIsBetter ? 1 : -1)),
          }));
          return {
            type: "waterfall",
            unit: "ils",
            start: { label: "Budget", value: 0 },
            steps: diff,
            end: { label: "vs budget", value: diff.reduce((a, d) => a + d.value, 0) },
          };
        }
        if (b.kind === "table")
          return {
            type: "table",
            columns: ["Line", "Month to date", "Budget", "Gap"],
            rows: lines.map((l) => ({
              label: l.name,
              values: [
                Math.round(l.actual),
                Math.round(l.budget),
                `${l.gapPct >= 0 ? "+" : ""}${l.gapPct.toFixed(1)}%`,
              ],
              tone: toneOfGap(l.gapPct),
            })),
          };
        return {
          type: "bars",
          unit: "pct",
          rows: lines.map((l) => ({ label: l.name, value: Math.round(l.gapPct * 10) / 10, tone: toneOfGap(l.gapPct) })),
        };
      }
      case "projection": {
        const rows = lines
          .filter((l) => l.eom || l.eoq)
          .map((l) => ({
            label: l.name,
            values: [
              l.eom ? Math.round(l.eom.mid) : null,
              l.eom ? `${l.eom.gapPct >= 0 ? "+" : ""}${l.eom.gapPct.toFixed(1)}%` : "—",
              l.eoq ? Math.round(l.eoq.mid) : null,
              l.eoq ? `${l.eoq.gapPct >= 0 ? "+" : ""}${l.eoq.gapPct.toFixed(1)}%` : "—",
            ],
            tone: l.eoq ? toneOfGap(l.eoq.gapPct) : null,
          }));
        if (b.kind === "table")
          return { type: "table", columns: ["Line", "End of month", "vs budget", "End of quarter", "vs budget"], rows };
        return {
          type: "bars",
          unit: "pct",
          rows: lines
            .filter((l) => l.eoq)
            .map((l) => ({
              label: l.name,
              value: Math.round(l.eoq!.gapPct * 10) / 10,
              tone: toneOfGap(l.eoq!.gapPct),
            })),
        };
      }
      case "opex_vs_budget": {
        const costs =
          c.kind === "group"
            ? home.financials.flatMap((f) =>
                f.lines
                  .filter((l) => !l.higherIsBetter && l.unit === "ils")
                  .map((l) => ({ ...l, name: `${l.name} · ${f.name}` })),
              )
            : lines.filter((l) => !l.higherIsBetter && l.unit === "ils");
        const pct = (l: MoneyLine) => (l.budget ? Math.round((l.actual / l.budget) * 1000) / 10 : 0);
        if (b.kind === "table")
          return {
            type: "table",
            columns: ["Cost", "Month to date", "Budget", "% of budget"],
            rows: costs.map((l) => ({
              label: l.name,
              values: [Math.round(l.actual), Math.round(l.budget), `${pct(l)}%`],
              tone: toneOfGap(l.gapPct),
            })),
          };
        return {
          type: "bars",
          unit: "pct",
          rows: costs.map((l) => ({ label: l.name, value: pct(l), reference: 100, tone: toneOfGap(l.gapPct) })),
        };
      }
      case "kpis_on_target": {
        const ms = home.departments.flatMap((d) =>
          d.measures.filter((m) => m.kind === "kpi").map((m) => ({ ...m, dept: d.name })),
        );
        const on = ms.filter((m) => m.gap >= 0);
        const rows = ms
          .sort((a, b) => a.gap - b.gap)
          .map((m) => ({
            label: m.name,
            sub: m.dept,
            values: [m.value, m.reference, `${m.gap >= 0 ? "+" : ""}${m.gap.toFixed(1)}%`] as (number | string)[],
            tone: toneOfGap(m.gap),
          }));
        if (b.kind === "table") return { type: "table", columns: ["KPI", "Value", "Reference", "Gap"], rows };
        return {
          type: "ring",
          value: on.length,
          total: ms.length,
          label: "KPIs on target",
          rows: rows.slice(0, 5),
          columns: ["KPI", "Value", "Reference", "Gap"],
        };
      }
      case "initiatives_status": {
        const list = await initiativesIn(c.kind === "department" ? c.unitId : null);
        const rows = list.map((i) => ({
          label: i.title,
          sub: i.next ?? undefined,
          values: [i.status.replace("_", " "), i.nextDue ?? "—", i.blockers],
          tone:
            i.status === "on_track" || i.status === "done"
              ? ("good" as const)
              : i.status === "at_risk"
                ? ("watch" as const)
                : ("bad" as const),
        }));
        if (b.kind === "table")
          return {
            type: "table",
            columns: ["Initiative", "Status", "Next milestone due", "Open barriers"],
            rows,
            empty: "No initiative in this scope.",
          };
        return {
          type: "ring",
          value: list.filter((i) => i.status === "on_track" || i.status === "done").length,
          total: list.length,
          label: "initiatives on track",
          rows,
          columns: ["Initiative", "Status", "Next milestone due", "Open barriers"],
        };
      }
      case "blockers": {
        const rows = await blockersIn(c.kind === "department" ? c.unitId : null);
        return {
          type: "table",
          columns: ["Blocker", "Owner", "Since or due", "₪ at stake"],
          rows,
          empty: "No blocker in this scope.",
        };
      }
      case "decisions_needed": {
        const rows = await decisionsIn(c.kind === "department" ? c.unitId : null);
        return {
          type: "table",
          columns: ["Decision", "Who decides", "By", "₪ a week"],
          rows: rows.slice(0, 12),
          empty: "No decision is waiting.",
          more: Math.max(0, rows.length - 12),
        };
      }
      case "focus_next_week": {
        const rows = home.focus.slice(0, 5).map((f) => ({
          label: f.title,
          values: [
            Math.round(f.ils),
            f.hoursLeft !== null ? (f.hoursLeft <= 0 ? "now" : `${Math.round(f.hoursLeft / 24)} d`) : "—",
          ],
          tone: f.kind === "opportunity" ? ("good" as const) : ("bad" as const),
        }));
        if (b.kind === "table")
          return { type: "table", columns: ["Focus", "₪ a week", "Time left"], rows, empty: "Nothing needs focus." };
        return {
          type: "headline",
          health: Math.round(home.tiles.health.score),
          change: home.tiles.health.change,
          status: home.tiles.health.status,
          sentences: home.focus.slice(0, 3).map((f, k) => ({
            text: "{n}. {title} ({ils} a week).",
            params: { n: k + 1, title: f.title, ils: Math.round(f.ils) },
          })),
        };
      }
      case "health_by_region": {
        const regions = home.regions;
        if (!regions.length) return { type: "empty", reason: "Region health is shown for the group." };
        if (b.kind === "table")
          return {
            type: "table",
            columns: ["Region", "Health", "Change"],
            rows: regions.map((r) => ({
              label: r.name,
              values: [Math.round(r.score), r.change],
              tone: toneOfStatus(r.status),
            })),
          };
        return {
          type: "bars",
          unit: "score",
          rows: [...regions]
            .sort((a, b) => a.score - b.score)
            .map((r) => ({ label: r.name, value: Math.round(r.score), tone: toneOfStatus(r.status) })),
        };
      }
      case "top_risks_opportunities": {
        const row = (r: ExecutiveHome["risks"][number], opp: boolean) => ({
          label: r.title,
          sub: r.band,
          values: [
            Math.round(r.ils),
            `${Math.round(r.confidence * 100)}%`,
            RESPONSE_WORD[r.response ?? ""] ?? "no response yet",
          ] as (string | number)[],
          tone: opp ? ("good" as const) : r.band === "P1" ? ("bad" as const) : ("watch" as const),
        });
        return {
          type: "table",
          columns: ["Risk or opportunity", "₪ a week", "Confidence", "Response"],
          rows: [
            ...home.risks.slice(0, 5).map((r) => row(r, false)),
            ...home.opportunities.slice(0, 3).map((r) => row(r, true)),
          ],
          empty: "No risk or opportunity in this scope.",
        };
      }
    }
    return { type: "empty", reason: "Unknown block." };
  }

  /** The last `weeks` full weeks (7-day windows ending yesterday): actual vs budget for one line. */
  async function weekly(code: string, weeks: number, deptId: string | null) {
    const from = addDays(asOf, -7 * weeks);
    const [acts, buds] = await Promise.all([
      db
        .select({
          accountCode: finActual.accountCode,
          orgUnitId: finActual.orgUnitId,
          day: finActual.day,
          amount: finActual.amount,
        })
        .from(finActual)
        .where(
          and(
            eq(finActual.orgId, orgId),
            eq(finActual.accountCode, code),
            gte(finActual.day, from),
            lt(finActual.day, asOf),
          ),
        ),
      db
        .select({
          accountCode: finBudget.accountCode,
          orgUnitId: finBudget.orgUnitId,
          month: finBudget.month,
          amount: finBudget.amount,
        })
        .from(finBudget)
        .where(
          and(
            eq(finBudget.orgId, orgId),
            eq(finBudget.accountCode, code),
            eq(finBudget.version, 1),
            gte(finBudget.month, monthOf(from)),
            lte(finBudget.month, monthOf(asOf)),
          ),
        ),
    ]);
    // A department's own opex line sits on its unit; every other line is the whole organization's.
    const keep = (u: string) => code !== "dept_opex" || !deptId || u === deptId;
    const ledger = new Ledger(
      acts.filter((r) => keep(r.orgUnitId)),
      buds.filter((r) => keep(r.orgUnitId)),
    );
    const out: { label: string; actual: number; budget: number }[] = [];
    for (let w = weeks; w >= 1; w--) {
      const start = addDays(asOf, -7 * w);
      const end = addDays(start, 7);
      const t = ledger.toDate(code, start, end);
      out.push({ label: `W${isoWeek(addDays(end, -1))}`, actual: Math.round(t.actual), budget: Math.round(t.budget) });
    }
    return out;
  }

  async function initiativesIn(deptId: string | null) {
    const scope = readScope(actor);
    const rows = await db
      .select()
      .from(initiative)
      .where(and(eq(initiative.orgId, orgId), arrayOverlaps(initiative.visibleUnitIds, scope)));
    const shown = deptId ? rows.filter((i) => i.participatingUnitIds.includes(deptId)) : rows;
    if (!shown.length) return [];
    const { initiativesView } = await import("./initiatives");
    const v = await initiativesView(db, orgId, actor);
    if (!v || "notFound" in v) return [];
    return v.items
      .filter((i) => shown.some((s) => s.id === i.id))
      .map((i) => ({
        title: i.title,
        status: i.status,
        next: i.next ? i.next.title : null,
        nextDue: i.next ? i.next.dueOn : null,
        blockers: i.barriers.length,
      }));
  }

  async function blockersIn(deptId: string | null): Promise<Row[]> {
    const scope = readScope(actor);
    const [inits, cs, deps] = await Promise.all([
      db
        .select()
        .from(initiative)
        .where(and(eq(initiative.orgId, orgId), arrayOverlaps(initiative.visibleUnitIds, scope))),
      db
        .select()
        .from(commitment)
        .where(and(eq(commitment.orgId, orgId), arrayOverlaps(commitment.visibleUnitIds, scope))),
      db.select().from(dependency).where(eq(dependency.orgId, orgId)),
    ]);
    const bars = inits.length
      ? await db
          .select()
          .from(barrier)
          .where(
            inArray(
              barrier.initiativeId,
              inits.map((i) => i.id),
            ),
          )
      : [];
    const name = (id: string) => unit.get(id)?.name ?? "—";
    const mine = (unitId: string) => !deptId || unitId === deptId;
    const rows: Row[] = [];
    for (const b of bars.filter((x) => !x.resolvedOn && mine(x.ownerUnitId)))
      rows.push({
        label: b.title,
        sub: inits.find((i) => i.id === b.initiativeId)?.title,
        values: [name(b.ownerUnitId), b.since, Number(b.costIls) || null],
        tone: "bad",
      });
    for (const c of cs.filter((x) => x.status === "overdue" && mine(x.ownerUnitId))) {
      const waiting = deps.filter((d) => d.commitmentId === c.id);
      rows.push({
        label: c.title,
        sub: waiting.length ? waiting.map((d) => name(d.downstreamUnitId)).join(", ") : undefined,
        values: [
          name(c.ownerUnitId),
          c.dueAt.toISOString().slice(0, 10),
          Math.max(
            Number(c.impactIls),
            waiting.reduce((a, d) => a + Number(d.impactIls), 0),
          ) || null,
        ],
        tone: "bad",
      });
    }
    for (const d of deps) {
      const c = cs.find((x) => x.id === d.commitmentId);
      if (!c || c.status === "overdue" || !(mine(c.ownerUnitId) || mine(d.downstreamUnitId))) continue;
      if (dependencyStatus(d, c, now) !== "blocked") continue;
      rows.push({
        label: c.title,
        sub: name(d.downstreamUnitId),
        values: [name(c.ownerUnitId), d.needBy.toISOString().slice(0, 10), Number(d.impactIls) || null],
        tone: "watch",
      });
    }
    return rows;
  }

  async function decisionsIn(deptId: string | null): Promise<Row[]> {
    const scope = readScope(actor);
    const ins = await db
      .select()
      .from(insight)
      .where(and(eq(insight.orgId, orgId), arrayOverlaps(insight.visibleUnitIds, scope)));
    const live = ins.filter(
      (i) => (i.status === "open" || i.status === "acknowledged") && (!deptId || i.ownerDepartmentId === deptId),
    );
    if (!live.length) return [];
    const decs = await db
      .select()
      .from(decision)
      .where(
        and(
          inArray(
            decision.insightId,
            live.map((i) => i.id),
          ),
          eq(decision.status, "recommended"),
        ),
      );
    const people = await peopleWithAssignments(db, orgId);
    const deciders = (primaryUnitId: string) => {
      for (const u of [...(unit.get(primaryUnitId)?.pathIds ?? [])].reverse()) {
        const found = [...people.entries()]
          .filter(([, p]) => p.assignments.some((a) => a.unit.id === u && hasPermission(a.role, "decision.decide")))
          .map(([, p]) => p.name);
        if (found.length) return found;
      }
      return [];
    };
    return decs
      .map((d) => {
        const i = live.find((x) => x.id === d.insightId)!;
        const input = ((i.priorityBreakdown as { input?: Record<string, unknown> })?.input ?? {}) as Record<
          string,
          unknown
        >;
        const ils = Number((i.workstream === "risk" ? input.impactIls : input.valueIls) ?? 0);
        const hours = (i.workstream === "risk" ? input.hoursToImpact : input.hoursToClose) as number | undefined;
        const by =
          typeof hours === "number"
            ? new Date(i.createdAt.getTime() + hours * 3_600_000).toISOString().slice(0, 10)
            : null;
        return { i, d, ils, by };
      })
      .sort((a, b) => b.ils - a.ils)
      .map(({ i, d, ils, by }) => ({
        label: d.statement,
        sub: `${i.priorityBand} · ${i.title}`,
        values: [deciders(i.primaryUnitId).join(", ") || "—", by ?? "—", ils || null],
        tone:
          i.workstream === "opportunity"
            ? ("good" as const)
            : i.priorityBand === "P1"
              ? ("bad" as const)
              : ("watch" as const),
      }));
  }
}

export type ResolvedReport = NonNullable<Awaited<ReturnType<typeof resolveReport>>>;

/** Reports the viewer may open: those whose scope they read (the scope unit, or a unit above it, is in their scope). */
export async function listReports(db: DbOrTx, orgId: string, actor: Actor) {
  if (actor.kind !== "user") return [];
  const scope = readScope(actor);
  const [rows, units, people] = await Promise.all([
    db.select().from(reportT).where(eq(reportT.orgId, orgId)),
    db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId)),
    db.select({ id: userT.id, name: userT.name }).from(userT).where(eq(userT.orgId, orgId)),
  ]);
  const unit = new Map(units.map((u) => [u.id, u]));
  return rows
    .filter((r) => r.visibleUnitIds.some((v) => unit.get(v)?.pathIds.some((p) => scope.includes(p))))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((r) => ({
      id: r.id,
      template: r.template,
      version: r.version,
      scopeName: unit.get(r.scopeUnitId)?.name ?? "—",
      language: r.language,
      asOf: r.asOf,
      by: people.find((p) => p.id === r.generatedBy)?.name ?? "—",
      contentHash: r.contentHash,
    }));
}

export async function getReport(db: DbOrTx, orgId: string, actor: Actor, id: string) {
  const visible = await listReports(db, orgId, actor);
  if (!visible.some((r) => r.id === id)) return null;
  const [r] = await db
    .select()
    .from(reportT)
    .where(and(eq(reportT.orgId, orgId), eq(reportT.id, id)));
  const meta = visible.find((x) => x.id === id)!;
  return {
    ...meta,
    layout: r.layout as Layout,
    content: r.content as { model: string; asOf: string; scope: ReportScopeOption; blocks: ResolvedBlock[] },
  };
}

/** The viewer's own saved versions of the templates (G-E5a). */
export async function myReportLayouts(db: DbOrTx, orgId: string, actor: Actor) {
  if (actor.kind !== "user") return [];
  const rows = await db
    .select()
    .from(reportLayout)
    .where(and(eq(reportLayout.orgId, orgId), eq(reportLayout.ownerUserId, actor.userId)));
  return rows
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((r) => ({ id: r.id, name: r.name, template: r.template, layout: r.layout, updatedAt: r.updatedAt }));
}
