/**
 * Read models for the performance dashboards and the scope-relative ("local") priority (ADR-006,
 * docs/specs/performance-dashboards.md). Everything is derived at read time from stored KPI
 * observations, insights and actions; nothing here writes.
 */
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { addDays } from "@/domain/calendar";
import { hasPermission } from "@/domain/policy/permissions";
import {
  computeLocalPriority,
  effectiveLocal,
  explainPriority,
  type OpportunityInput,
  type PriorityBreakdown,
  type PriorityInput,
} from "@/domain/priority";
import type { Actor } from "@/domain/types";
import {
  action,
  approval,
  auditEvent,
  decision,
  demoClock,
  evidence,
  insight,
  kpi,
  kpiObservation,
  orgUnit,
  outcome,
  roleAssignment,
  user,
} from "@/infra/db/schema";
import type { DbOrTx } from "../db";

export type Position = "group" | "region" | "branch" | "department";

type Unit = typeof orgUnit.$inferSelect;
type Kpi = typeof kpi.$inferSelect;
type Obs = { kpiId: string; orgUnitId: string; day: string; value: number };

const SUM_KPIS = new Set(["net_sales", "transactions"]);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);

/** The viewer's position: the scope they manage, used to pick their dashboard and local priority. */
export function positionOf(actor: Actor, units: Unit[]): { position: Position; unit: Unit } | null {
  if (actor.kind !== "user") return null;
  const readable = actor.assignments.filter((a) => hasPermission(a.role, "insight.read"));
  const byType = (t: Unit["type"]) =>
    readable.map((a) => units.find((u) => u.id === a.unit.id)).find((u): u is Unit => !!u && u.type === t);
  const g = byType("group");
  if (g) return { position: "group", unit: g };
  const r = byType("region");
  if (r) return { position: "region", unit: r };
  const b = byType("branch");
  if (b) return { position: "branch", unit: b };
  const d = byType("department");
  if (d) return { position: "department", unit: d };
  return null;
}

const positionFor = (u: Unit): Position =>
  u.type === "group" ? "group" : u.type === "region" ? "region" : u.type === "branch" ? "branch" : "department";

/** Whether this person may read this unit (a unit inside one of their read scopes). */
export function canReadUnit(actor: Actor, unit: { pathIds: string[] }) {
  if (actor.kind !== "user") return false;
  return actor.assignments.some((a) => hasPermission(a.role, "insight.read") && unit.pathIds.includes(a.unit.id));
}

async function asOfDay(db: DbOrTx, orgId: string) {
  const [c] = await db.select().from(demoClock).where(eq(demoClock.orgId, orgId));
  return (c?.now ?? new Date()).toISOString().slice(0, 10);
}

async function loadObservations(db: DbOrTx, orgId: string, unitIds: string[], from: string, to: string) {
  if (unitIds.length === 0) return [] as Obs[];
  return db
    .select({
      kpiId: kpiObservation.kpiId,
      orgUnitId: kpiObservation.orgUnitId,
      day: kpiObservation.day,
      value: kpiObservation.value,
    })
    .from(kpiObservation)
    .where(
      and(
        eq(kpiObservation.orgId, orgId),
        inArray(kpiObservation.orgUnitId, unitIds),
        gte(kpiObservation.day, from),
        lt(kpiObservation.day, to),
      ),
    );
}

/** Branches under a unit (the unit itself if it is a branch; every branch for the group). */
function branchesUnder(units: Unit[], unit: Unit) {
  if (unit.type === "branch") return [unit];
  return units.filter((u) => u.type === "branch" && u.pathIds.includes(unit.id));
}

export type KpiStat = {
  code: string;
  name: string;
  unit: string;
  higherIsBetter: boolean;
  /** Last 7 days: sum for sales/transactions, mean otherwise. */
  value: number;
  previous: number;
  usual: number;
  target: number | null;
  /** Relative change vs. the previous 7 days (ratio KPIs) or points (pct/score KPIs). */
  changeVsPrevious: number;
  /** Direction-aware: true if moving the right way or within 1% of target. */
  status: "good" | "watch" | "bad";
  series: { day: string; actual: number; expected: number }[];
};

