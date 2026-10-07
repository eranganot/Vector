/**
 * Initiatives the viewer may read (ADR-008 §3): the read rule is the insight's. An initiative is visible when one of
 * the viewer's read scopes is among its participating units or their ancestors.
 *
 * `initiativesView` (plan v2, E3; cross-department.md §3) derives status, milestone states and the M1–M5 flags with
 * initiative-rules-v1, resolves who should step in, and lists what in the selected initiative waits on the viewer.
 */
import { and, arrayOverlaps, eq, inArray } from "drizzle-orm";
import { commonAncestor, dependencyStatus } from "@/domain/commitments";
import { daysBetween } from "@/domain/calendar";
import {
  expectedProgress,
  initiativeStatus,
  managementFlags,
  milestoneState,
  nextMilestone,
  onTimeRate,
  progressOf,
  projectedSpend,
  type Flag,
  type InitiativeFacts,
} from "@/domain/initiatives";
import { hasPermission } from "@/domain/policy/permissions";
import type { Actor } from "@/domain/types";
import {
  action,
  barrier,
  commitment,
  conflict,
  demoClock,
  dependency,
  initiative,
  initiativeReminder,
  insight,
  milestone,
  orgUnit,
  roleAssignment,
  user,
} from "@/infra/db/schema";
import type { DbOrTx } from "../db";
import { actionWorkflows } from "./action-status";
import { listMyApprovals, listMyDecisions, readScope } from "./insights";

