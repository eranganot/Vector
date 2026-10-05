/**
 * Scoped audit explorer (Phase 4g; authorization.md §1: `audit.read` in scope). An event is visible when the entity it
 * is about is visible to the viewer: insights, actions and commitments by their visible units; decisions, approvals
 * and outcomes through their insight or action; conflicts when either commitment is visible. Organization-level
 * events (demo reset, clock) and refusals against a unit are shown to the Executive and Admin (group scope) only.
 * Everyone sees their own actions, including their refused attempts.
 */
import { desc, eq } from "drizzle-orm";
import { canRead } from "@/domain/policy/authorize";
import { hasPermission } from "@/domain/policy/permissions";
import type { Actor } from "@/domain/types";
import {
  action,
  approval,
  auditEvent,
  commitment,
  conflict,
  decision,
  insight,
  orgUnit,
  outcome,
  user,
} from "@/infra/db/schema";
import type { DbOrTx } from "../db";

export type AuditFilter = { entity?: string; actor?: string; op?: string; denied?: boolean; limit?: number };

export async function auditExplorer(db: DbOrTx, orgId: string, actor: Actor, f: AuditFilter = {}) {
  if (actor.kind !== "user") return null;
  const readers = actor.assignments.filter((a) => hasPermission(a.role, "audit.read"));
  if (readers.length === 0) return null;
  const groupWide = readers.some((a) => a.unit.type === "group");

  const [events, ins, acts, decs, aps, outs, cms, kfs, units, people] = await Promise.all([
    db.select().from(auditEvent).where(eq(auditEvent.orgId, orgId)).orderBy(desc(auditEvent.seq)),
    db
      .select({ id: insight.id, v: insight.visibleUnitIds, title: insight.title })
      .from(insight)
      .where(eq(insight.orgId, orgId)),
    db
      .select({ id: action.id, v: action.visibleUnitIds, insightId: action.insightId, title: action.title })
      .from(action)
      .where(eq(action.orgId, orgId)),
    db.select({ id: decision.id, insightId: decision.insightId }).from(decision).where(eq(decision.orgId, orgId)),
    db.select({ id: approval.id, actionId: approval.actionId }).from(approval).where(eq(approval.orgId, orgId)),
    db.select({ id: outcome.id, insightId: outcome.insightId }).from(outcome).where(eq(outcome.orgId, orgId)),
    db
      .select({ id: commitment.id, v: commitment.visibleUnitIds, title: commitment.title })
      .from(commitment)
      .where(eq(commitment.orgId, orgId)),
    db
      .select({ id: conflict.id, a: conflict.commitmentAId, b: conflict.commitmentBId, insightId: conflict.insightId })
      .from(conflict)
      .where(eq(conflict.orgId, orgId)),
    db
      .select({ id: orgUnit.id, name: orgUnit.name, pathIds: orgUnit.pathIds })
      .from(orgUnit)
      .where(eq(orgUnit.orgId, orgId)),
    db.select({ id: user.id, name: user.name }).from(user).where(eq(user.orgId, orgId)),
  ]);
  const insightOf = new Map<string, string>();
  for (const d of decs) insightOf.set(d.id, d.insightId);
  for (const o of outs) insightOf.set(o.id, o.insightId);
  const actionOf = new Map(aps.map((a) => [a.id, a.actionId]));
  const insightById = new Map(ins.map((i) => [i.id, i]));
  const actionById = new Map(acts.map((a) => [a.id, a]));
  const commitmentById = new Map(cms.map((c) => [c.id, c]));
  const conflictById = new Map(kfs.map((k) => [k.id, k]));
  const auditReader: Actor = { ...actor, assignments: readers };

  /** What the event is about, whether the viewer may see it, and where to look at it. */
  const subject = (e: (typeof events)[number]): { visible: boolean; label: string; href: string | null } => {
    const viaInsight = (id: string | undefined) => {
      const i = id ? insightById.get(id) : undefined;
      return i
        ? { visible: canRead(auditReader, i.v), label: i.title, href: `/insights/${i.id}` }
        : { visible: groupWide, label: e.entityType, href: null };
    };
    switch (e.entityType) {
      case "insight":
        return viaInsight(e.entityId);
      case "decision":
      case "outcome":
        return viaInsight(insightOf.get(e.entityId));
      case "action":
      case "approval": {
        const a = actionById.get(e.entityType === "action" ? e.entityId : (actionOf.get(e.entityId) ?? ""));
        return a
          ? { visible: canRead(auditReader, a.v), label: a.title, href: `/insights/${a.insightId}` }
          : { visible: groupWide, label: e.entityType, href: null };
      }
      case "commitment": {
        const c = commitmentById.get(e.entityId);
        return c
          ? { visible: canRead(auditReader, c.v), label: c.title, href: "/commitments" }
          : { visible: groupWide, label: "commitment", href: null };
      }
      case "conflict": {
        const k = conflictById.get(e.entityId);
        const sides = k ? [commitmentById.get(k.a), commitmentById.get(k.b)] : [];
        const visible = sides.some((c) => c && canRead(auditReader, c.v));
        return {
          visible: k ? visible : groupWide,
          label:
            sides
              .map((c) => c?.title)
              .filter(Boolean)
              .join(" × ") || "conflict",
          href: k?.insightId ? `/insights/${k.insightId}` : null,
        };
      }
      default:
        // organization (reset, clock), org_unit refusals, signals: group-wide readers only.
        return { visible: groupWide, label: units.find((u) => u.id === e.entityId)?.name ?? e.entityType, href: null };
    }
  };

  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  // People always see their own actions, including refused attempts outside their scope.
  const scoped = events.map((e) => ({ e, s: subject(e) })).filter((x) => x.s.visible || x.e.actorId === actor.userId);
  const actorsSeen = [...new Set(scoped.map((x) => x.e.actorId))]
    .map((id) => ({ id, name: personName(id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const entityTypes = [...new Set(scoped.map((x) => x.e.entityType))].sort();
  const op = f.op?.trim().toLowerCase();
  const shown = scoped.filter(
    (x) =>
      (!f.entity || x.e.entityType === f.entity) &&
      (!f.actor || x.e.actorId === f.actor) &&
      (!op || x.e.operation.toLowerCase().includes(op)) &&
      (!f.denied || x.e.operation.endsWith(".denied")),
  );
  const limit = f.limit ?? 200;
  return {
    groupWide,
    total: scoped.length,
    matching: shown.length,
    actors: actorsSeen,
    entityTypes,
    events: shown.slice(0, limit).map(({ e, s }) => ({
      id: e.id,
      seq: e.seq,
      at: e.occurredAt,
      actor: personName(e.actorId),
      actorType: e.actorType,
      viaDemoSwitcher: e.viaDemoSwitcher,
      operation: e.operation,
      entityType: e.entityType,
      subject: s.label,
      href: s.href,
      fromState: e.fromState,
      toState: e.toState,
      reason: e.reason,
    })),
  };
}