function kpiStat(k: Kpi, obs: Obs[], unitIds: Set<string>, asOf: string, seriesDays = 28): KpiStat {
  const mine = obs.filter((o) => o.kpiId === k.id && unitIds.has(o.orgUnitId));
  const byDay = new Map<string, number[]>();
  for (const o of mine) byDay.set(o.day, [...(byDay.get(o.day) ?? []), o.value]);
  const agg = SUM_KPIS.has(k.code) ? sum : mean;
  const daily = (d: string) => (byDay.has(d) ? agg(byDay.get(d)!) : NaN);
  const windowVal = (from: number, to: number) => {
    const xs: number[] = [];
    for (let i = from; i < to; i++) {
      const v = daily(addDays(asOf, -i));
      if (!Number.isNaN(v)) xs.push(v);
    }
    return SUM_KPIS.has(k.code) ? sum(xs) : mean(xs);
  };
  /** Usual level for a day: mean of the same weekday in the 4 weeks before. */
  const usualFor = (d: string) =>
    mean([7, 14, 21, 28].map((w) => daily(addDays(d, -w))).filter((v) => !Number.isNaN(v)));
  const value = windowVal(1, 8);
  const previous = windowVal(8, 15);
  const usualDays = Array.from({ length: 7 }, (_, i) => usualFor(addDays(asOf, -(i + 1))));
  const usual = SUM_KPIS.has(k.code) ? sum(usualDays) : mean(usualDays);
  const ratio = SUM_KPIS.has(k.code);
  const changeVsPrevious = ratio ? value / previous - 1 : value - previous;
  const ref = k.target ?? usual;
  const gap = k.higherIsBetter ? (value - ref) / Math.abs(ref) : (ref - value) / Math.abs(ref);
  const status = gap >= -0.01 ? "good" : gap >= -0.05 ? "watch" : "bad";
  const series = Array.from({ length: seriesDays }, (_, i) => addDays(asOf, -(seriesDays - i)))
    .filter((d) => byDay.has(d))
    .map((d) => ({
      day: d,
      actual: Math.round(daily(d) * 100) / 100,
      expected: Math.round((k.target ?? usualFor(d)) * 100) / 100,
    }));
  return {
    code: k.code,
    name: k.name,
    unit: k.unit,
    higherIsBetter: k.higherIsBetter,
    value,
    previous,
    usual,
    target: k.target,
    changeVsPrevious,
    status,
    series,
  };
}

// ── Local priority ───────────────────────────────────────────────────────────

export type LocalView = { scopeName: string; score: number; band: string; model: string };

/**
 * Scope-relative priority for a region or branch manager (priority-v2.1-local): impact against the
 * scope's weekly sales (or, for a cost overrun, its budget for that cost line), breadth as the share of
 * the scope's branches affected. Group and department viewers use the organizational priority.
 */
