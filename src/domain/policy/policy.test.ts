import { describe, expect, it } from "vitest";
import type { Actor, RoleAssignment, UnitRef } from "../types";
import { evaluateApprovalPolicy, isEligibleApprover, type ActionFacts, type OrgFacts } from "./approval-rules";
import { authorizeSystem, authorizeUser, canRead } from "./authorize";
import { hasPermission, type Capability } from "./permissions";

// Phase 2 org shape (ids are readable stand-ins).
const G: UnitRef = { id: "G", type: "group", pathIds: ["G"] };
const NORTH: UnitRef = { id: "N", type: "region", pathIds: ["G", "N"] };
const CENTER: UnitRef = { id: "C", type: "region", pathIds: ["G", "C"] };
const HGC: UnitRef = { id: "HGC", type: "branch", pathIds: ["G", "N", "HGC"] };
const HDT: UnitRef = { id: "HDT", type: "branch", pathIds: ["G", "N", "HDT"] };
const TLV: UnitRef = { id: "TLV", type: "branch", pathIds: ["G", "C", "TLV"] };
const SUPPLY: UnitRef = { id: "SC", type: "department", pathIds: ["G", "SC"] };
const org: OrgFacts = { group: G, supplyChain: SUPPLY };

const user = (userId: string, assignments: RoleAssignment[]): Actor => ({
  kind: "user",
  userId,
  assignments,
  sessionId: "s",
  viaDemoSwitcher: false,
});
const dana = user("dana", [{ role: "executive", unit: G }]);
const yossi = user("yossi", [{ role: "regional_manager", unit: NORTH }]);
const maya = user("maya", [{ role: "regional_manager", unit: CENTER }]);
const avi = user("avi", [{ role: "regional_manager", unit: HGC }]);
const noa = user("noa", [{ role: "department_manager", unit: SUPPLY }]);
const tal = user("tal", [{ role: "viewer", unit: G }]);
const admin = user("admin", [{ role: "admin", unit: G }]);
const assignments = (a: Actor) => (a.kind === "user" ? a.assignments : []);

// The permission matrix, transcribed from docs/specs/authorization.md §2 (A=admin E=exec D=dept R=regional V=viewer).
const MATRIX: [Capability, string][] = [
  ["insight.read", "AEDRV"],
  ["insight.acknowledge", "EDR"],
  ["insight.dismiss", "EDR"],
  ["insight.resolve", "EDR"],
  ["decision.decide", "EDR"],
  ["action.propose", "EDR"],
  ["action.approve", "EDR"],
  ["action.execute", "EDR"],
  ["action.cancel", "EDR"],
  ["outcome.review", "EDR"],
  ["initiative.record", "ED"],
  ["initiative.update", "ED"],
  ["audit.read", "AEDR"],
  ["config.priority_weights.propose", "AE"],
  ["config.priority_weights.approve", "E"],
  ["admin.users", "A"],
  ["admin.policy", "A"],
  ["demo.control", "A"],
];
const ROLE_LETTER = {
  admin: "A",
  executive: "E",
  department_manager: "D",
  regional_manager: "R",
  viewer: "V",
} as const;

describe("permission matrix (authorization.md §2)", () => {
  for (const [cap, letters] of MATRIX) {
    for (const [role, letter] of Object.entries(ROLE_LETTER)) {
      it(`${role} ${letters.includes(letter) ? "has" : "lacks"} ${cap}`, () => {
        expect(hasPermission(role as keyof typeof ROLE_LETTER, cap)).toBe(letters.includes(letter));
      });
    }
  }
});

