/**
 * The C-suite home read model (plan v2, E2; docs/specs/executive-home.md). Everything is derived at read time from
 * stored KPI observations, money lines, budgets, insights, decisions, actions, commitments and initiatives, with the
 * deterministic models health-v2 and projection-v1. Nothing here writes.
 *
 * Scope (ADR-008): a viewer who reads the group gets all eight departments and the regions; anyone else gets the
 * departments they may read. Reading a department shows its group-wide lines (its KPIs over every branch and its
 * money lines in total), because the department owns them.
 */
import { and, arrayOverlaps, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { addDays, tradingWeight } from "@/domain/calendar";
import { decompose, health, round1, statusOf, type HealthResult, type Measure } from "@/domain/health";
import { direction, project, PROJECTION_MODEL, type Projection } from "@/domain/projection";
import type { Actor } from "@/domain/types";
import { dependencyStatus } from "@/domain/commitments";
import {
  action,
  barrier,
  commitment,
  conflict,
  dependency,
  decision,
  demoClock,
  finAccount,
  finActual,
  finBudget,
  initiative,
  insight,
  kpi,
  kpiObservation,
  orgUnit,
  signal,
} from "@/infra/db/schema";
import type { DbOrTx } from "../db";
import { listMyApprovals, listMyDecisions, readScope } from "./insights";
import { canReadUnit, kpiStat, positionOf } from "./performance";

type Unit = typeof orgUnit.$inferSelect;
type Kpi = typeof kpi.$inferSelect;
type Obs = { kpiId: string; orgUnitId: string; day: string; value: number };

/** The money lines on each department's tile and in Financials (executive-home.md §6). First line = headline line. */
export const DEPARTMENT_MONEY: Record<string, string[]> = {
  "D-STORE": ["rev_net_sales", "labor_cost", "shrink_cost", "dept_opex"],
  "D-TRADE": ["gm_amount", "cogs", "dept_opex"],
  "D-SUPPLY": ["logistics_cost", "inventory_days", "waste_cost", "dept_opex"],
  "D-MKT": ["mkt_spend", "mkt_incremental", "dept_opex"],
  "D-FIN": ["op_profit", "dept_opex"],
  "D-HR": ["headcount_cost", "overtime_cost", "dept_opex"],
  "D-LEGAL": ["penalty_exposure", "dept_opex"],
  "D-IT": ["it_opex", "it_capex", "dept_opex"],
};

/** Operating profit (EBITDA), derived exactly as financials.md §1: gross margin less the operating cost lines. */
const OP_PROFIT: [string, number][] = [
  ["gm_amount", 1],
  ["labor_cost", -1],
  ["logistics_cost", -1],
  ["occupancy_cost", -1],
  ["mkt_spend", -1],
  ["it_opex", -1],
  ["dept_opex", -1],
];
/** Lines spread evenly over the days of the month; every other ₪ line follows the trading calendar. */
const FLAT = new Set(["occupancy_cost", "dept_opex", "it_capex"]);
/** Balance lines: the latest value against the budgeted level, not a sum. */
const LEVEL = new Set(["inventory_days", "penalty_exposure"]);
/** Penalty exposure has a zero budget: ₪5,000 of exposure costs one point of attainment. */
const PENALTY_ILS_PER_POINT = 5_000;

const URGENT_HOURS = 72;
const SOON_HOURS = 168;

const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const monthOf = (day: string) => day.slice(0, 7);
function quarterStart(day: string) {
  const m = Number(day.slice(5, 7));
  return `${day.slice(0, 4)}-${String(m - ((m - 1) % 3)).padStart(2, "0")}-01`;
}
function monthEnd(day: string) {
  let d = `${monthOf(day)}-01`;
  while (monthOf(addDays(d, 1)) === monthOf(day)) d = addDays(d, 1);
  return d;
}
function quarterEnd(day: string) {
  const qs = quarterStart(day);
  return monthEnd(`${qs.slice(0, 5)}${String(Number(qs.slice(5, 7)) + 2).padStart(2, "0")}-01`);
}
function daysIn(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export type MoneyLine = {
  code: string;
  name: string;
  unit: "ils" | "days";
  higherIsBetter: boolean;
  /** Month to date (sum), or the latest level for balance lines. */
  actual: number;
  budget: number;
  /** Signed %, negative when worse. */
  gapPct: number;
  eom: Projection | null;
  eoq: Projection | null;
  /** Projected ₪ shortfall at end of month (0 when on track). */
  eomShortfallIls: number;
  /** ₪ per week the line is running behind budget now (from the recent run-rate; 0 when at or better). */
  weeklyGapIls: number;
};

/**
 * The money ledger for one scope (all regions, or one): daily actuals and daily budgets per account, summed over the
 * scope's units. Derived lines are computed per day from their components.
 */
class Ledger {
  private actual = new Map<string, Map<string, number>>();
  private budgetMonth = new Map<string, Map<string, number>>();
  private weightCache = new Map<string, number>();

  constructor(
    actuals: { accountCode: string; day: string; amount: number }[],
    budgets: { accountCode: string; month: string; amount: number }[],
  ) {
    for (const a of actuals) {
      const m = this.actual.get(a.accountCode) ?? new Map<string, number>();
      m.set(a.day, (m.get(a.day) ?? 0) + a.amount);
      this.actual.set(a.accountCode, m);
    }
    for (const b of budgets) {
      const m = this.budgetMonth.get(b.accountCode) ?? new Map<string, number>();
      // Balance lines budget a level: the same level on every unit of the scope (one department unit) is not summed.
      m.set(b.month, LEVEL.has(b.accountCode) ? b.amount : (m.get(b.month) ?? 0) + b.amount);
      this.budgetMonth.set(b.accountCode, m);
    }
  }

  private monthWeight(code: string, month: string) {
    const key = `${FLAT.has(code) ? "flat" : "trade"}|${month}`;
    if (!this.weightCache.has(key)) {
      const days = daysIn(`${month}-01`, monthEnd(`${month}-01`));
      this.weightCache.set(key, FLAT.has(code) ? days.length : sum(days.map(tradingWeight)));
    }
    return this.weightCache.get(key)!;
  }

  actualOn(code: string, day: string): number | null {
    if (code === "op_profit") {
      const parts = OP_PROFIT.map(([c, s]) => [this.actualOn(c, day), s] as const);
      return parts.every(([v]) => v !== null) ? sum(parts.map(([v, s]) => v! * s)) : null;
    }
    return this.actual.get(code)?.get(day) ?? null;
  }

  budgetOn(code: string, day: string): number {
    if (code === "op_profit") return sum(OP_PROFIT.map(([c, s]) => this.budgetOn(c, day) * s));
    const month = this.budgetMonth.get(code)?.get(monthOf(day)) ?? 0;
    if (LEVEL.has(code)) return month;
    return (month * (FLAT.has(code) ? 1 : tradingWeight(day))) / this.monthWeight(code, monthOf(day));
  }

  has(code: string) {
    return code === "op_profit" ? OP_PROFIT.every(([c]) => this.actual.has(c)) : this.actual.has(code);
  }

  /** To date in [from, before): sum of actuals and of budgets (the latest level for balance lines). */
  toDate(code: string, from: string, before: string) {
    const days = daysIn(from, addDays(before, -1)).filter((d) => this.actualOn(code, d) !== null);
    if (LEVEL.has(code)) {
      const last = days.at(-1);
      return { actual: last ? this.actualOn(code, last)! : 0, budget: last ? this.budgetOn(code, last) : 0, days };
    }
    return {
      actual: sum(days.map((d) => this.actualOn(code, d)!)),
      budget: sum(days.map((d) => this.budgetOn(code, d))),
      days,
    };
  }
}

type Risk = {
  id: string;
  workstream: string;
  title: string;
  band: string;
  status: string;
  confidence: number;
  ownerDepartmentId: string | null;
  primaryUnitId: string;
  affectedUnitIds: string[];
  /** ₪ per week at stake (risks) or upside (opportunities). */
  ils: number;
  costIls: number;
  hoursLeft: number | null;
  createdAt: Date;
  signalIds: string[];
};

export async function executiveHome(db: DbOrTx, orgId: string, actor: Actor, opts: { unitId?: string } = {}) {
  if (actor.kind !== "user") return null;
  const units = await db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId));
  const pos = positionOf(actor, units);
  if (!pos) return null;
  const group = units.find((u) => u.type === "group")!;
  const allDepartments = units.filter((u) => u.type === "department").sort((a, b) => a.code.localeCompare(b.code));
  const regions = units.filter((u) => u.type === "region").sort((a, b) => a.code.localeCompare(b.code));
  const branches = units.filter((u) => u.type === "branch");
  const readsGroup = canReadUnit(actor, group);
  const departments = allDepartments.filter((d) => canReadUnit(actor, d));
  if (departments.length === 0) return null;
  // A VP who reads one department lands on that department's own view (with its regions).
  const drill = opts.unitId
    ? departments.find((d) => d.id === opts.unitId)
    : !readsGroup && departments.length === 1
      ? departments[0]
      : undefined;
  if (opts.unitId && !drill) return null;
  const shown = drill ? [drill] : departments;

  // ── Time ──
  const [clock] = await db.select().from(demoClock).where(eq(demoClock.orgId, orgId));
  const now = clock?.now ?? new Date();
  const asOf = now.toISOString().slice(0, 10); // days before asOf are complete
  const last = addDays(asOf, -1);
  const weekAgo = addDays(asOf, -7);
  const mStart = `${monthOf(last)}-01`;
  const mEnd = monthEnd(last);
  const qStart = quarterStart(last);
  const qEnd = quarterEnd(last);
  const loadFrom = [qStart, addDays(asOf, -45), `${monthOf(addDays(weekAgo, -1))}-01`].sort()[0];

  // ── Data ──
  const scope = readScope(actor);
  const [kpis, accounts, actualRows, budgetRows, obs, insightRows] = await Promise.all([
    db.select().from(kpi).where(eq(kpi.orgId, orgId)),
    db.select().from(finAccount).where(eq(finAccount.orgId, orgId)),
    db
      .select({
        accountCode: finActual.accountCode,
        orgUnitId: finActual.orgUnitId,
        day: finActual.day,
        amount: finActual.amount,
      })
      .from(finActual)
      .where(and(eq(finActual.orgId, orgId), gte(finActual.day, loadFrom), lt(finActual.day, asOf))),
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
          eq(finBudget.version, 1),
          gte(finBudget.month, monthOf(loadFrom)),
          lte(finBudget.month, monthOf(qEnd)),
        ),
      ),
    db
      .select({
        kpiId: kpiObservation.kpiId,
        orgUnitId: kpiObservation.orgUnitId,
        day: kpiObservation.day,
        value: kpiObservation.value,
      })
      .from(kpiObservation)
      .where(
        and(eq(kpiObservation.orgId, orgId), gte(kpiObservation.day, addDays(asOf, -45)), lt(kpiObservation.day, asOf)),
      ) as Promise<Obs[]>,
    db
      .select()
      .from(insight)
      .where(and(eq(insight.orgId, orgId), arrayOverlaps(insight.visibleUnitIds, scope))),
  ]);
  const accountOf = new Map(accounts.map((a) => [a.code, a]));
  /** A ledger over one area: every region (null) or one region; department lines only in the whole-group area. */
  const ledgerFor = (regionId: string | null) => {
    const inArea = (unitId: string) => {
      const u = units.find((x) => x.id === unitId);
      if (!u) return false;
      if (regionId === null) return true;
      return u.type !== "department" && u.pathIds.includes(regionId);
    };
    return new Ledger(
      actualRows.filter((r) => inArea(r.orgUnitId)),
      budgetRows.filter((r) => inArea(r.orgUnitId)),
    );
  };
  const groupLedger = ledgerFor(null);
  const regionLedgers = new Map(regions.map((r) => [r.id, ledgerFor(r.id)]));

  // Department dept_opex sits on each department unit: a department's own dept_opex is its row only.
  const deptLedgers = new Map(
    allDepartments.map((d) => [
      d.id,
      new Ledger(
        actualRows.filter((r) => r.accountCode !== "dept_opex" || r.orgUnitId === d.id),
        budgetRows.filter((r) => r.accountCode !== "dept_opex" || r.orgUnitId === d.id),
      ),
    ]),
  );

  /** Operating profit is a group line: it always reads the whole group's ledger (every department's opex). */
  const lineLedger = (ledger: Ledger, code: string) => (code === "op_profit" ? groupLedger : ledger);

  // ── Risks and opportunities in scope ──
  const live = insightRows.filter((i) => i.status === "open" || i.status === "acknowledged");
  const risks: Risk[] = live.map((i) => {
    const input = ((i.priorityBreakdown as { input?: Record<string, unknown> })?.input ?? {}) as Record<
      string,
      number | string | undefined
    >;
    const hours = (i.workstream === "risk" ? input.hoursToImpact : input.hoursToClose) as number | undefined;
    const ageHours = (now.getTime() - i.createdAt.getTime()) / 3_600_000;
    return {
      id: i.id,
      workstream: i.workstream,
      title: i.title,
      band: i.priorityBand,
      status: i.status,
      confidence: i.confidence,
      ownerDepartmentId: i.ownerDepartmentId,
      primaryUnitId: i.primaryUnitId,
      affectedUnitIds: i.affectedUnitIds,
      ils: Number((i.workstream === "risk" ? input.impactIls : input.valueIls) ?? 0),
      costIls: Number(input.costIls ?? 0),
      hoursLeft: typeof hours === "number" ? hours - ageHours : null,
      createdAt: i.createdAt,
      signalIds: i.signalIds,
    };
  });
  const openRisks = risks.filter((r) => r.workstream === "risk");
  const touchesRegion = (r: Risk, regionId: string) =>
    [r.primaryUnitId, ...r.affectedUnitIds].some((id) => {
      const u = units.find((x) => x.id === id);
      return !!u && u.type !== "department" && u.type !== "group" && u.pathIds.includes(regionId);
    });
  const riskBands = (deptId: string, regionId: string | null) => {
    const owned = openRisks.filter(
      (r) => r.ownerDepartmentId === deptId && (regionId === null || touchesRegion(r, regionId)),
    );
    const involved =
      regionId === null
        ? openRisks.filter((r) => r.ownerDepartmentId !== deptId && r.affectedUnitIds.includes(deptId))
        : [];
    return { owned, involved };
  };

  // Actions in flight, for the projection's action lift.
  const actionRows = await db
    .select({
      id: action.id,
      status: action.status,
      insightId: action.insightId,
      impact: action.expectedImpactIls,
      title: action.title,
    })
    .from(action)
    .where(
      and(
        eq(action.orgId, orgId),
        arrayOverlaps(action.visibleUnitIds, scope),
        inArray(action.status, ["ready", "executing"]),
      ),
    );

  // ── Measures ──
  const branchIdsIn = (regionId: string | null) =>
    new Set(branches.filter((b) => regionId === null || b.pathIds.includes(regionId)).map((b) => b.id));
  const kpisOf = (deptId: string) => kpis.filter((k) => k.ownerDepartmentId === deptId);

  function kpiMeasures(dept: Unit, regionId: string | null, at: string): Measure[] {
    return kpisOf(dept.id)
      .filter((k) => k.level === "branch" || regionId === null)
      .map((k: Kpi) => {
        const ids = k.level === "branch" ? branchIdsIn(regionId) : new Set([dept.id]);
        const st = kpiStat(k, obs, ids, at, 0);
        return {
          code: k.code,
          name: k.name,
          kind: "kpi" as const,
          value: st.value,
          reference: k.target ?? st.usual,
          higherIsBetter: k.higherIsBetter,
        };
      })
      .filter((m) => Number.isFinite(m.value) && Number.isFinite(m.reference));
  }

  const lineName = (code: string) => (code === "op_profit" ? "Operating profit" : (accountOf.get(code)?.name ?? code));
  const lineHigher = (code: string) => (code === "op_profit" ? true : (accountOf.get(code)?.higherIsBetter ?? false));
  const displayUnit = (code: string) =>
    kpis.find((k) => k.code === code)?.unit ?? (lineUnit(code) === "days" ? "days" : "ILS");
  const lineUnit = (code: string): "ils" | "days" =>
    code === "op_profit" ? "ils" : ((accountOf.get(code)?.unit as "ils" | "days") ?? "ils");

  function moneyMeasure(ledger: Ledger, code: string, at: string): Measure | null {
    if (!ledger.has(code)) return null;
    const td = ledger.toDate(code, `${monthOf(addDays(at, -1))}-01`, at);
    if (td.days.length === 0) return null;
    const m: Measure = {
      code,
      name: lineName(code),
      kind: "money",
      value: td.actual,
      reference: td.budget,
      higherIsBetter: lineHigher(code),
    };
    if (code === "penalty_exposure") m.score = 100 - Math.min(100, td.actual / PENALTY_ILS_PER_POINT);
    return m;
  }

  function moneyMeasures(dept: Unit, regionId: string | null, at: string): Measure[] {
    const codes = DEPARTMENT_MONEY[dept.code] ?? [];
    const ledger = regionId === null ? deptLedgers.get(dept.id)! : regionLedgers.get(regionId)!;
    return codes
      .filter((c) => regionId === null || accountOf.get(c)?.level === "region")
      .map((c) => moneyMeasure(lineLedger(ledger, c), c, at))
      .filter((m): m is Measure => m !== null);
  }

  // ── Projections ──
  const recentRatios = (ledger: Ledger, code: string) =>
    daysIn(addDays(asOf, -28), last)
      .map((d) => {
        const a = ledger.actualOn(code, d);
        const b = ledger.budgetOn(code, d);
        return a !== null && b ? a / b : NaN;
      })
      .filter((r) => Number.isFinite(r));

  /**
   * Risk drag and action lift reach the P&L lines only: a risk's ₪ at stake and an action's expected impact are sales
   * figures, so they move net sales one for one and gross margin and operating profit at the budgeted margin rate.
   * Cost lines project from their run-rate alone.
   */
  const qBudget = (code: string) => sum(daysIn(qStart, qEnd).map((d) => groupLedger.budgetOn(code, d)));
  const marginRate = qBudget("rev_net_sales") ? qBudget("gm_amount") / qBudget("rev_net_sales") : 0;
  const PNL_SHARE: Record<string, number> = { rev_net_sales: 1, gm_amount: marginRate, op_profit: marginRate };

  function liftAndDrag(code: string, horizonDays: number) {
    const share = PNL_SHARE[code];
    if (!share) return { risks: [], actions: [] };
    const drag = openRisks
      .filter((r) => r.band === "P1" || r.band === "P2")
      .map((r) => ({ weeklyIls: r.ils * share, confidence: r.confidence }));
    const toEoq = Math.max(1, daysIn(asOf, qEnd).length);
    const lift = actionRows
      .filter((a) => (a.impact ?? 0) > 0)
      .map((a) => ({
        status: (a.status === "executing" ? "executing" : "approved") as "executing" | "approved",
        impactIls: ((a.impact ?? 0) * share * Math.min(horizonDays, toEoq)) / toEoq,
      }));
    return { risks: drag, actions: lift };
  }

  function projectLine(ledger: Ledger, code: string, from: string, to: string): Projection | null {
    if (!ledger.has(code) || LEVEL.has(code)) return null;
    const td = ledger.toDate(code, from, asOf);
    const rest = daysIn(asOf, to);
    const budgetRemaining = sum(rest.map((d) => ledger.budgetOn(code, d)));
    const { risks: r, actions: a } = liftAndDrag(code, rest.length);
    return project({
      actualToDate: td.actual,
      budgetRemaining,
      budgetTotal: td.budget + budgetRemaining,
      recentRatios: recentRatios(ledger, code),
      daysRemaining: rest.length,
      risks: r,
      actions: a,
      higherIsBetter: lineHigher(code),
    });
  }

  function weeklyGap(ledger: Ledger, code: string, runRate: number) {
    const behind = lineHigher(code) ? 1 - runRate : runRate - 1;
    const week = sum(daysIn(addDays(asOf, -7), last).map((d) => ledger.budgetOn(code, d)));
    return Math.max(0, Math.round(behind * week));
  }

  function moneyLines(deptLedger: Ledger, codes: string[]): MoneyLine[] {
    return codes
      .filter((c) => lineLedger(deptLedger, c).has(c))
      .map((code) => {
        const ledger = lineLedger(deptLedger, code);
        const td = ledger.toDate(code, mStart, asOf);
        const eom = projectLine(ledger, code, mStart, mEnd);
        const eoq = projectLine(ledger, code, qStart, qEnd);
        const eomBudget = eom
          ? eom.terms.actualToDate + sum(daysIn(asOf, mEnd).map((d) => ledger.budgetOn(code, d)))
          : 0;
        const shortfall = eom ? (lineHigher(code) ? eomBudget - eom.mid : eom.mid - eomBudget) : 0;
        return {
          code,
          name: lineName(code),
          unit: lineUnit(code),
          higherIsBetter: lineHigher(code),
          actual: td.actual,
          budget: td.budget,
          gapPct: td.budget ? ((td.actual - td.budget) / Math.abs(td.budget)) * 100 * (lineHigher(code) ? 1 : -1) : 0,
          eom,
          eoq,
          eomShortfallIls: Math.max(0, shortfall),
          weeklyGapIls: eom ? weeklyGap(ledger, code, eom.terms.runRate) : 0,
        };
      });
  }

  // ── Health per department (and per region inside a department) ──
  function departmentHealth(dept: Unit, regionId: string | null) {
    const { owned, involved } = riskBands(dept.id, regionId);
    const bands = { ownedRiskBands: owned.map((r) => r.band), involvedRiskBands: involved.map((r) => r.band) };
    const measures = [...kpiMeasures(dept, regionId, asOf), ...moneyMeasures(dept, regionId, asOf)];
    const nowH = health({ measures, ...bands });
    // The 7-day change is measured from results (KPIs and money). Open risks enter the level but not the change: the
    // catalog stamps every story insight on the story day, so "risks a week ago" would not be a real history.
    const beforeH = health({
      measures: [...kpiMeasures(dept, regionId, weekAgo), ...moneyMeasures(dept, regionId, weekAgo)],
      ...bands,
    });
    const d = decompose(nowH, beforeH);
    // Projected health at end of quarter: money lines at their projected EOQ attainment, KPIs and risks as today.
    const ledger = regionId === null ? deptLedgers.get(dept.id)! : regionLedgers.get(regionId)!;
    const projected = health({
      measures: measures.map((m) => {
        if (m.kind !== "money") return m;
        const l = lineLedger(ledger, m.code);
        const eoq = projectLine(l, m.code, qStart, qEnd);
        if (!eoq) return m;
        const budget = eoq.terms.actualToDate + sum(daysIn(asOf, qEnd).map((day) => l.budgetOn(m.code, day)));
        return { ...m, value: eoq.mid, reference: budget };
      }),
      ...bands,
    });
    const cause = d.contributions.find((c) => c.points !== 0 && c.code !== "risk_load") ?? null;
    const worstRisk = [...owned].sort((a, b) => a.band.localeCompare(b.band) || b.ils - a.ils)[0] ?? null;
    return {
      health: nowH,
      measures,
      before: beforeH,
      change: d.change,
      contributions: d.contributions.filter((c) => c.points !== 0),
      cause,
      projectedEoq: projected.score,
      direction: direction(nowH.score, projected.score),
      ownedRisks: owned.length,
      worstRisk: worstRisk ? { id: worstRisk.id, title: worstRisk.title, band: worstRisk.band } : null,
    };
  }

  const deptRows = shown.map((d) => {
    const h = departmentHealth(d, null);
    return {
      unitId: d.id,
      code: d.code,
      name: d.name,
      score: h.health.score,
      status: h.health.status,
      kpi: round1(h.health.kpi),
      money: round1(h.health.money),
      risk: h.health.risk,
      change: h.change,
      projectedEoq: h.projectedEoq,
      direction: h.direction,
      cause: h.cause,
      contributions: h.contributions,
      parts: h.health.parts.map((p) => ({ ...p, gap: round1(p.gap), attainment: round1(p.attainment) })),
      /** Each measure with its value and reference, for the department's tiles (display units: ILS, pct, count, days). */
      measures: h.measures.map((m) => {
        const part = h.health.parts.find((p) => p.code === m.code)!;
        return {
          code: m.code,
          name: m.name,
          kind: m.kind,
          value: m.value,
          reference: m.reference,
          higherIsBetter: m.higherIsBetter,
          unit: displayUnit(m.code),
          gap: round1(part.gap),
          attainment: round1(part.attainment),
        };
      }),
      ownedRisks: h.ownedRisks,
      worstRisk: h.worstRisk,
      model: h.health.model,
    };
  });

  const groupScore = round1(mean(deptRows.map((d) => d.score)));
  const groupBefore = round1(mean(deptRows.map((d) => d.score - d.change)));
  const bridge = {
    before: groupBefore,
    now: groupScore,
    steps: deptRows.map((d) => ({ unitId: d.unitId, name: d.name, points: round1(d.change / deptRows.length) })),
  };

  // Region view: inside a department (drill-down), or across the departments for a group reader (toggle).
  const regionRows = (readsGroup || drill ? regions : [])
    .map((r) => {
      const per = shown.map((d) => ({ d, h: departmentHealth(d, r.id) })).filter((x) => x.h.health.parts.length > 0);
      const score = round1(mean(per.map((x) => x.h.health.score)));
      const change = round1(mean(per.map((x) => x.h.change)));
      return {
        unitId: r.id,
        name: r.name,
        score,
        status: statusOf(score),
        change,
        parts:
          drill && per[0]
            ? per[0].h.health.parts.map((p) => ({ ...p, gap: round1(p.gap), attainment: round1(p.attainment) }))
            : [],
        cause: drill && per[0] ? per[0].h.cause : null,
      };
    })
    .filter((r) => Number.isFinite(r.score) && (drill ? r.parts.length > 0 : true));
  const groupOnly = drill
    ? [
        ...kpisOf(drill.id)
          .filter((k) => k.level !== "branch")
          .map((k) => k.name),
        ...(DEPARTMENT_MONEY[drill.code] ?? []).filter((c) => accountOf.get(c)?.level !== "region").map(lineName),
      ]
    : [];

  // ── Money ──
  const headlineDept = drill ?? (readsGroup ? null : departments[0]);
  const headlineCode = headlineDept ? (DEPARTMENT_MONEY[headlineDept.code]?.[0] ?? "dept_opex") : "rev_net_sales";
  const headlineLedger = headlineDept ? deptLedgers.get(headlineDept.id)! : groupLedger;
  const financials = shown.map((d) => ({
    unitId: d.id,
    name: d.name,
    lines: moneyLines(deptLedgers.get(d.id)!, DEPARTMENT_MONEY[d.code] ?? []),
  }));
  const groupLines = readsGroup && !drill ? moneyLines(groupLedger, ["rev_net_sales", "gm_amount", "op_profit"]) : [];

  // Month chart: cumulative actual vs cumulative budget, with the end-of-month projection and its range.
  const monthDays = daysIn(mStart, mEnd);
  let cumA = 0;
  let cumB = 0;
  const monthSeries = monthDays.map((d) => {
    cumB += headlineLedger.budgetOn(headlineCode, d);
    const a = d < asOf ? headlineLedger.actualOn(headlineCode, d) : null;
    if (a !== null) cumA += a;
    return { day: d, actual: a !== null ? Math.round(cumA) : null, budget: Math.round(cumB) };
  });
  const headlineEom = projectLine(headlineLedger, headlineCode, mStart, mEnd);
  const headlineEoq = projectLine(headlineLedger, headlineCode, qStart, qEnd);
  const monthChart = {
    code: headlineCode,
    name: lineName(headlineCode),
    higherIsBetter: lineHigher(headlineCode),
    series: monthSeries,
    budgetTotal: Math.round(cumB),
    projection: headlineEom,
  };

  // ── Focus (executive-home.md §7) ──
  const [myDecisions, myApprovals] = await Promise.all([
    listMyDecisions(db, orgId, actor),
    listMyApprovals(db, orgId, actor),
  ]);
  const decideIds = new Set(myDecisions.map((d) => d.insightId));
  const approveFor = new Map(myApprovals.map((a) => [a.insightId, a.approval.id]));
  const inShown = (r: Risk) =>
    !drill && readsGroup ? true : shown.some((d) => r.ownerDepartmentId === d.id || r.affectedUnitIds.includes(d.id));
  const urgency = (h: number | null) =>
    h !== null && h <= URGENT_HOURS ? 1.5 : h !== null && h <= SOON_HOURS ? 1.2 : 1;
  type Focus = {
    kind: "risk" | "opportunity" | "projection";
    id: string;
    title: string;
    /** The department, for a projected miss. */
    unitName?: string;
    band: string | null;
    ils: number;
    hoursLeft: number | null;
    score: number;
    button: "decide" | "approve" | "open" | "make_action";
    href: string;
  };
  const focus: Focus[] = [
    ...risks
      .filter(inShown)
      .filter(
        (r) =>
          (r.workstream === "risk" ? r.band === "P1" || r.band === "P2" : r.band === "O1") ||
          decideIds.has(r.id) ||
          approveFor.has(r.id),
      )
      .map((r) => {
        const button: Focus["button"] = decideIds.has(r.id)
          ? "decide"
          : approveFor.has(r.id)
            ? "approve"
            : r.workstream === "opportunity"
              ? "make_action"
              : "open";
        const level = button === "decide" || button === "approve" ? 1.5 : 1;
        return {
          kind: r.workstream as "risk" | "opportunity",
          id: r.id,
          title: r.title,
          band: r.band,
          ils: r.ils,
          hoursLeft: r.hoursLeft === null ? null : Math.round(r.hoursLeft),
          score: Math.round(r.ils * urgency(r.hoursLeft) * level),
          button,
          href: button === "approve" ? "/approvals" : `/insights/${r.id}`,
        };
      }),
    ...financials
      .flatMap((f) => f.lines.map((l) => ({ f, l })))
      .filter(({ l }) => l.eom && l.eom.gapPct < -2 && l.eomShortfallIls > 0 && l.weeklyGapIls > 0)
      .map(({ f, l }) => {
        const daysLeft = daysIn(asOf, mEnd).length;
        // Ranked like a risk: the ₪ per week it is running behind, so a month's shortfall does not outweigh a week's.
        const weekly = l.weeklyGapIls;
        return {
          kind: "projection" as const,
          id: `${f.unitId}:${l.code}`,
          title: l.name,
          unitName: f.name,
          band: null,
          ils: Math.round(l.eomShortfallIls),
          hoursLeft: daysLeft * 24,
          score: Math.round(weekly * urgency(daysLeft * 24)),
          button: "open" as const,
          href: `/?unit=${f.unitId}`,
        };
      }),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const shownRisks = risks.filter(inShown);
  const decisionStatus = new Map<string, string>();
  const actionStatus = new Map<string, string>();
  if (shownRisks.length) {
    const ids = shownRisks.map((r) => r.id);
    for (const d of await db
      .select({ insightId: decision.insightId, status: decision.status })
      .from(decision)
      .where(inArray(decision.insightId, ids)))
      decisionStatus.set(d.insightId, d.status);
    for (const a of await db
      .select({ insightId: action.insightId, status: action.status })
      .from(action)
      .where(inArray(action.insightId, ids)))
      if (!actionStatus.has(a.insightId) || a.status === "executing") actionStatus.set(a.insightId, a.status);
  }
  const listItem = (r: Risk) => ({
    id: r.id,
    title: r.title,
    band: r.band,
    ils: r.ils,
    costIls: r.costIls,
    confidence: r.confidence,
    status: r.status,
    response: actionStatus.get(r.id) ?? decisionStatus.get(r.id) ?? null,
  });
  const byWeight = (a: Risk, b: Risk) => a.band.localeCompare(b.band) || b.ils - a.ils;
  const topRisks = shownRisks
    .filter((r) => r.workstream === "risk")
    .sort(byWeight)
    .slice(0, 5)
    .map(listItem);
  const topOpps = shownRisks
    .filter((r) => r.workstream === "opportunity")
    .sort(byWeight)
    .slice(0, 5)
    .map(listItem);

  // ── Outside (external events) and inside (the last 7 days vs the 7 before) ──
  const signalIds = [...new Set(shownRisks.flatMap((r) => r.signalIds))];
  const externalIds = new Set(
    signalIds.length
      ? (
          await db
            .select({ id: signal.id })
            .from(signal)
            .where(and(inArray(signal.id, signalIds), eq(signal.type, "external_event")))
        ).map((s) => s.id)
      : [],
  );
  const outside = shownRisks
    .filter((r) => r.signalIds.some((s) => externalIds.has(s)))
    .sort(byWeight)
    .slice(0, 4)
    .map((r) => ({ id: r.id, title: r.title, band: r.band, workstream: r.workstream, ils: r.ils }));

  const t7 = new Date(now.getTime() - 7 * 86_400_000);
  const t14 = new Date(now.getTime() - 14 * 86_400_000);
  const visibleInsightIds = insightRows.map((i) => i.id);
  const [decided, commitments, inits] = await Promise.all([
    visibleInsightIds.length
      ? db
          .select({ at: decision.decidedAt })
          .from(decision)
          .where(
            and(
              eq(decision.orgId, orgId),
              inArray(decision.insightId, visibleInsightIds),
              gte(decision.decidedAt, t14),
            ),
          )
      : Promise.resolve([] as { at: Date | null }[]),
    db
      .select({
        madeAt: commitment.madeAt,
        ownerUnitId: commitment.ownerUnitId,
        beneficiaries: commitment.beneficiaryUnitIds,
      })
      .from(commitment)
      .where(and(eq(commitment.orgId, orgId), gte(commitment.madeAt, t14))),
    db
      .select({ id: initiative.id })
      .from(initiative)
      .where(and(eq(initiative.orgId, orgId), arrayOverlaps(initiative.visibleUnitIds, scope))),
  ]);
  const barriers = inits.length
    ? await db
        .select({ since: barrier.since, resolvedOn: barrier.resolvedOn, costIls: barrier.costIls })
        .from(barrier)
        .where(
          inArray(
            barrier.initiativeId,
            inits.map((i) => i.id),
          ),
        )
    : [];
  const visibleCommitments = commitments.filter((c) =>
    [c.ownerUnitId, ...c.beneficiaries].some((id) => {
      const u = units.find((x) => x.id === id);
      return !!u && canReadUnit(actor, u);
    }),
  );
  const window = <T>(xs: T[], at: (x: T) => Date | null) => ({
    now: xs.filter((x) => (at(x) ?? t14) >= t7).length,
    before: xs.filter((x) => {
      const a = at(x);
      return !!a && a >= t14 && a < t7;
    }).length,
  });
  const openBarriers = barriers.filter((b) => !b.resolvedOn || b.resolvedOn >= asOf);
  const inside = {
    decisions: window(decided, (d) => d.at),
    commitments: window(visibleCommitments, (c) => c.madeAt),
    blockers: {
      now: openBarriers.length,
      before: barriers.filter(
        (b) => b.since < addDays(asOf, -7) && (!b.resolvedOn || b.resolvedOn >= addDays(asOf, -7)),
      ).length,
      costIls: sum(openBarriers.map((b) => b.costIls)),
    },
  };

  // ── Organization pulse links: dependencies and conflicts between departments ──
  const deptOfUnit = (unitId: string) => {
    const u = units.find((x) => x.id === unitId);
    if (!u || u.type === "group") return null;
    if (u.type === "department") return u.id;
    // Branches and regions work through Store Operations.
    return allDepartments.find((d) => d.code === "D-STORE")?.id ?? null;
  };
  const [allCommitments, deps, conflicts] = await Promise.all([
    db
      .select()
      .from(commitment)
      .where(and(eq(commitment.orgId, orgId), arrayOverlaps(commitment.visibleUnitIds, scope))),
    db.select().from(dependency).where(eq(dependency.orgId, orgId)),
    db
      .select()
      .from(conflict)
      .where(and(eq(conflict.orgId, orgId), eq(conflict.status, "open"))),
  ]);
  const cById = new Map(allCommitments.map((c) => [c.id, c]));
  const shownIds = new Set(shown.map((d) => d.id));
  type LinkState = "on_track" | "blocked" | "conflict";
  const linkMap = new Map<string, { from: string; to: string; state: LinkState; n: number; ils: number }>();
  const RANK: Record<LinkState, number> = { on_track: 0, conflict: 1, blocked: 2 };
  const addLink = (from: string | null, to: string | null, state: LinkState, ils: number) => {
    if (!from || !to || from === to || !shownIds.has(from) || !shownIds.has(to)) return;
    const key = state === "conflict" ? [from, to].sort().join("|") + "|c" : `${from}|${to}`;
    const cur = linkMap.get(key);
    if (!cur) linkMap.set(key, { from, to, state, n: 1, ils });
    else {
      cur.n += 1;
      cur.ils += ils;
      if (RANK[state] > RANK[cur.state]) cur.state = state;
    }
  };
  for (const d of deps) {
    const c = cById.get(d.commitmentId);
    if (!c) continue;
    const st = dependencyStatus(d, c, now);
    if (st === "met" || st === "cancelled") continue;
    addLink(
      deptOfUnit(c.ownerUnitId),
      deptOfUnit(d.downstreamUnitId),
      st === "waiting" ? "on_track" : "blocked",
      d.impactIls,
    );
  }
  for (const k of conflicts) {
    const a = cById.get(k.commitmentAId);
    const b = cById.get(k.commitmentBId);
    if (a && b) addLink(deptOfUnit(a.ownerUnitId), deptOfUnit(b.ownerUnitId), "conflict", 0);
  }
  const links = [...linkMap.values()];

  // ── VECTOR insight: one rule-based sentence (no AI in the demo, FB-11) ──
  const worst = [...deptRows].sort(
    (a, b) => (a.direction === "worsening" ? 0 : 1) - (b.direction === "worsening" ? 0 : 1) || a.score - b.score,
  )[0];
  const vectorInsight =
    worst && (worst.status !== "healthy" || worst.direction === "worsening")
      ? {
          kind: "department_drag" as const,
          unitId: worst.unitId,
          department: worst.name,
          score: worst.score,
          change: worst.change,
          projectedEoq: worst.projectedEoq,
          cause: worst.cause?.name ?? null,
          // On the department's own view the button opens its worst open risk instead of the view itself.
          href: drill ? (worst.worstRisk ? `/insights/${worst.worstRisk.id}` : null) : `/?unit=${worst.unitId}`,
          opens: drill ? ("risk" as const) : ("department" as const),
        }
      : { kind: "all_clear" as const };

  const p1 = shownRisks.filter((r) => r.workstream === "risk" && r.band === "P1");
  const opLines = groupLines.find((l) => l.code === "op_profit");
  const headLine = moneyLines(headlineLedger, [headlineCode])[0] ?? null;
  const secondCode = readsGroup && !drill ? "op_profit" : "dept_opex";
  const second = readsGroup && !drill ? opLines : (financials[0]?.lines.find((l) => l.code === secondCode) ?? null);

  return {
    model: { health: deptRows[0]?.model ?? "health-v2", projection: PROJECTION_MODEL },
    asOf,
    period: { month: monthOf(last), monthStart: mStart, monthEnd: mEnd, quarterStart: qStart, quarterEnd: qEnd },
    scope: {
      kind: drill ? ("department" as const) : readsGroup ? ("group" as const) : ("department" as const),
      unitId: drill?.id ?? (readsGroup ? group.id : departments[0].id),
      name: drill?.name ?? (readsGroup ? group.name : departments.map((d) => d.name).join(" · ")),
      position: pos.position,
      readsGroup,
    },
    tiles: {
      health: {
        score: drill ? deptRows[0].score : groupScore,
        change: round1(drill ? deptRows[0].change : groupScore - groupBefore),
        status: statusOf(drill ? deptRows[0].score : groupScore),
      },
      headline: headLine,
      second: second ?? null,
      p1: { count: p1.length, ils: sum(p1.map((r) => r.ils)) },
    },
    departments: deptRows,
    bridge,
    regions: regionRows,
    groupOnly,
    monthChart,
    headlineEoq,
    financials,
    groupLines,
    focus,
    links,
    risks: topRisks,
    opportunities: topOpps,
    outside,
    inside,
    insight: vectorInsight,
  };
}

export type ExecutiveHome = NonNullable<Awaited<ReturnType<typeof executiveHome>>>;
export type { HealthResult };