export async function localPriorities(
  db: DbOrTx,
  orgId: string,
  actor: Actor,
  rows: {
    id: string;
    workstream: string;
    affectedUnitIds: string[];
    primaryUnitId: string;
    priorityBreakdown: unknown;
  }[],
  /** View the risks from this unit instead of the viewer's own scope (unit pages). */
  scopeUnitId?: string,
): Promise<Map<string, LocalView>> {
  const out = new Map<string, LocalView>();
  const risks = rows.filter((r) => r.workstream === "risk");
  if (risks.length === 0) return out;
  const units = await db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId));
  const scopeUnit = scopeUnitId ? units.find((u) => u.id === scopeUnitId) : undefined;
  const pos = scopeUnit ? { position: positionFor(scopeUnit), unit: scopeUnit } : positionOf(actor, units);
  if (!pos || (pos.position !== "region" && pos.position !== "branch")) return out;
  const scopeBranches = branchesUnder(units, pos.unit);
  const asOf = await asOfDay(db, orgId);
  const kpis = await db.select().from(kpi).where(eq(kpi.orgId, orgId));
  const sales = kpis.find((k) => k.code === "net_sales")!;
  const labor = kpis.find((k) => k.code === "labor_pct");
  const obs = (
    await loadObservations(
      db,
      orgId,
      scopeBranches.map((b) => b.id),
      addDays(asOf, -7),
      asOf,
    )
  ).filter((o) => o.kpiId === sales.id);
  const weeklySales = sum(obs.map((o) => o.value));
  const laborBudget = labor?.target ? (weeklySales * labor.target) / 100 : undefined;
  const scopeIds = new Set(scopeBranches.map((b) => b.id));

  for (const r of risks) {
    const input = (r.priorityBreakdown as PriorityBreakdown).input as PriorityInput;
    const touched = [r.primaryUnitId, ...r.affectedUnitIds].map((id) => units.find((u) => u.id === id)!);
    // A listed unit at or above the viewer's scope covers all of it; listed branches count individually.
    const coversAll = touched.some((u) => u && pos.unit.pathIds.includes(u.id) && u.type !== "department");
    const listedBranches = touched.filter((u) => u && scopeIds.has(u.id)).length;
    const share = coversAll ? 1 : listedBranches / Math.max(scopeBranches.length, 1);
    if (share === 0) continue; // involves the viewer only through a department: organizational view applies
    const p = effectiveLocal(
      r.priorityBreakdown as PriorityBreakdown,
      computeLocalPriority(input, {
        scope: pos.position,
        scopeWeeklySalesIls: weeklySales,
        shareOfScopeAffected: share,
        ...(input.costLine === "labor" && laborBudget ? { costLineBudgetIls: laborBudget } : {}),
      }),
    );
    if (!p) continue;
    out.set(r.id, { scopeName: pos.unit.name, score: p.score, band: p.band, model: p.model });
  }
  return out;
}

// ── Dashboards ───────────────────────────────────────────────────────────────

const BAND_WEIGHT: Record<string, number> = { P1: 20, P2: 10, P3: 4, P4: 1 };
const INVOLVED_WEIGHT: Record<string, number> = { P1: 6, P2: 3, P3: 1, P4: 0 };

/**
 * The view of one unit (group, region, branch or department): its performance, its risks and opportunities, who
 * owns what, and its dependencies. Without `unitId`, the viewer's own unit (their position). A unit outside the
 * viewer's scope is null (404 in the UI, like an out-of-scope insight).
 */