export async function listInitiatives(db: DbOrTx, orgId: string, actor: Actor) {
  const scope = readScope(actor);
  if (!scope.length) return [];
  const rows = await db
    .select()
    .from(initiative)
    .where(and(eq(initiative.orgId, orgId), arrayOverlaps(initiative.visibleUnitIds, scope)));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [ms, bs] = await Promise.all([
    db.select().from(milestone).where(inArray(milestone.initiativeId, ids)),
    db.select().from(barrier).where(inArray(barrier.initiativeId, ids)),
  ]);
  return rows
    .map((r) => ({
      ...r,
      milestones: ms.filter((m) => m.initiativeId === r.id).sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
      barriers: bs.filter((b) => b.initiativeId === r.id),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

const STATUS_RANK = { blocked: 0, at_risk: 1, on_track: 2, done: 3 } as const;

export type YourItem = {
  key: string;
  kind: "approve" | "decide" | "settle" | "remind" | "resolve" | "reforecast" | "milestone" | "reminder";
  title: string;
  detail: string;
  href?: string;
  /** For the forms: what the button acts on. */
  milestoneId?: string;
  barrierId?: string;
  toUnitId?: string;
  subjectKind?: "milestone" | "barrier" | "budget";
  subjectId?: string;
  /** For items raised by a rule: the rule and its numbers, phrased by the screen (ADR-007). */
  rule?: Flag["rule"];
  facts?: Flag["facts"];
  unitName?: string;
  /** The work item it belongs to (E3c): ms:/br:/ac:/cf:/budget, or ins:<insight> for a decision on it. */
  itemId?: string;
};

export type WorkState = "late" | "blocked" | "at_risk" | "waiting" | "in_progress" | "done";
export type WorkAnalysis =
  | {
      kind: "milestone";
      progress: number;
      expected: number;
      startsOn: string;
      dueOn: string;
      doneOn: string | null;
      daysLate: number;
      moves: { from: string; to: string; reason: string }[];
      reminders: { from: string; body: string; at: Date }[];
    }
  | { kind: "barrier"; barrierKind: string; since: string; days: number; costIls: number }
  | { kind: "conflict"; a: string; b: string; unitA: string; unitB: string; from: string; to: string }
  | { kind: "budget"; budget: number; spent: number; projected: number; progress: number }
  | {
      kind: "action";
      step: string;
      owner: string;
      ownerUnit: string;
      waitingOn: string[];
      insightTitle: string;
      what: string;
      why: string;
      recommendation: string | null;
      cost: number;
      impact: number;
    };

/** One thing that has to happen in an initiative (E3c): what, who does it, by when, its state and what blocks it. */
export type WorkItem = {
  id: string;
  kind: "milestone" | "barrier" | "action" | "conflict" | "budget";
  title: string;
  unitName: string | null;
  /** The people who have to act on it now. */
  who: string[];
  due: string | null;
  state: WorkState;
  rules: string[];
  blockers: string[];
  analysis: WorkAnalysis;
  href?: string;
  insightId?: string;
  /** The buttons the viewer has on it. */
  yours?: YourItem[];
};

export async function initiativesView(db: DbOrTx, orgId: string, actor: Actor, opts: { key?: string } = {}) {
  if (actor.kind !== "user") return null;
  const list = await listInitiatives(db, orgId, actor);
  const [units, people, roles, [clock], cs, deps, ks, reminders] = await Promise.all([
    db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId)),
    db.select({ id: user.id, name: user.name, title: user.title }).from(user).where(eq(user.orgId, orgId)),
    db.select().from(roleAssignment).where(eq(roleAssignment.orgId, orgId)),
    db.select().from(demoClock).where(eq(demoClock.orgId, orgId)),
    db.select().from(commitment).where(eq(commitment.orgId, orgId)),
    db.select().from(dependency).where(eq(dependency.orgId, orgId)),
    db
      .select()
      .from(conflict)
      .where(and(eq(conflict.orgId, orgId), eq(conflict.status, "open"))),
    list.length
      ? db
          .select()
          .from(initiativeReminder)
          .where(
            inArray(
              initiativeReminder.initiativeId,
              list.map((i) => i.id),
            ),
          )
      : Promise.resolve([] as (typeof initiativeReminder.$inferSelect)[]),
  ]);
  const now = clock?.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const unit = new Map(units.map((u) => [u.id, u]));
  const unitName = (id: string | null) => (id ? (unit.get(id)?.name ?? "—") : "—");
  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? "—";
  const managersOf = (unitId: string) =>
    roles
      .filter((r) => r.orgUnitId === unitId && (r.role === "executive" || r.role === "department_manager"))
      .map((r) => r.userId);
  const titled = (t: string) => people.filter((p) => p.title === t).map((p) => p.id);
  const me = actor.userId;
  const myManaged = new Set(
    actor.assignments.filter((a) => hasPermission(a.role, "initiative.update")).map((a) => a.unit.id),
  );

  /** People who should step in for a flag (cross-department.md §3), by user id. */
  function stepInPeople(f: Flag, sponsor: string, k?: (typeof ks)[number]) {
    if (f.stepIn === "sponsor") return [sponsor];
    if (f.stepIn === "cfo_sponsor") return [...new Set([...titled("CFO"), sponsor])];
    if (f.stepIn === "ceo_coo") return [...new Set([...titled("CEO"), ...titled("COO")])];
    // Common manager of the two parties (G4-Q Q1): the CEO for two departments.
    const a = cs.find((c) => c.id === k?.commitmentAId);
    const b = cs.find((c) => c.id === k?.commitmentBId);
    const pa = a && unit.get(a.ownerUnitId)?.pathIds;
    const pb = b && unit.get(b.ownerUnitId)?.pathIds;
    const common = pa && pb ? commonAncestor(pa, pb) : null;
    return common ? managersOf(common) : [];
  }

  const items = list.map((i) => {
    const linked = new Set(i.commitmentIds);
    const conflicts = ks.map((k) => {
      const a = cs.find((c) => c.id === k.commitmentAId);
      const b = cs.find((c) => c.id === k.commitmentBId);
      return {
        id: k.id,
        unitA: a?.ownerUnitId ?? "",
        unitB: b?.ownerUnitId ?? "",
        linked: linked.has(k.commitmentAId) || linked.has(k.commitmentBId),
        insightId: k.insightId,
      };
    });
    const facts: InitiativeFacts = {
      ownerUnitId: i.ownerUnitId,
      participatingUnitIds: i.participatingUnitIds,
      budgetIls: Number(i.budgetIls),
      spentIls: Number(i.spentIls),
      milestones: i.milestones.map((m) => ({ ...m, progress: m.progress })),
      barriers: i.barriers.map((b) => ({ ...b, costIls: Number(b.costIls) })),
    };
    const status = initiativeStatus(facts, today);
    const flags = managementFlags(facts, conflicts, today).map((f) => {
      const k = f.subject.kind === "conflict" ? ks.find((x) => x.id === f.subject.id) : undefined;
      const who = stepInPeople(f, i.sponsorUserId, k);
      const parties =
        k && [cs.find((c) => c.id === k.commitmentAId), cs.find((c) => c.id === k.commitmentBId)].filter(Boolean);
      return {
        ...f,
        subject:
          f.subject.kind === "conflict" && parties
            ? { ...f.subject, title: parties.map((c) => unitName(c!.ownerUnitId)).join(" ↔ ") }
            : f.subject,
        insightId: k?.insightId ?? null,
        itemId:
          f.subject.kind === "budget"
            ? "budget"
            : `${f.subject.kind === "barrier" ? "br" : f.subject.kind === "milestone" ? "ms" : "cf"}:${f.subject.id}`,
        stepInNames: who.map(personName),
        stepInIds: who,
        you: who.includes(me),
      };
    });
    const next = nextMilestone(facts);
    const live = (d: (typeof deps)[number]) => {
      const c = cs.find((x) => x.id === d.commitmentId);
      if (!c) return null;
      const st = dependencyStatus(d, c, now);
      return st === "met" || st === "cancelled" ? null : { d, c, st };
    };
    const waitedOnBy = deps
      .filter((d) => linked.has(d.commitmentId))
      .map(live)
      .filter((x) => !!x)
      .map((x) => ({ unitName: unitName(x!.d.downstreamUnitId), status: x!.st }));
    const waitingOn = deps
      .filter((d) => d.downstreamCommitmentId && linked.has(d.downstreamCommitmentId))
      .map(live)
      .filter((x) => !!x)
      .map((x) => ({ unitName: unitName(x!.c.ownerUnitId), status: x!.st }));
    const milestones = i.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      ownerUnitId: m.ownerUnitId,
      ownerName: unitName(m.ownerUnitId),
      startsOn: m.startsOn,
      dueOn: m.dueOn,
      doneOn: m.doneOn,
      progress: m.doneOn ? 100 : m.progress,
      state: milestoneState(
        facts.milestones.find((x) => x.id === m.id)!,
        today,
      ),
      moves: ((m.history as { from: string; to: string; reason: string }[]) ?? []).length,
    }));
    const openBarriers = i.barriers
      .filter((b) => !b.resolvedOn || b.resolvedOn > today)
      .map((b) => ({ ...b, costIls: Number(b.costIls), ownerName: unitName(b.ownerUnitId) }));
    return {
      id: i.id,
      key: i.key,
      title: i.title,
      kind: i.kind,
      status,
      progress: Math.round(progressOf(facts)),
      sponsorId: i.sponsorUserId,
      sponsorName: personName(i.sponsorUserId),
      ownerUnitId: i.ownerUnitId,
      ownerName: unitName(i.ownerUnitId),
      participants: i.participatingUnitIds.map((id) => ({ id, name: unitName(id) })),
      budget: Number(i.budgetIls),
      spent: Number(i.spentIls),
      projectedSpend: Math.round(projectedSpend(facts)),
      value: Number(i.valueIls),
      startsOn: i.startsOn,
      endsOn: i.endsOn,
      next: next ? milestones.find((m) => m.id === next.id)! : null,
      milestones,
      barriers: openBarriers,
      flags,
      waitingOn,
      waitedOnBy,
      onTime: onTimeRate(i.milestones),
      insightIds: i.insightIds,
      reminders: reminders
        .filter((r) => r.initiativeId === i.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((r) => ({
          id: r.id,
          toUnitId: r.toUnitId,
          toName: unitName(r.toUnitId),
          from: personName(r.fromUserId),
          body: r.body,
          at: r.createdAt,
          subjectKind: r.subjectKind,
          subjectId: r.subjectId,
        })),
    };
  });
  items.sort(
    (a, b) =>
      b.flags.length - a.flags.length ||
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      a.title.localeCompare(b.title),
  );

  const selected = items.find((i) => i.key === opts.key) ?? items[0] ?? null;
  if (opts.key && selected?.key !== opts.key) return { notFound: true as const };

  // ── What in the selected initiative waits on the viewer ──
  const yours: YourItem[] = [];
  if (selected) {
    const [approvals, decisions] = await Promise.all([
      listMyApprovals(db, orgId, actor),
      listMyDecisions(db, orgId, actor),
    ]);
    const linkedInsights = new Set(selected.insightIds);
    for (const a of approvals.filter((x) => linkedInsights.has(x.insightId)))
      yours.push({
        key: `ap:${a.approval.id}`,
        kind: "approve",
        title: a.action.title,
        detail: a.insightTitle,
        href: "/approvals",
        itemId: `ac:${a.action.id}`,
      });
    for (const d of decisions.filter((x) => linkedInsights.has(x.insightId)))
      yours.push({
        key: `de:${d.decisionId}`,
        kind: "decide",
        title: d.title,
        detail: d.statement,
        href: `/insights/${d.insightId}`,
        itemId: `ins:${d.insightId}`,
      });
    for (const f of selected.flags.filter((x) => x.you)) {
      if (f.rule === "M3")
        yours.push({
          key: `m3:${f.subject.id}`,
          kind: "settle",
          itemId: `cf:${f.subject.id}`,
          title: f.subject.title,
          detail: f.reason,
          rule: f.rule,
          facts: f.facts,
          href: f.insightId ? `/insights/${f.insightId}` : "/commitments",
        });
      else if (f.rule === "M4")
        yours.push({
          key: `m4:${f.subject.id}`,
          kind: "resolve",
          itemId: `br:${f.subject.id}`,
          title: f.subject.title,
          detail: f.reason,
          barrierId: f.subject.id ?? undefined,
          rule: f.rule,
          facts: f.facts,
          unitName: f.unitId ? unitName(f.unitId) : undefined,
        });
      else if (f.rule === "M5")
        yours.push({
          key: "m5",
          kind: "reforecast",
          itemId: "budget",
          title: selected.ownerName,
          detail: f.reason,
          toUnitId: selected.ownerUnitId,
          subjectKind: "budget",
          rule: f.rule,
          facts: f.facts,
          unitName: selected.ownerName,
        });
      else if (f.unitId)
        yours.push({
          key: `${f.rule}:${f.subject.id}`,
          kind: "remind",
          itemId: `${f.subject.kind === "barrier" ? "br" : "ms"}:${f.subject.id}`,
          title: f.subject.title,
          detail: f.reason,
          toUnitId: f.unitId,
          subjectKind: f.subject.kind === "barrier" ? "barrier" : "milestone",
          subjectId: f.subject.id ?? undefined,
          rule: f.rule,
          facts: f.facts,
          unitName: unitName(f.unitId),
        });
    }
    // Reminders sent to a unit the viewer manages.
    for (const r of selected.reminders.filter((x) => myManaged.has(x.toUnitId)).slice(0, 3))
      yours.push({
        key: `rm:${r.id}`,
        kind: "reminder",
        title: r.from,
        detail: r.body,
        itemId: r.subjectKind === "budget" ? "budget" : `${r.subjectKind === "barrier" ? "br" : "ms"}:${r.subjectId}`,
      });
    // The viewer's own open milestones (a unit they manage owns them).
    for (const m of selected.milestones.filter((x) => !x.doneOn && myManaged.has(x.ownerUnitId)))
      yours.push({
        key: `ms:${m.id}`,
        kind: "milestone",
        title: m.title,
        detail: m.dueOn,
        milestoneId: m.id,
        itemId: `ms:${m.id}`,
      });
  }
  const dedup = [...new Map(yours.map((y) => [y.key, y])).values()];

  // ── Work items of the selected initiative (E3c): what has to happen, who does it, by when, and what blocks it ──
  const work: WorkItem[] = [];
  if (selected) {
    const headsOf = (unitId: string) => {
      const heads = roles.filter((r) => r.orgUnitId === unitId && r.isHead).map((r) => r.userId);
      return (heads.length ? heads : managersOf(unitId)).map(personName);
    };
    const flagsOn = (itemId: string) => selected.flags.filter((f) => f.itemId === itemId);
    for (const m of selected.milestones) {
      const id = `ms:${m.id}`;
      const blockers = selected.barriers.filter((b) => b.ownerUnitId === m.ownerUnitId).map((b) => b.title);
      const late = m.state === "late" ? daysBetween(m.dueOn, today) : 0;
      const raw = list.find((x) => x.id === selected.id)!.milestones.find((x) => x.id === m.id)!;
      work.push({
        id,
        kind: "milestone",
        title: m.title,
        unitName: m.ownerName,
        who: headsOf(m.ownerUnitId),
        due: m.dueOn,
        state:
          m.state === "done" ? "done" : blockers.length ? "blocked" : m.state === "planned" ? "in_progress" : m.state,
        rules: flagsOn(id).map((f) => f.rule),
        blockers,
        analysis: {
          kind: "milestone",
          progress: m.progress,
          expected: Math.round(expectedProgress(raw, today)),
          startsOn: m.startsOn,
          dueOn: m.dueOn,
          doneOn: m.doneOn,
          daysLate: late,
          moves: ((raw.history as { from: string; to: string; reason: string }[]) ?? []).map((h) => ({
            from: h.from,
            to: h.to,
            reason: h.reason,
          })),
          reminders: selected.reminders
            .filter((r) => r.subjectId === m.id)
            .map((r) => ({ from: r.from, body: r.body, at: r.at })),
        },
      });
    }
    for (const b of selected.barriers) {
      const id = `br:${b.id}`;
      const fl = flagsOn(id);
      const stepIn = fl.find((f) => f.rule === "M4");
      work.push({
        id,
        kind: "barrier",
        title: b.title,
        unitName: b.ownerName,
        who: stepIn ? stepIn.stepInNames : headsOf(b.ownerUnitId),
        due: null,
        state: "blocked",
        rules: fl.map((f) => f.rule),
        blockers: [],
        analysis: {
          kind: "barrier",
          barrierKind: b.kind,
          since: b.since,
          days: daysBetween(b.since, today),
          costIls: b.costIls,
        },
      });
    }
    for (const f of selected.flags.filter((x) => x.rule === "M3")) {
      const k = ks.find((x) => x.id === f.subject.id);
      const a = k && cs.find((c) => c.id === k.commitmentAId);
      const b = k && cs.find((c) => c.id === k.commitmentBId);
      work.push({
        id: f.itemId,
        kind: "conflict",
        title: f.subject.title,
        unitName: null,
        who: f.stepInNames,
        due: k?.overlapStart ?? null,
        state: "waiting",
        rules: ["M3"],
        blockers: [],
        href: f.insightId ? `/insights/${f.insightId}` : undefined,
        analysis: {
          kind: "conflict",
          a: a?.title ?? "—",
          b: b?.title ?? "—",
          unitA: a ? unitName(a.ownerUnitId) : "—",
          unitB: b ? unitName(b.ownerUnitId) : "—",
          from: k?.overlapStart ?? "",
          to: k?.overlapEnd ?? "",
        },
      });
    }
    const m5 = selected.flags.find((f) => f.rule === "M5");
    if (m5)
      work.push({
        id: "budget",
        kind: "budget",
        title: selected.title,
        unitName: selected.ownerName,
        who: m5.stepInNames,
        due: selected.endsOn,
        state: "at_risk",
        rules: ["M5"],
        blockers: [],
        analysis: {
          kind: "budget",
          budget: selected.budget,
          spent: selected.spent,
          projected: selected.projectedSpend,
          progress: selected.progress,
        },
      });
    // The actions answering the initiative's linked insights (Phase 2–4 lifecycle).
    if (selected.insightIds.length) {
      const [acts, ins] = await Promise.all([
        db
          .select()
          .from(action)
          .where(and(eq(action.orgId, orgId), inArray(action.insightId, selected.insightIds))),
        db
          .select({ id: insight.id, title: insight.title, what: insight.whatHappened, why: insight.whyItMatters })
          .from(insight)
          .where(inArray(insight.id, selected.insightIds)),
      ]);
      const live = acts.filter((a) => a.status !== "cancelled" && a.status !== "rejected");
      const flows = await actionWorkflows(db, orgId, actor, live);
      for (const a of live) {
        const w = flows.get(a.id)!;
        const i = ins.find((x) => x.id === a.insightId)!;
        const overdue = !!a.dueAt && a.dueAt.getTime() < now.getTime() && w.step !== "done";
        work.push({
          id: `ac:${a.id}`,
          kind: "action",
          title: a.title,
          unitName: w.owner.unitName,
          who: w.step === "decide" || w.step === "approve" ? w.waitingOn : [w.owner.name],
          due: a.dueAt ? a.dueAt.toISOString().slice(0, 10) : null,
          state:
            w.step === "done"
              ? "done"
              : w.step === "failed"
                ? "late"
                : w.step === "decide" || w.step === "approve"
                  ? "waiting"
                  : overdue
                    ? "late"
                    : "in_progress",
          rules: [],
          blockers: [],
          href: `/insights/${a.insightId}#action-${a.id}`,
          insightId: a.insightId,
          analysis: {
            kind: "action",
            step: w.step,
            owner: w.owner.name,
            ownerUnit: w.owner.unitName,
            waitingOn: w.waitingOn,
            insightTitle: i.title,
            what: i.what,
            why: i.why,
            recommendation: w.recommendation,
            cost: Number(a.estimatedCost),
            impact: Number(a.expectedImpactIls ?? 0),
          },
        });
      }
    }
    for (const w of work)
      w.yours = dedup.filter((y) => y.itemId === w.id || (w.insightId && y.itemId === `ins:${w.insightId}`));
  }
  const ORDER = { late: 0, blocked: 1, at_risk: 2, waiting: 3, in_progress: 4, done: 5 } as const;
  work.sort((a, b) => ORDER[a.state] - ORDER[b.state] || (a.due ?? "9999").localeCompare(b.due ?? "9999"));

  const all = items.flatMap((i) => i.milestones);
  return {
    today,
    items,
    selected,
    work,
    yours: dedup,
    groupOnTime: onTimeRate(all.map((m) => ({ dueOn: m.dueOn, doneOn: m.doneOn }))),
    money: {
      budget: items.reduce((a, i) => a + i.budget, 0),
      spent: items.reduce((a, i) => a + i.spent, 0),
      valueAtRisk: items
        .filter((i) => i.status === "blocked" || i.status === "at_risk")
        .reduce((a, i) => a + i.value, 0),
      flagged: items.filter((i) => i.flags.length > 0).length,
      needYou: items.filter((i) => i.flags.some((f) => f.you)).length,
    },
  };
}

export type InitiativesView = Exclude<NonNullable<Awaited<ReturnType<typeof initiativesView>>>, { notFound: true }>;