describe("authorization (AZ rules)", () => {
  it("AZ-1: a branch manager can act on their branch but not a sibling", () => {
    expect(authorizeUser(avi, "insight.acknowledge", { targetUnits: [HGC] }).ok).toBe(true);
    expect(authorizeUser(avi, "insight.acknowledge", { targetUnits: [HDT] })).toMatchObject({
      ok: false,
      code: "AZ-1",
    });
  });
  it("AZ-1: every target unit must be in scope", () => {
    expect(authorizeUser(yossi, "action.propose", { targetUnits: [HGC, TLV] })).toMatchObject({
      ok: false,
      code: "AZ-1",
    });
  });
  it("viewers and admins cannot decide", () => {
    expect(authorizeUser(tal, "decision.decide", { targetUnits: [HGC] })).toMatchObject({
      ok: false,
      code: "PermissionDenied",
    });
    expect(authorizeUser(admin, "decision.decide", { targetUnits: [HGC] })).toMatchObject({
      ok: false,
      code: "PermissionDenied",
    });
  });
  it("AZ-3: stale sessions cannot write", () => {
    expect(
      authorizeUser(dana, "decision.decide", { targetUnits: [HGC], isWrite: true, sessionAgeHours: 13 }),
    ).toMatchObject({ ok: false, code: "AZ-3" });
  });
  it("AZ-4: system actors and users stay in their lanes", () => {
    expect(
      authorizeUser({ kind: "system", id: "system:executor" }, "action.approve", { targetUnits: [] }),
    ).toMatchObject({ ok: false, code: "AZ-4" });
    expect(authorizeSystem(dana, "action.execute")).toMatchObject({ ok: false, code: "AZ-4" });
  });
  it("system actors have only their own operations; none can approve", () => {
    expect(authorizeSystem({ kind: "system", id: "system:detector" }, "insight.create").ok).toBe(true);
    expect(authorizeSystem({ kind: "system", id: "system:detector" }, "action.execute").ok).toBe(false);
    expect(authorizeSystem({ kind: "system", id: "system:ai" }, "decision.auto_decide").ok).toBe(false);
  });
  it("read visibility: a department manager sees insights that list their department", () => {
    expect(canRead(noa, ["G", "N", "HGC", "SC"])).toBe(true);
    expect(canRead(noa, ["G", "N", "HGC"])).toBe(false);
    expect(canRead(maya, ["G", "N", "HGC"])).toBe(false);
    expect(canRead(tal, ["G", "N", "HGC"])).toBe(true);
  });
});

describe("approval policy (authorization.md §4)", () => {
  const facts = (over: Partial<ActionFacts>): ActionFacts => ({
    type: "notify_owner",
    executor: "internal_task",
    targetUnits: [HGC],
    estimatedCost: 0,
    insightBand: "P2",
    insightPrimaryUnit: HGC,
    ...over,
  });
  const matched = (f: ActionFacts) =>
    evaluateApprovalPolicy(f, org)
      .rules.filter((r) => r.matched)
      .map((r) => r.rule);

  it("no rule matches an internal notification → no approval needed, rules still listed", () => {
    const req = evaluateApprovalPolicy(facts({}), org);
    expect(req.required).toBe(false);
    expect(req.rules).toHaveLength(7);
  });
  it("Phase 2 story: inventory transfer into Haifa GC → AP-4 → Yossi or Noa or Dana, never Avi or Maya", () => {
    const req = evaluateApprovalPolicy(facts({ type: "inventory_transfer", estimatedCost: 6000 }), org);
    expect(matched(facts({ type: "inventory_transfer", estimatedCost: 6000 }))).toEqual(["AP-4"]);
    expect(isEligibleApprover(assignments(yossi), req)).toBe(true);
    expect(isEligibleApprover(assignments(noa), req)).toBe(true);
    expect(isEligibleApprover(assignments(dana), req)).toBe(true);
    expect(isEligibleApprover(assignments(avi), req)).toBe(false);
    expect(isEligibleApprover(assignments(maya), req)).toBe(false);
  });
  it("must be eligible under EVERY matched rule: AP-4 + AP-5 excludes the Supply Chain manager", () => {
    const req = evaluateApprovalPolicy(facts({ type: "inventory_transfer", insightBand: "P1" }), org);
    expect(isEligibleApprover(assignments(yossi), req)).toBe(true);
    expect(isEligibleApprover(assignments(noa), req)).toBe(false);
  });
  it("AP-2 cross-region and AP-3 ≥ ₪50k leave only the Executive", () => {
    for (const f of [facts({ targetUnits: [HGC, TLV] }), facts({ estimatedCost: 54_000 })]) {
      const req = evaluateApprovalPolicy(f, org);
      expect(isEligibleApprover(assignments(dana), req)).toBe(true);
      expect(isEligibleApprover(assignments(yossi), req)).toBe(false);
    }
  });
  it("AP-1 external messages and AP-6 staffing match", () => {
    expect(matched(facts({ executor: "outbox_message", audience: "external" }))).toEqual(["AP-1"]);
    expect(matched(facts({ type: "staffing_change" }))).toEqual(["AP-6"]);
  });
  it("AP-7 legal actions need Legal or the Executive", () => {
    const req = evaluateApprovalPolicy(facts({ type: "recall" }), org);
    expect(req.rules.find((r) => r.rule === "AP-7")?.matched).toBe(true);
    expect(isEligibleApprover(assignments(yossi), req)).toBe(false);
    expect(isEligibleApprover(assignments(dana), req)).toBe(true);
  });
  it("admins and viewers are never eligible approvers", () => {
    const req = evaluateApprovalPolicy(facts({ type: "inventory_transfer" }), org);
    expect(isEligibleApprover(assignments(admin), req)).toBe(false);
    expect(isEligibleApprover(assignments(tal), req)).toBe(false);
  });
  it("nobody is 'eligible' when no rule matched (no approval exists to give)", () => {
    expect(isEligibleApprover(assignments(dana), evaluateApprovalPolicy(facts({}), org))).toBe(false);
  });
});