export async function performanceView(db: DbOrTx, orgId: string, actor: Actor, unitId?: string) {
  const units = await db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId));
  let pos: { position: Position; unit: Unit } | null;
  if (unitId) {
    const u = units.find((x) => x.id === unitId);
    if (!u || !canReadUnit(actor, u)) return null;
    pos = { position: positionFor(u), unit: u };
  } else pos = positionOf(actor, units);
  if (!pos) return null;
  const asOf = await asOfDay(db, orgId);
  const kpis = await db.select().from(kpi).where(eq(kpi.orgId, orgId));
  const branchKpis = kpis.filter((k) => k.level === "branch");
  const from = addDays(asOf, -56);

  const insights = await db
    .select({
      id: insight.id,
      workstream: insight.workstream,
      title: insight.title,
      band: insight.priorityBand,
      score: insight.priorityScore,
      status: insight.status,
      primaryUnitId: insight.primaryUnitId,
      affectedUnitIds: insight.affectedUnitIds,
      visibleUnitIds: insight.visibleUnitIds,
      evidenceIds: insight.evidenceIds,
      ownerDepartmentId: insight.ownerDepartmentId,
      priorityBreakdown: insight.priorityBreakdown,
    })
    .from(insight)
    .where(eq(insight.orgId, orgId));
  const open = insights.filter((i) => i.status === "open" || i.status === "acknowledged");
  const visible = open.filter((i) => i.visibleUnitIds.includes(pos.unit.id));
  const actions = await db.select().from(action).where(eq(action.orgId, orgId));
  const approvals = await db
    .select()
    .from(approval)
    .where(and(eq(approval.orgId, orgId), eq(approval.status, "requested")));
  const people = await db
    .select({
      id: user.id,
      name: user.name,
      title: user.title,
      role: roleAssignment.role,
      unitId: roleAssignment.orgUnitId,
    })
    .from(user)
    .innerJoin(roleAssignment, eq(roleAssignment.userId, user.id))
    .where(eq(roleAssignment.orgId, orgId));
  const deptOfUser = (uid: string) => {
    const p = people.find((x) => x.id === uid && x.role === "department_manager");
    return p ? units.find((u) => u.id === p.unitId) : undefined;
  };
  const personName = (uid: string) => people.find((p) => p.id === uid)?.name ?? "—";

  // Local priority (raise-only, G2-a) is the band a region or branch manager sees everywhere on their unit view:
  // the cards, the counts, the KPI links and what is waiting on them (STATUS.md, 2026-10-04: one screen showed both).
  const unitLocal = await localPriorities(db, orgId, actor, visible, pos.unit.id);
  const bandOf = (i: { id: string; band: string }) => unitLocal.get(i.id)?.band ?? i.band;

  const workstreams = {
    risks: ["P1", "P2", "P3", "P4"].map((b) => ({
      band: b,
      count: visible.filter((i) => i.workstream === "risk" && bandOf(i) === b).length,
    })),
    opportunities: ["O1", "O2", "O3"].map((b) => ({
      band: b,
      count: visible.filter((i) => i.workstream === "opportunity" && i.band === b).length,
    })),
    atStakeIls: sum(
      visible
        .filter((i) => i.workstream === "risk")
        .map((i) => ((i.priorityBreakdown as PriorityBreakdown).input as PriorityInput).impactIls ?? 0),
    ),
    upsideIls: sum(
      visible
        .filter((i) => i.workstream === "opportunity")
        .map((i) => (i.priorityBreakdown as { input: OpportunityInput }).input.valueIls ?? 0),
    ),
  };
  const visibleIds = new Set(visible.map((i) => i.id));
  const myActions = actions.filter((a) => a.insightId && visibleIds.has(a.insightId));
  const execution = {
    proposed: myActions.filter((a) => a.status === "proposed").length,
    pendingApproval: myActions.filter((a) => a.status === "pending_approval").length,
    executed: myActions.filter((a) => a.status === "executed").length,
    overdue: myActions.filter(
      (a) =>
        a.dueAt &&
        a.dueAt.toISOString().slice(0, 10) < asOf &&
        !["executed", "cancelled", "rejected"].includes(a.status),
    ).length,
    approvalsWaiting: approvals.filter((ap) => myActions.some((a) => a.id === ap.actionId)).length,
  };

  const departmentPulse = units
    .filter((u) => u.type === "department")
    .map((d) => {
      const owned = open.filter((i) => i.ownerDepartmentId === d.id);
      const involved = open.filter((i) => i.ownerDepartmentId !== d.id && i.affectedUnitIds.includes(d.id));
      const penalty =
        sum(owned.filter((i) => i.workstream === "risk").map((i) => BAND_WEIGHT[i.band] ?? 0)) +
        sum(involved.filter((i) => i.workstream === "risk").map((i) => INVOLVED_WEIGHT[i.band] ?? 0));
      const health = Math.max(0, 100 - penalty);
      return {
        id: d.id,
        code: d.code,
        name: d.name,
        health,
        status: health >= 80 ? "healthy" : health >= 60 ? "watch" : "at_risk",
        ownedRisks: owned.filter((i) => i.workstream === "risk").length,
        ownedOpportunities: owned.filter((i) => i.workstream === "opportunity").length,
        involved: involved.length,
        topBand:
          owned
            .filter((i) => i.workstream === "risk")
            .map((i) => i.band)
            .sort()[0] ?? null,
      };
    });

  // Contextual intelligence: which open insights explain which KPI (their evidence is that KPI's series).
  const visibleList = [...visible];
  const ev = visibleList.length
    ? await db
        .select({ id: evidence.id, sourceRef: evidence.sourceRef, kind: evidence.kind })
        .from(evidence)
        .where(inArray(evidence.id, [...new Set(visibleList.flatMap((i) => i.evidenceIds))]))
    : [];
  const kpiOfEvidence = new Map(
    ev
      .filter((e) => e.kind === "kpi_series" && e.sourceRef.startsWith("kpi_observation:"))
      .map((e) => [e.id, e.sourceRef.split(":")[1]]),
  );
  const kpiLinks: Record<string, { id: string; title: string; band: string }[]> = {};
  for (const i of visibleList)
    for (const code of new Set(i.evidenceIds.map((e) => kpiOfEvidence.get(e)).filter((c): c is string => !!c)))
      (kpiLinks[code] ??= []).push({ id: i.id, title: i.title, band: bandOf(i) });

  const decisions = visibleList.length
    ? await db
        .select()
        .from(decision)
        .where(
          inArray(
            decision.insightId,
            visibleList.map((i) => i.id),
          ),
        )
    : [];
  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "—";
  const items = visibleList
    .map((i) => {
      const local = unitLocal.get(i.id) ?? null;
      const dec = decisions.find((d) => d.insightId === i.id);
      const acts = actions.filter((a) => a.insightId === i.id);
      const waiting =
        dec?.status === "recommended"
          ? `Decision by the manager of ${unitName(i.primaryUnitId)}`
          : acts.some((a) => a.status === "pending_approval")
            ? `${acts.filter((a) => a.status === "pending_approval").length} action(s) awaiting approval`
            : acts.some((a) => ["ready", "executing"].includes(a.status))
              ? "Executing"
              : acts.length && acts.every((a) => ["executed", "cancelled", "rejected"].includes(a.status))
                ? "Actions done; watching the outcome"
                : null;
      return {
        id: i.id,
        workstream: i.workstream,
        title: i.title,
        band: local?.band ?? i.band,
        score: local?.score ?? i.score,
        groupBand: i.band,
        local,
        status: i.status,
        primaryUnitName: unitName(i.primaryUnitId),
        ownerDepartmentName: i.ownerDepartmentId ? unitName(i.ownerDepartmentId) : null,
        why: explainPriority(i.priorityBreakdown as PriorityBreakdown),
        recommendation: dec?.statement ?? null,
        waiting,
      };
    })
    .sort((a, b) => b.score - a.score);

  const breadcrumb = pos.unit.pathIds.map((id) => {
    const u = units.find((x) => x.id === id)!;
    return { id: u.id, name: u.name, type: u.type };
  });

  const resolved = insights
    .filter((i) => (i.status === "resolved" || i.status === "dismissed") && i.visibleUnitIds.includes(pos.unit.id))
    .map((i) => ({ id: i.id, title: i.title, band: i.band, status: i.status, workstream: i.workstream }));

  const base = {
    resolved,
    position: pos.position,
    scope: { id: pos.unit.id, name: pos.unit.name, type: pos.unit.type, code: pos.unit.code },
    breadcrumb,
    asOf,
    workstreams,
    execution,
    items,
    kpiLinks,
  };

  if (pos.position === "group" || pos.position === "region" || pos.position === "branch") {
    const scopeBranches = branchesUnder(units, pos.unit);
    const obs = await loadObservations(
      db,
      orgId,
      scopeBranches.map((b) => b.id),
      from,
      asOf,
    );
    const all = new Set(scopeBranches.map((b) => b.id));
    const kpiCards = branchKpis.map((k) => kpiStat(k, obs, all, asOf));
    const local = await localPriorities(db, orgId, actor, visible);
    const childRows = (children: Unit[]) =>
      children.map((c) => {
        const ids = new Set(branchesUnder(units, c).map((b) => b.id));
        const stats = Object.fromEntries(branchKpis.map((k) => [k.code, kpiStat(k, obs, ids, asOf, 0)]));
        // Items specific to this unit: listed at it or inside it, and not listed for every sibling
        // (group-wide items are counted once, in the workstream totals).
        const touches = (i: (typeof visible)[number], x: Unit) =>
          [i.primaryUnitId, ...i.affectedUnitIds].some((uid) => {
            const u = units.find((y) => y.id === uid);
            return !!u && u.type !== "department" && (u.id === x.id || u.pathIds.includes(x.id));
          });
        const touching = visible.filter((i) => touches(i, c) && !children.every((sib) => touches(i, sib)));
        const risks = touching.filter((i) => i.workstream === "risk");
        const worst = risks.map((i) => i.band).sort()[0] ?? null;
        const bad = Object.values(stats).filter((s) => s.status === "bad").length;
        const watch = Object.values(stats).filter((s) => s.status === "watch").length;
        return {
          id: c.id,
          name: c.name,
          code: c.code,
          stats,
          risks: risks.length,
          opportunities: touching.filter((i) => i.workstream === "opportunity").length,
          worstBand: worst,
          // At risk: a specific P1/P2 risk or two KPIs off target. Watch: any other risk or KPI off target.
          health:
            worst === "P1" || worst === "P2" || bad >= 2 ? "at_risk" : worst || bad || watch ? "watch" : "on_track",
        };
      });
    const children = (
      pos.position === "group"
        ? units.filter((u) => u.type === "region")
        : pos.position === "region"
          ? units.filter((u) => u.parentId === pos.unit.id && u.type === "branch")
          : []
    ).sort((a, b) => a.name.localeCompare(b.name));
    // Branch: the actions on its insights, grouped by the department that owns each (cross-department dependencies).
    const dependencies =
      pos.position === "branch" || pos.position === "region"
        ? myActions
            .filter((a) => !["cancelled"].includes(a.status))
            .map((a) => ({
              id: a.id,
              title: a.title,
              status: a.status,
              owner: personName(a.ownerUserId),
              department:
                deptOfUser(a.ownerUserId)?.name ?? (pos.position === "branch" ? "This branch" : "Regions & branches"),
              insightId: a.insightId,
            }))
        : [];
    return {
      ...base,
      kpis: kpiCards,
      children: childRows(children),
      departmentPulse: pos.position === "group" ? departmentPulse : [],
      dependencies,
      localBands: Object.fromEntries(local),
    };
  }

  // Department position: its own KPIs, the branch KPIs it owns (group-wide), owned vs. involved work.
  const dept = pos.unit;
  const ownedKpis = kpis.filter((k) => k.ownerDepartmentId === dept.id);
  const allBranches = units.filter((u) => u.type === "branch");
  const obs = await loadObservations(db, orgId, [dept.id, ...allBranches.map((b) => b.id)], from, asOf);
  const kpiCards = ownedKpis.map((k) =>
    kpiStat(k, obs, new Set(k.level === "department" ? [dept.id] : allBranches.map((b) => b.id)), asOf),
  );
  const owned = open.filter((i) => i.ownerDepartmentId === dept.id);
  const involved = open.filter((i) => i.ownerDepartmentId !== dept.id && i.affectedUnitIds.includes(dept.id));
  const ownedIds = new Set(owned.map((i) => i.id));
  const involvedIds = new Set(involved.map((i) => i.id));
  const deptPeople = new Set(people.filter((p) => p.unitId === dept.id).map((p) => p.id));
  const toAction = (a: (typeof actions)[number]) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    owner: personName(a.ownerUserId),
    department: deptOfUser(a.ownerUserId)?.name ?? "Regions & branches",
    insightId: a.insightId,
    dueAt: a.dueAt,
  });
  return {
    ...base,
    kpis: kpiCards,
    pulse: departmentPulse.find((d) => d.id === dept.id)!,
    owned: owned.map((i) => ({ id: i.id, title: i.title, band: i.band, score: i.score, workstream: i.workstream })),
    involved: involved.map((i) => ({
      id: i.id,
      title: i.title,
      band: i.band,
      score: i.score,
      workstream: i.workstream,
      owner: units.find((u) => u.id === i.ownerDepartmentId)?.name ?? "—",
    })),
    /** Actions my department's owned items depend on, owned by other departments. */
    weDependOn: actions
      .filter((a) => a.insightId && ownedIds.has(a.insightId) && !deptPeople.has(a.ownerUserId))
      .map(toAction),
    /** Actions my department owns on items other departments own. */
    dependOnUs: actions
      .filter((a) => a.insightId && involvedIds.has(a.insightId) && deptPeople.has(a.ownerUserId))
      .map(toAction),
    myActions: actions
      .filter(
        (a) =>
          deptPeople.has(a.ownerUserId) && a.insightId && (ownedIds.has(a.insightId) || involvedIds.has(a.insightId)),
      )
      .map(toAction),
  };
}

