/** Shared domain types. No framework or database imports (lint-enforced). */
export type Role = "admin" | "executive" | "department_manager" | "regional_manager" | "viewer";
export type UnitType = "group" | "region" | "branch" | "department";

/** An org unit as the domain sees it: its id, type and the ids of itself and its ancestors (root first). */
export type UnitRef = { id: string; type: UnitType; pathIds: string[] };

export type RoleAssignment = { role: Role; unit: UnitRef };

export type SystemActorId =
  "system:detector" | "system:policy" | "system:executor" | "system:outcome-evaluator" | "system:clock" | "system:ai";

export type Actor =
  | { kind: "user"; userId: string; assignments: RoleAssignment[]; sessionId: string; viaDemoSwitcher: boolean }
  | { kind: "system"; id: SystemActorId };

export const actorId = (a: Actor): string => (a.kind === "user" ? a.userId : a.id);

/** True if `unit` is inside the subtree rooted at `scopeUnitId`. */
export const inSubtree = (unit: UnitRef, scopeUnitId: string): boolean => unit.pathIds.includes(scopeUnitId);
