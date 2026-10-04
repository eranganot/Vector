/**
 * Approval policy v2 (docs/specs/authorization.md §4). Each rule either does not match, or yields the
 * set of eligible approvers. One approval suffices only if the approver is eligible under EVERY matched
 * rule; the Executive (group scope) is eligible under all of them.
 */
import { inSubtree, type RoleAssignment, type Role, type UnitRef } from "../types";

export const APPROVAL_POLICY_VERSION = "approval-policy-v2";
/** Action types that only inform a person inside the company; AP-5 never holds them (G3, Eran 2026-10-04). */
const INTERNAL_NOTICE_TYPES = new Set(["notify_owner"]);
export const COST_THRESHOLD = 10_000;
export const EXECUTIVE_COST_THRESHOLD = 50_000;
const LEGAL_TYPES = new Set(["regulatory_notification", "contract_clause_invocation", "recall"]);

export type ApproverOption = { role: Role; unit: UnitRef };
export type RuleResult = { rule: string; name: string; matched: boolean; reason: string; eligible: ApproverOption[] };
export type ApprovalRequirement = { policyVersion: string; required: boolean; rules: RuleResult[] };

export type ActionFacts = {
  type: string;
  executor: "internal_task" | "outbox_message";
  audience?: "internal" | "external";
  targetUnits: UnitRef[];
  estimatedCost: number;
  /** Risk band P1–P4, or opportunity band O1–O3 (AP-5 applies to P1 risks only). */
  insightBand: string;
  insightPrimaryUnit: UnitRef;
};

export type OrgFacts = {
  group: UnitRef;
  supplyChain?: UnitRef;
  legal?: UnitRef;
  /** Department that owns the budget for this action, if any (AP-3). */
  budgetDepartment?: UnitRef;
  /**
   * Department that owns the response to the insight (insight.owner_department_id). Its manager is
   * accountable for the issue and may approve its actions under AP-1, AP-3 (below the Executive
   * threshold) and AP-5 (G3, Eran 2026-10-04: e.g. the recall is approved inside Legal, not by the CEO).
   */
  ownerDepartment?: UnitRef;
};

/** The region a unit belongs to (branches and regions only), as a UnitRef. */
export function regionOf(unit: UnitRef): UnitRef | undefined {
  if (unit.type !== "branch" && unit.type !== "region") return undefined;
  return { id: unit.pathIds[1], type: "region", pathIds: unit.pathIds.slice(0, 2) };
}

function regions(units: UnitRef[]): UnitRef[] {
  const map = new Map<string, UnitRef>();
  for (const u of units) {
    const r = regionOf(u);
    if (r) map.set(r.id, r);
  }
  return [...map.values()];
}

/** Regional Manager of the single region the units sit in; none if they span regions (then only the Executive). */
function singleRegionManager(units: UnitRef[]): ApproverOption[] {
  const rs = regions(units);
  return rs.length === 1 ? [{ role: "regional_manager", unit: rs[0] }] : [];
}

export function evaluateApprovalPolicy(a: ActionFacts, org: OrgFacts): ApprovalRequirement {
  const exec: ApproverOption = { role: "executive", unit: org.group };
  const dept = (u?: UnitRef): ApproverOption[] => (u ? [{ role: "department_manager", unit: u }] : []);
  const rule = (id: string, name: string, matched: boolean, reason: string, options: ApproverOption[]): RuleResult => ({
    rule: id,
    name,
    matched,
    reason,
    eligible: matched ? [...options, exec] : [],
  });
  const regionCount = regions(a.targetUnits).length;

  const rules = [
    rule(
      "AP-1",
      "External communication",
      a.executor === "outbox_message" && a.audience === "external",
      `executor=${a.executor}, audience=${a.audience ?? "internal"}`,
      [...singleRegionManager(a.targetUnits), ...dept(org.ownerDepartment)],
    ),
    rule("AP-2", "Cross-region", regionCount > 1, `targets span ${regionCount} region(s)`, []),
    rule(
      "AP-3",
      "Cost",
      a.estimatedCost >= COST_THRESHOLD,
      `estimated cost ₪${a.estimatedCost}`,
      a.estimatedCost >= EXECUTIVE_COST_THRESHOLD
        ? []
        : [...dept(org.budgetDepartment), ...singleRegionManager(a.targetUnits), ...dept(org.ownerDepartment)],
    ),
    rule("AP-4", "Inventory transfer", a.type === "inventory_transfer", `type=${a.type}`, [
      ...singleRegionManager(a.targetUnits),
      ...dept(org.supplyChain),
    ]),
    rule(
      "AP-5",
      "High priority",
      a.insightBand === "P1" && !INTERNAL_NOTICE_TYPES.has(a.type),
      `insight band ${a.insightBand}${INTERNAL_NOTICE_TYPES.has(a.type) ? ", internal notice" : ""}`,
      [...singleRegionManager([a.insightPrimaryUnit]), ...dept(org.ownerDepartment)],
    ),
    rule("AP-6", "Staffing change", a.type === "staffing_change", `type=${a.type}`, singleRegionManager(a.targetUnits)),
    rule("AP-7", "Legal and regulatory", LEGAL_TYPES.has(a.type), `type=${a.type}`, dept(org.legal)),
  ];
  return { policyVersion: APPROVAL_POLICY_VERSION, required: rules.some((r) => r.matched), rules };
}

const satisfies = (assignments: RoleAssignment[], option: ApproverOption) =>
  assignments.some((as) => as.role === option.role && inSubtree(option.unit, as.unit.id));

/** True if these role assignments make the person eligible under every matched rule. */
export function isEligibleApprover(assignments: RoleAssignment[], req: ApprovalRequirement): boolean {
  const matched = req.rules.filter((r) => r.matched);
  return matched.length > 0 && matched.every((r) => r.eligible.some((o) => satisfies(assignments, o)));
}