export const _test = { kpiStat, branchesUnder };

// ── Executive Command Center ─────────────────────────────────────────────────

const CHANGE_VERBS: Record<string, string> = {
  "insight.created": "New",
  "insight.reprioritized": "Re-prioritized",
  "decision.decided": "Decided",
  "decision.declined": "Declined",
  "approval.granted": "Approved",
  "approval.denied": "Denied",
  "action.executed": "Executed",
  "action.requirement_grew": "Needs approval again",
  "outcome.evaluated": "Outcome measured",
  "insight.resolved": "Resolved",
};

/**
 * The Executive Command Center: the group view plus a one-sentence health headline, what changed in the last
 * 24 hours (demo clock), and the biggest KPI moves across branches this week.
 */
export async function commandCenter(db: DbOrTx, orgId: string, actor: Actor) {
  const units = await db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId));
  const group = units.find((u) => u.type === "group");
  if (!group) return null;
  const v = await performanceView(db, orgId, actor, group.id);
  if (!v || !("children" in v)) return null;

  // Headline: which regions need attention, in plain words.
  const atRisk = v.children.filter((c) => c.health === "at_risk").map((c) => c.name);
  const watch = v.children.filter((c) => c.health === "watch").map((c) => c.name);
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
  const p1 = v.items.filter((i) => i.workstream === "risk" && i.band === "P1").length;
  const headline =
    atRisk.length > 0
      ? `${list(atRisk)} need${atRisk.length === 1 ? "s" : ""} attention${watch.length ? `; ${list(watch)} to watch` : ""}.`
      : watch.length > 0
        ? `Nothing critical; ${list(watch)} to watch.`
        : "Everything is on track.";
  const subline = `${p1} P1 risk${p1 === 1 ? "" : "s"} across the group, ${v.items.filter((i) => i.workstream === "opportunity" && i.band === "O1").length} opportunity to pursue now.`;

  // What changed: audited events of the last 24 h on insights the viewer can see.
  const asOfNow = (await db.select().from(demoClock).where(eq(demoClock.orgId, orgId)))[0]?.now ?? new Date();
  const since = new Date(asOfNow.getTime() - 24 * 3_600_000);
  const visibleIds = new Set(v.items.map((i) => i.id));
  const [decs, acts, aps, outs, evs] = await Promise.all([
    db.select({ id: decision.id, insightId: decision.insightId }).from(decision).where(eq(decision.orgId, orgId)),
    db.select({ id: action.id, insightId: action.insightId }).from(action).where(eq(action.orgId, orgId)),
    db.select({ id: approval.id, actionId: approval.actionId }).from(approval).where(eq(approval.orgId, orgId)),
    db.select({ id: outcome.id, insightId: outcome.insightId }).from(outcome).where(eq(outcome.orgId, orgId)),
    db
      .select()
      .from(auditEvent)
      .where(
        and(
          eq(auditEvent.orgId, orgId),
          gte(auditEvent.occurredAt, since),
          inArray(auditEvent.operation, Object.keys(CHANGE_VERBS)),
        ),
      ),
  ]);
  const insightOf = new Map<string, string>();
  for (const d of decs) insightOf.set(d.id, d.insightId);
  for (const a of acts) if (a.insightId) insightOf.set(a.id, a.insightId);
  for (const ap of aps) {
    const i = insightOf.get(ap.actionId);
    if (i) insightOf.set(ap.id, i);
  }
  for (const o of outs) if (o.insightId) insightOf.set(o.id, o.insightId);
  const titleOf = new Map(v.items.map((i) => [i.id, i]));
  const changes = evs
    .map((e) => ({ e, insightId: e.entityType === "insight" ? e.entityId : insightOf.get(e.entityId) }))
    .filter((x) => x.insightId && visibleIds.has(x.insightId))
    .sort((a, b) => Number(b.e.seq) - Number(a.e.seq));
  const counts = Object.entries(
    changes.reduce<Record<string, number>>(
      (m, x) => ((m[CHANGE_VERBS[x.e.operation]] = (m[CHANGE_VERBS[x.e.operation]] ?? 0) + 1), m),
      {},
    ),
  ).map(([verb, n]) => ({ verb, n }));
  const feed = changes.slice(0, 8).map((x) => ({
    id: x.e.id,
    at: x.e.occurredAt,
    verb: CHANGE_VERBS[x.e.operation],
    insightId: x.insightId!,
    title: titleOf.get(x.insightId!)!.title,
    band: titleOf.get(x.insightId!)!.band,
  }));

  // Biggest KPI moves this week, across branches (vs target, or vs the usual level).
  const branches = units.filter((u) => u.type === "branch" && canReadUnit(actor, u));
  const kpis = (await db.select().from(kpi).where(eq(kpi.orgId, orgId))).filter((k) => k.level === "branch");
  const asOf = asOfNow.toISOString().slice(0, 10);
  const obs = await loadObservations(
    db,
    orgId,
    branches.map((b) => b.id),
    addDays(asOf, -35),
    asOf,
  );
  const moves = branches
    .flatMap((b) =>
      kpis.map((k) => {
        const st = kpiStat(k, obs, new Set([b.id]), asOf, 0);
        const ref = k.target ?? st.usual;
        const gap = (k.higherIsBetter ? st.value - ref : ref - st.value) / Math.abs(ref);
        return {
          unitId: b.id,
          unitName: b.name,
          kpi: k.name,
          unit: k.unit,
          value: st.value,
          ref,
          against: k.target !== null ? "target" : "usual",
          gap,
        };
      }),
    )
    .filter((m) => Number.isFinite(m.gap) && m.gap < -0.05)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 5);

  return { ...v, headline, subline, changes: { counts, feed }, moves };
}

