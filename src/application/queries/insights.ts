/**
 * Scoped read queries. Visibility is enforced in SQL with the entity's visible_unit_ids
 * (authorization.md §1); out-of-scope ids behave exactly like missing ones (404, not 403).
 */
import { and, arrayOverlaps, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { isEligibleApprover, type ApprovalRequirement } from "@/domain/policy/approval-rules";
import { hasPermission } from "@/domain/policy/permissions";
import type { Actor } from "@/domain/types";
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
  user,
} from "@/infra/db/schema";
import type { DbOrTx } from "../db";

/** Unit ids from which this user may read (scope roots of roles that grant insight.read). */
export function readScope(actor: Actor): string[] {
  if (actor.kind !== "user") return [];
  return actor.assignments.filter((a) => hasPermission(a.role, "insight.read")).map((a) => a.unit.id);
}

export async function listInsights(db: DbOrTx, orgId: string, actor: Actor) {
  const scope = readScope(actor);
  if (scope.length === 0) return [];
  return db
    .select({
      id: insight.id,
      workstream: insight.workstream,
      title: insight.title,
      priorityScore: insight.priorityScore,
      priorityBand: insight.priorityBand,
      status: insight.status,
      primaryUnitId: insight.primaryUnitId,
      primaryUnitName: orgUnit.name,
      createdAt: insight.createdAt,
    })
    .from(insight)
    .innerJoin(orgUnit, eq(orgUnit.id, insight.primaryUnitId))
    .where(and(eq(insight.orgId, orgId), arrayOverlaps(insight.visibleUnitIds, scope)))
    .orderBy(desc(insight.priorityScore));
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
    db
      .select({ id: orgUnit.id, name: orgUnit.name, type: orgUnit.type })
      .from(orgUnit)
      .where(inArray(orgUnit.id, [ins.primaryUnitId, ...ins.affectedUnitIds])),
  ]);
  const actionIds = actions.map((a) => a.id);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [approvals, outcomes, tasks, messages, people, audit] = await Promise.all([
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
    db.select({ id: user.id, name: user.name, title: user.title }).from(user),
    auditTrailForInsight(db, orgId, ins.id),
  ]);
  return {
    insight: ins,
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

/** Open approval requests this person is eligible to answer, excluding their own actions (AZ-2). */
export async function listMyApprovals(db: DbOrTx, orgId: string, actor: Actor) {
  if (actor.kind !== "user") return [];
  const rows = await db
    .select({ approval, action, insightTitle: insight.title, band: insight.priorityBand, insightId: insight.id })
    .from(approval)
    .innerJoin(action, eq(action.id, approval.actionId))
    .innerJoin(insight, eq(insight.id, action.insightId))
    .where(and(eq(approval.orgId, orgId), eq(approval.status, "requested")))
    .orderBy(desc(insight.priorityScore));
  return rows.filter(
    (r) =>
      isEligibleApprover(actor.assignments, r.approval.requirement as ApprovalRequirement) &&
      r.action.proposedBy !== actor.userId &&
      r.action.ownerUserId !== actor.userId,
  );
}
