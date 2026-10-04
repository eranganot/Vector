/**
 * Authorization (docs/specs/authorization.md §1, §3): may this actor do this specific thing, here, now?
 * Pure function; the application layer calls it inside every command before the transition.
 */
import { DomainError } from "../errors";
import { type Actor, inSubtree, type SystemActorId, type UnitRef } from "../types";
import { type Capability, hasPermission } from "./permissions";

export type SystemOperation =
  | "insight.create"
  | "insight.attach_signal"
  | "insight.supersede"
  | "insight.resolve"
  | "decision.recommend"
  | "decision.auto_decide"
  | "decision.supersede"
  | "action.propose"
  | "action.submit"
  | "action.execute"
  | "approval.expire"
  | "approval.lapse"
  | "outcome.watch"
  | "outcome.evaluate";

/** What each system actor may do (authorization.md §1). They never approve. */
export const SYSTEM_ACTOR_OPERATIONS: Record<SystemActorId, ReadonlySet<SystemOperation>> = {
  "system:detector": new Set([
    "insight.create",
    "insight.attach_signal",
    "insight.supersede",
    "decision.recommend",
    "decision.supersede",
    "action.propose",
  ]),
  "system:policy": new Set(["action.submit", "decision.auto_decide"]),
  "system:executor": new Set(["action.execute", "outcome.watch"]),
  "system:outcome-evaluator": new Set(["outcome.evaluate", "insight.resolve"]),
  "system:clock": new Set(["approval.expire", "approval.lapse"]),
  "system:ai": new Set(["insight.create", "decision.recommend", "action.propose"]),
};

export type AuthzContext = {
  /** Units the operation touches. AZ-1: every one must be in a scope granting the capability. */
  targetUnits: UnitRef[];
  /** Session age in hours; writes need ≤ 12 (AZ-3). */
  sessionAgeHours?: number;
  isWrite?: boolean;
};

export type AuthzResult = { ok: true } | { ok: false; code: string; reason: string };

const deny = (code: string, reason: string): AuthzResult => ({ ok: false, code, reason });

export function authorizeUser(actor: Actor, capability: Capability, ctx: AuthzContext): AuthzResult {
  if (actor.kind !== "user") return deny("AZ-4", "system actors cannot use user capabilities");
  const granting = actor.assignments.filter((a) => hasPermission(a.role, capability));
  if (granting.length === 0) return deny("PermissionDenied", `no role grants ${capability}`);
  const sessionAge = ctx.sessionAgeHours ?? actor.sessionAgeHours ?? 0;
  if (ctx.isWrite && sessionAge > 12) return deny("AZ-3", "session too old for a write; sign in again");
  for (const unit of ctx.targetUnits) {
    if (!granting.some((a) => inSubtree(unit, a.unit.id)))
      return deny("AZ-1", `unit ${unit.id} is outside your scope for ${capability}`);
  }
  return { ok: true };
}

export function authorizeSystem(actor: Actor, op: SystemOperation): AuthzResult {
  if (actor.kind !== "system") return deny("AZ-4", "users cannot perform system operations");
  return SYSTEM_ACTOR_OPERATIONS[actor.id].has(op)
    ? { ok: true }
    : deny("PermissionDenied", `${actor.id} may not ${op}`);
}

export function assertAuthorized(result: AuthzResult): void {
  if (!result.ok)
    throw new DomainError(
      result.code === "PermissionDenied" ? "PermissionDenied" : "NotAuthorized",
      `${result.code}: ${result.reason}`,
    );
}

/** Read visibility (authorization.md §1): any scope unit of the user appears in the entity's visible units. */
export function canRead(actor: Actor, visibleUnitIds: string[]): boolean {
  if (actor.kind !== "user") return true;
  return actor.assignments.some((a) => hasPermission(a.role, "insight.read") && visibleUnitIds.includes(a.unit.id));
}