/** The organization as a tree the viewer may read: each unit with its health and its worst specific open risk. */
export async function orgTree(db: DbOrTx, orgId: string, actor: Actor) {
  const units = (await db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId))).filter((u) => canReadUnit(actor, u));
  const open = (
    await db
      .select({
        id: insight.id,
        workstream: insight.workstream,
        band: insight.priorityBand,
        status: insight.status,
        primaryUnitId: insight.primaryUnitId,
        affectedUnitIds: insight.affectedUnitIds,
        ownerDepartmentId: insight.ownerDepartmentId,
      })
      .from(insight)
      .where(eq(insight.orgId, orgId))
  ).filter((i) => i.status === "open" || i.status === "acknowledged");
  // Same rule as "Health by region": an item counts for a unit when it is specific to it (listed at or inside it,
  // and not at every sibling); the group root counts everything.
  const touches = (i: (typeof open)[number], x: Unit) =>
    [i.primaryUnitId, ...i.affectedUnitIds].some((id) => {
      const y = units.find((z) => z.id === id);
      return !!y && y.type !== "department" && y.pathIds.includes(x.id);
    });
  const node = (u: Unit) => {
    const siblings = units.filter((x) => x.parentId === u.parentId && x.type === u.type);
    const mine =
      u.type === "department"
        ? open.filter((i) => i.ownerDepartmentId === u.id || i.affectedUnitIds.includes(u.id))
        : u.type === "group"
          ? open
          : open.filter((i) => touches(i, u) && !siblings.every((sib) => touches(i, sib)));
    const risks = mine.filter((i) => i.workstream === "risk");
    return {
      id: u.id,
      name: u.name,
      type: u.type,
      risks: risks.length,
      opportunities: mine.length - risks.length,
      owned: u.type === "department" ? mine.filter((i) => i.ownerDepartmentId === u.id).length : 0,
      worstBand: risks.map((i) => i.band).sort()[0] ?? null,
    };
  };
  const byParent = (id: string | null) =>
    units.filter((u) => u.parentId === id).sort((a, b) => a.name.localeCompare(b.name));
  const roots = units.filter((u) => !u.parentId || !units.some((p) => p.id === u.parentId));
  const build = (u: Unit): ReturnType<typeof node> & { children: unknown[] } => ({
    ...node(u),
    children: byParent(u.id)
      .filter((c) => c.type !== "department")
      .map(build),
  });
  return {
    trees: roots.map(build),
    departments: units
      .filter((u) => u.type === "department")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(node),
  };
}
