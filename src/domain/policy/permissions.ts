/** Permission matrix (docs/specs/authorization.md §2): may this role ever do this kind of thing? */
import type { Role } from "../types";

export const CAPABILITIES = [
  "insight.read",
  "insight.acknowledge",
  "insight.dismiss",
  "insight.resolve",
  "decision.decide",
  "action.propose",
  "action.approve",
  "action.execute",
  "action.cancel",
  "outcome.review",
  "commitment.record",
  "commitment.update",
  /** Plan v2 (E1c): record and update a cross-department initiative (cross-department.md §3). */
  "initiative.record",
  /** Plan v2 (E3): complete or move a milestone, raise or resolve a barrier, send a reminder. */
  "initiative.update",
  /** Plan v2 (E5): generate a report for your own scope or a unit below it (reports.md §1). */
  "report.generate",
  "audit.read",
  "config.priority_weights.propose",
  "config.priority_weights.approve",
  "admin.users",
  "admin.policy",
  "demo.control",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const MANAGER: Capability[] = [
  "insight.read",
  "insight.acknowledge",
  "insight.dismiss",
  "insight.resolve",
  "decision.decide",
  "action.propose",
  "action.approve",
  "action.execute",
  "action.cancel",
  "outcome.review",
  "commitment.record",
  "commitment.update",
  "report.generate",
  "audit.read",
];

export const PERMISSIONS: Record<Role, ReadonlySet<Capability>> = {
  admin: new Set<Capability>([
    "insight.read",
    "audit.read",
    "config.priority_weights.propose",
    "admin.users",
    "admin.policy",
    "demo.control",
  ]),
  executive: new Set<Capability>([
    ...MANAGER,
    "initiative.record",
    "initiative.update",
    "config.priority_weights.propose",
    "config.priority_weights.approve",
  ]),
  department_manager: new Set<Capability>([...MANAGER, "initiative.record", "initiative.update"]),
  regional_manager: new Set<Capability>(MANAGER),
  viewer: new Set<Capability>(["insight.read"]),
};

export const hasPermission = (role: Role, capability: Capability): boolean => PERMISSIONS[role].has(capability);