describe("approval policy v2: the owning department approves its own issue (G3, Eran 2026-10-04)", () => {
  const LEGAL: UnitRef = { id: "LG", type: "department", pathIds: ["G", "LG"] };
  const yael = user("yael", [{ role: "department_manager", unit: LEGAL }]);
  const recallOrg: OrgFacts = {
    group: G,
    supplyChain: SUPPLY,
    legal: LEGAL,
    budgetDepartment: SUPPLY,
    ownerDepartment: LEGAL,
  };
  const p1 = (over: Partial<ActionFacts>): ActionFacts => ({
    type: "recall",
    executor: "internal_task",
    targetUnits: [G],
    estimatedCost: 12_000,
    insightBand: "P1",
    insightPrimaryUnit: LEGAL,
    ...over,
  });

  it("the recall (AP-3 + AP-5 + AP-7) is approvable inside Legal, not only by the CEO", () => {
    const req = evaluateApprovalPolicy(p1({}), recallOrg);
    expect(req.rules.filter((r) => r.matched).map((r) => r.rule)).toEqual(["AP-3", "AP-5", "AP-7"]);
    expect(isEligibleApprover(assignments(yael), req)).toBe(true);
    expect(isEligibleApprover(assignments(noa), req)).toBe(false); // budget owner, but not Legal (AP-7)
    expect(isEligibleApprover(assignments(dana), req)).toBe(true); // the Executive stays a fallback
  });

  it("an external customer notice on the owner's issue is approvable by the owning department (AP-1)", () => {
    const req = evaluateApprovalPolicy(
      p1({ type: "customer_message", executor: "outbox_message", audience: "external", estimatedCost: 0 }),
      recallOrg,
    );
    expect(isEligibleApprover(assignments(yael), req)).toBe(true);
  });

  it("an internal notification never needs approval, even on a P1 (the CEO is informed, not asked)", () => {
    const req = evaluateApprovalPolicy(p1({ type: "notify_owner", estimatedCost: 0 }), recallOrg);
    expect(req.required).toBe(false);
  });

  it("the owning department cannot approve spend at or above the Executive threshold", () => {
    const req = evaluateApprovalPolicy(p1({ type: "staffing_change", estimatedCost: 54_000 }), recallOrg);
    expect(isEligibleApprover(assignments(yael), req)).toBe(false);
    expect(isEligibleApprover(assignments(dana), req)).toBe(true);
  });
});
