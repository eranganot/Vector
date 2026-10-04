/**
 * Action and outcome tracking (Phase 4f): every action the viewer may read, with its state, owner, due date and
 * approval; outcomes being watched, waiting for a lesson, and reviewed; the lessons library; and "last time we did
 * this" for an insight (lessons from reviewed outcomes of the same action type). Read-only.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Actor } from "@/domain/types";
import { action, approval, demoClock, insight, kpi, orgUnit, outcome, roleAssignment, user } from "@/infra/db/schema";
import type { DbOrTx } from "../db";
import { authorizeUser, canRead } from "@/domain/policy/authorize";

const TERMINAL = new Set(["executed", "cancelled", "rejected"]);

export type ActionFilter = "open" | "approval" | "overdue" | "mine" | "done" | "all";

async function nowOf(db: DbOrTx, orgId: string) {
  const [row] = await db.select().from(demoClock).where(eq(demoClock.orgId, orgId));
  return row?.now ?? new Date();
}

export async function actionsView(db: DbOrTx, orgId: string, actor: Actor, filter: ActionFilter = "open") {
  const [rows, units, people, roles, requests, now] = await Promise.all([
    db
      .select({
        a: action,
        insightTitle: insight.title,
        band: insight.priorityBand,
        insightStatus: insight.status,
      })
      .from(action)
      .innerJoin(insight, eq(insight.id, action.insightId))
      .where(eq(action.orgId, orgId))
      .orderBy(action.dueAt),
    db.select({ id: orgUnit.id, name: orgUnit.name, type: orgUnit.type }).from(orgUnit).where(eq(orgUnit.orgId, orgId)),
    db.select({ id: user.id, name: user.name }).from(user).where(eq(user.orgId, orgId)),
    db
      .select({ userId: roleAssignment.userId, unitId: roleAssignment.orgUnitId, role: roleAssignment.role })
      .from(roleAssignment)
      .where(eq(roleAssignment.orgId, orgId)),
    db
      .select({ actionId: approval.actionId, requestedAt: approval.requestedAt })
      .from(approval)
      .where(and(eq(approval.orgId, orgId), eq(approval.status, "requested"))),
    nowOf(db, orgId),
  ]);
  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "—";
  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? (id.startsWith("system:") ? id : "—");
  const deptOf = (uid: string) => {
    const r = roles.find((x) => x.userId === uid && x.role === "department_manager");
    return r
      ? unitName(r.unitId)
      : roles.find((x) => x.userId === uid)
        ? unitName(roles.find((x) => x.userId === uid)!.unitId)
        : "—";
  };
  const me = actor.kind === "user" ? actor.userId : "";
  const all = rows
    .filter((r) => canRead(actor, r.a.visibleUnitIds))
    .map(({ a, insightTitle, band, insightStatus }) => {
      const overdue = !!a.dueAt && a.dueAt.getTime() < now.getTime() && !TERMINAL.has(a.status);
      const req = requests.find((x) => x.actionId === a.id);
      return {
        id: a.id,
        title: a.title,
        type: a.type,
        status: a.status,
        owner: personName(a.ownerUserId),
        ownerUserId: a.ownerUserId,
        department: deptOf(a.ownerUserId),
        targets: a.targetUnitIds.map(unitName),
        dueAt: a.dueAt,
        overdue,
        cost: Number(a.estimatedCost),
        revision: a.revision,
        approvalRequestedAt: req?.requestedAt ?? null,
        insightId: a.insightId,
        insightTitle,
        insightStatus,
        band,
        mine: a.ownerUserId === me,
      };
    });
  const counts = {
    open: all.filter((a) => !TERMINAL.has(a.status) && a.status !== "failed").length,
    approval: all.filter((a) => a.status === "pending_approval").length,
    overdue: all.filter((a) => a.overdue).length,
    mine: all.filter((a) => a.mine && !TERMINAL.has(a.status)).length,
    done: all.filter((a) => a.status === "executed").length,
    failed: all.filter((a) => a.status === "failed").length,
    all: all.length,
  };
  const shown = all.filter((a) =>
    filter === "open"
      ? !TERMINAL.has(a.status)
      : filter === "approval"
        ? a.status === "pending_approval"
        : filter === "overdue"
          ? a.overdue
          : filter === "mine"
            ? a.mine && !TERMINAL.has(a.status)
            : filter === "done"
              ? a.status === "executed"
              : true,
  );
  return { now, counts, actions: shown };
}

/** Outcomes the viewer may read, by stage, and the lessons library. */
export async function outcomesView(db: DbOrTx, orgId: string, actor: Actor) {
  const rows = await db
    .select({
      o: outcome,
      actionTitle: action.title,
      actionType: action.type,
      insightId: insight.id,
      insightTitle: insight.title,
      visible: insight.visibleUnitIds,
      kpiName: kpi.name,
    })
    .from(outcome)
    .innerJoin(action, eq(action.id, outcome.actionId))
    .innerJoin(insight, eq(insight.id, outcome.insightId))
    .innerJoin(kpi, eq(kpi.id, outcome.kpiId))
    .where(eq(outcome.orgId, orgId))
    .orderBy(desc(outcome.windowEnd));
  const units = await db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId));
  const list = rows
    .filter((r) => canRead(actor, r.visible))
    .map((r) => {
      const obs = r.o.observed as { baselineMean?: number; windowMean?: number; coverage?: number } | null;
      const outUnits = units.filter((u) => r.o.unitIds.includes(u.id));
      return {
        id: r.o.id,
        status: r.o.status,
        verdict: r.o.verdict,
        lesson: r.o.lesson,
        kpi: r.kpiName,
        expected: `${r.o.expectedDirection === "up" ? "+" : "−"}${r.o.expectedThreshold}`,
        windowStart: r.o.windowStart,
        windowEnd: r.o.windowEnd,
        baseline: obs?.baselineMean ?? null,
        observed: obs?.windowMean ?? null,
        actionTitle: r.actionTitle,
        actionType: r.actionType,
        insightId: r.insightId,
        insightTitle: r.insightTitle,
        units: outUnits.map((u) => u.name),
        // Cosmetic (reviewOutcome re-checks): may this person record the lesson?
        canReview:
          r.o.status === "evaluated" &&
          actor.kind === "user" &&
          authorizeUser(actor, "outcome.review", {
            targetUnits: outUnits.map((u) => ({ id: u.id, type: u.type, pathIds: u.pathIds })),
          }).ok,
      };
    });
  return {
    observing: list.filter((o) => o.status === "observing"),
    toReview: list.filter((o) => o.status === "evaluated"),
    reviewed: list.filter((o) => o.status === "reviewed"),
  };
}

/** "Last time we did this": reviewed lessons from other insights' actions of the same types as this insight's. */
export async function lessonsForInsight(db: DbOrTx, orgId: string, actor: Actor, insightId: string) {
  const types = (await db.select({ type: action.type }).from(action).where(eq(action.insightId, insightId))).map(
    (a) => a.type,
  );
  if (types.length === 0) return [];
  const rows = await db
    .select({
      id: outcome.id,
      lesson: outcome.lesson,
      verdict: outcome.verdict,
      windowEnd: outcome.windowEnd,
      actionTitle: action.title,
      actionType: action.type,
      insightId: insight.id,
      insightTitle: insight.title,
      visible: insight.visibleUnitIds,
    })
    .from(outcome)
    .innerJoin(action, eq(action.id, outcome.actionId))
    .innerJoin(insight, eq(insight.id, outcome.insightId))
    .where(and(eq(outcome.orgId, orgId), eq(outcome.status, "reviewed"), inArray(action.type, [...new Set(types)])))
    .orderBy(desc(outcome.windowEnd));
  return rows.filter((r) => r.insightId !== insightId && r.lesson && canRead(actor, r.visible)).slice(0, 3);
}
