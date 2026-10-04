/**
 * Scoped read queries. Visibility is enforced in SQL with the entity's visible_unit_ids
 * (authorization.md §1); out-of-scope ids behave exactly like missing ones (404, not 403).
 */
import { and, arrayOverlaps, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { isEligibleApprover, type ApprovalRequirement } from "@/domain/policy/approval-rules";
import { hasPermission } from "@/domain/policy/permissions";
import { authorizeUser } from "@/domain/policy/authorize";
import type { Actor, RoleAssignment } from "@/domain/types";
import {
  action,
  approval,
  auditEvent,
  decision,
  evidence,
  insight,
  orgUnit,
  outcome,
  signal,
  task,
  outboxMessage,
  roleAssignment,
  user,
} from "@/infra/db/schema";
import type { DbOrTx } from "../db";
import { localPriorities } from "./performance";

/** Unit ids from which this user may read (scope roots of roles that grant insight.read). */
export function readScope(actor: Actor): string[] {
  if (actor.kind !== "user") return [];
  return actor.assignments.filter((a) => hasPermission(a.role, "insight.read")).map((a) => a.unit.id);
}

/**
 * Insights in the viewer's scope. Region and branch managers also get the scope-relative ("local")
 * priority (ADR-006) and are ranked by it; everyone else is ranked by the organizational priority.
 */
export async function listInsights(db: DbOrTx, orgId: string, actor: Actor) {
  const scope = readScope(actor);
  if (scope.length === 0) return [];
  const owner = alias(orgUnit, "owner_unit");
  const rows = await db
    .select({
      id: insight.id,
      workstream: insight.workstream,
      title: insight.title,
      priorityScore: insight.priorityScore,
      priorityBand: insight.priorityBand,
      status: insight.status,
      primaryUnitId: insight.primaryUnitId,
      primaryUnitName: orgUnit.name,
      ownerDepartmentName: owner.name,
      affectedUnitIds: insight.affectedUnitIds,
      priorityBreakdown: insight.priorityBreakdown,
      createdAt: insight.createdAt,
    })
    .from(insight)
    .innerJoin(orgUnit, eq(orgUnit.id, insight.primaryUnitId))
    .leftJoin(owner, eq(owner.id, insight.ownerDepartmentId))
    .where(and(eq(insight.orgId, orgId), arrayOverlaps(insight.visibleUnitIds, scope)))
    .orderBy(desc(insight.priorityScore));
  const local = await localPriorities(db, orgId, actor, rows);
  return rows
    .map((r) => ({
      id: r.id,
      workstream: r.workstream,
      title: r.title,
      priorityScore: r.priorityScore,
      priorityBand: r.priorityBand,
      status: r.status,
      primaryUnitId: r.primaryUnitId,
      primaryUnitName: r.primaryUnitName,
      ownerDepartmentName: r.ownerDepartmentName,
      createdAt: r.createdAt,
      local: local.get(r.id) ?? null,
    }))
    .sort((a, b) => (b.local?.score ?? b.priorityScore) - (a.local?.score ?? a.priorityScore));
}

export async function getInsightTrace(db: DbOrTx, orgId: string, actor: Actor, insightId: string) {
  const scope = readScope(actor);
  if (scope.length === 0) return null;
  const [ins] = await db
    .select()
    .from(insight)
    .where(and(eq(insight.id, insightId), eq(insight.orgId, orgId), arrayOverlaps(insight.visibleUnitIds, scope)));
  if (!ins) return null;
  const [signals, evidences, decisions, actions, units] = await Promise.all([
    db.select().from(signal).where(inArray(signal.id, ins.signalIds)),
    db.select().from(evidence).where(inArray(evidence.id, ins.evidenceIds)),
    db.select().from(decision).where(eq(decision.insightId, ins.id)).orderBy(asc(decision.createdAt)),
    db.select().from(action).where(eq(action.insightId, ins.id)).orderBy(asc(action.createdAt)),
    // All units of the org: approval rules name approver scopes (e.g. the group) beyond the affected units.
    db.select({ id: orgUnit.id, name: orgUnit.name, type: orgUnit.type }).from(orgUnit).where(eq(orgUnit.orgId, orgId)),
  ]);
  // Keep the order the insight recorded (a query without ORDER BY may return them in any order).
  const byStoredOrder = <T extends { id: string }>(rows: T[], ids: string[]) =>
    [...rows].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  signals.splice(0, signals.length, ...byStoredOrder(signals, ins.signalIds));
  evidences.splice(0, evidences.length, ...byStoredOrder(evidences, ins.evidenceIds));
  const actionIds = actions.map((a) => a.id);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [approvals, outcomes, tasks, messages, audit] = await Promise.all([
    db
      .select()
      .from(approval)
      .where(inArray(approval.actionId, actionIds.length ? actionIds : none))
      .orderBy(asc(approval.requestedAt)),
    db.select().from(outcome).where(eq(outcome.insightId, ins.id)),
    db
      .select()
      .from(task)
      .where(inArray(task.actionId, actionIds.length ? actionIds : none)),
    db
      .select()
      .from(outboxMessage)
      .where(inArray(outboxMessage.actionId, actionIds.length ? actionIds : none)),
    auditTrailForInsight(db, orgId, ins.id),
  ]);
  // Only the people this insight's record refers to (never the whole user table, which spans organizations).
  const personIds = [
    ...decisions.map((d) => d.decidedBy),
    ...actions.flatMap((a) => [a.ownerUserId, a.proposedBy]),
    ...approvals.map((a) => a.approverUserId),
    ...tasks.map((x) => x.assigneeUserId),
    ...audit.map((e) => e.actorId),
  ].filter((id): id is string => !!id && !id.startsWith("system:") && !id.startsWith("policy:"));
  const people = personIds.length
    ? await db
        .select({ id: user.id, name: user.name, title: user.title })
        .from(user)
        .where(inArray(user.id, [...new Set(personIds)]))
    : [];
  const local = (await localPriorities(db, orgId, actor, [ins])).get(ins.id) ?? null;
  return {
    insight: ins,
    local,
    signals,
    evidence: evidences,
    decisions,
    actions,
    approvals,
    outcomes,
    tasks,
    messages,
    units,
    people,
    audit,
  };
}

/** Every audit row for the insight and the entities hanging off it, in chain order. */
export async function auditTrailForInsight(db: DbOrTx, orgId: string, insightId: string) {
  return db
    .select()
    .from(auditEvent)
    .where(
      and(
        eq(auditEvent.orgId, orgId),
        sql`${auditEvent.entityId} in (
          select ${insight.id} from ${insight} where ${insight.id} = ${insightId}
          union select ${decision.id} from ${decision} where ${decision.insightId} = ${insightId}
          union select ${action.id} from ${action} where ${action.insightId} = ${insightId}
          union select ${approval.id} from ${approval} join ${action} on ${approval.actionId} = ${action.id} where ${action.insightId} = ${insightId}
          union select ${outcome.id} from ${outcome} where ${outcome.insightId} = ${insightId}
        )`,
      ),
    )
    .orderBy(asc(auditEvent.seq));
}

type Person = { name: string; assignments: RoleAssignment[] };

/** Everyone in the org with their role assignments (for routing approvals). */
async function peopleWithAssignments(db: DbOrTx, orgId: string) {
  const rows = await db
    .select({ id: user.id, name: user.name, role: roleAssignment.role, unit: orgUnit })
    .from(user)
    .innerJoin(roleAssignment, eq(roleAssignment.userId, user.id))
    .innerJoin(orgUnit, eq(orgUnit.id, roleAssignment.orgUnitId))
    .where(eq(roleAssignment.orgId, orgId));
  const byPerson = new Map<string, Person>();
  for (const p of rows) {
    const e = byPerson.get(p.id) ?? { name: p.name, assignments: [] };
    e.assignments.push({ role: p.role, unit: { id: p.unit.id, type: p.unit.type, pathIds: p.unit.pathIds } });
    byPerson.set(p.id, e);
  }
  return byPerson;
}

/**
 * Who an approval request is routed to: the eligible people other than the action's owner and proposer
 * (AZ-2), excluding the Executive when anyone else is eligible. The Executive stays eligible under every
 * rule (a fallback and escalation path) but is only *asked* when nobody else may approve (G3, Eran 2026-10-04).
 */
function routeApproval(
  people: Map<string, Person>,
  requirement: ApprovalRequirement,
  act: { ownerUserId: string; proposedBy: string },
) {
  const eligible = [...people.entries()].filter(
    ([id, p]) => id !== act.ownerUserId && id !== act.proposedBy && isEligibleApprover(p.assignments, requirement),
  );
  const isExec = (p: Person) => p.assignments.some((a) => a.role === "executive");
  const others = eligible.filter(([, p]) => !isExec(p));
  return others.length > 0 ? others : eligible;
}

/** Open approval requests routed to this person (see routeApproval). */
export async function listMyApprovals(db: DbOrTx, orgId: string, actor: Actor) {
  if (actor.kind !== "user") return [];
  const rows = await db
    .select({ approval, action, insightTitle: insight.title, band: insight.priorityBand, insightId: insight.id })
    .from(approval)
    .innerJoin(action, eq(action.id, approval.actionId))
    .innerJoin(insight, eq(insight.id, action.insightId))
    .where(and(eq(approval.orgId, orgId), eq(approval.status, "requested")))
    .orderBy(desc(insight.priorityScore));
  const mine = rows.filter(
    (r) =>
      isEligibleApprover(actor.assignments, r.approval.requirement as ApprovalRequirement) &&
      r.action.proposedBy !== actor.userId &&
      r.action.ownerUserId !== actor.userId,
  );
  if (mine.length === 0) return [];
  const people = await peopleWithAssignments(db, orgId);
  const targets = await db.select({ id: orgUnit.id, name: orgUnit.name }).from(orgUnit).where(eq(orgUnit.orgId, orgId));
  return mine
    .map((r) => ({ r, routed: routeApproval(people, r.approval.requirement as ApprovalRequirement, r.action) }))
    .filter(({ routed }) => routed.some(([id]) => id === actor.userId))
    .map(({ r, routed }) => ({
      ...r,
      /** Who else this request is routed to (any one of them may answer it). */
      alsoAsked: routed.filter(([id]) => id !== actor.userId).map(([, p]) => p.name),
      targetNames: r.action.targetUnitIds.map((id) => targets.find((t) => t.id === id)?.name ?? "—"),
    }));
}

/** The person's own recent answers to approval requests (Phase 4: approval workflow history). */
export async function listMyApprovalHistory(db: DbOrTx, orgId: string, actor: Actor, limit = 10) {
  if (actor.kind !== "user") return [];
  return db
    .select({
      id: approval.id,
      status: approval.status,
      rationale: approval.rationale,
      decidedAt: approval.decidedAt,
      revision: approval.actionRevision,
      actionTitle: action.title,
      actionStatus: action.status,
      insightId: insight.id,
      band: insight.priorityBand,
    })
    .from(approval)
    .innerJoin(action, eq(action.id, approval.actionId))
    .innerJoin(insight, eq(insight.id, action.insightId))
    .where(and(eq(approval.orgId, orgId), eq(approval.approverUserId, actor.userId)))
    .orderBy(desc(approval.decidedAt))
    .limit(limit);
}

/**
 * Recommendations waiting for this person's decision: open insights whose decision is still
 * "recommended" and whose primary unit is exactly a unit this person manages (the accountable
 * decider). The Executive is the decider for group-level insights. Others in scope may still
 * decide from the trace page; they are not asked to.
 */
export async function listMyDecisions(db: DbOrTx, orgId: string, actor: Actor) {
  if (actor.kind !== "user") return [];
  const managed = actor.assignments.filter((a) => hasPermission(a.role, "decision.decide")).map((a) => a.unit.id);
  if (managed.length === 0) return [];
  const owner = alias(orgUnit, "owner_unit");
  return db
    .select({
      decisionId: decision.id,
      statement: decision.statement,
      insightId: insight.id,
      title: insight.title,
      band: insight.priorityBand,
      score: insight.priorityScore,
      workstream: insight.workstream,
      ownerDepartmentName: owner.name,
    })
    .from(decision)
    .innerJoin(insight, eq(insight.id, decision.insightId))
    .leftJoin(owner, eq(owner.id, insight.ownerDepartmentId))
    .where(
      and(
        eq(decision.orgId, orgId),
        eq(decision.status, "recommended"),
        inArray(insight.status, ["open", "acknowledged"]),
        inArray(insight.primaryUnitId, managed),
      ),
    )
    .orderBy(desc(insight.priorityScore));
}

/** Actions this person owns that are not finished, with who an approval is waiting on. */
export async function listMyActions(db: DbOrTx, orgId: string, actor: Actor) {
  if (actor.kind !== "user") return [];
  const rows = await db
    .select({ action, insightTitle: insight.title, insightId: insight.id, band: insight.priorityBand })
    .from(action)
    .innerJoin(insight, eq(insight.id, action.insightId))
    .where(
      and(
        eq(action.orgId, orgId),
        eq(action.ownerUserId, actor.userId),
        inArray(action.status, ["proposed", "pending_approval", "ready", "executing", "failed"]),
      ),
    )
    .orderBy(desc(insight.priorityScore));
  const pending = rows.filter((r) => r.action.status === "pending_approval");
  if (pending.length === 0) return rows.map((r) => ({ ...r, waitingOn: [] as string[] }));
  const reqs = await db
    .select()
    .from(approval)
    .where(
      and(
        inArray(
          approval.actionId,
          pending.map((r) => r.action.id),
        ),
        eq(approval.status, "requested"),
      ),
    );
  const people = await peopleWithAssignments(db, orgId);
  return rows.map((r) => {
    const req = reqs.find((x) => x.actionId === r.action.id);
    const waitingOn = req
      ? routeApproval(people, req.requirement as ApprovalRequirement, r.action).map(([, p]) => p.name)
      : [];
    return { ...r, waitingOn };
  });
}

/** Cosmetic check for the UI (the command re-checks): may this person decide on this insight? */
export async function canDecide(db: DbOrTx, orgId: string, actor: Actor, insightId: string) {
  const [ins] = await db
    .select({ primaryUnitId: insight.primaryUnitId })
    .from(insight)
    .where(and(eq(insight.id, insightId), eq(insight.orgId, orgId)));
  if (!ins) return false;
  const [u] = await db.select().from(orgUnit).where(eq(orgUnit.id, ins.primaryUnitId));
  return authorizeUser(actor, "decision.decide", {
    targetUnits: [{ id: u.id, type: u.type, pathIds: u.pathIds }],
    isWrite: true,
  }).ok;
}
