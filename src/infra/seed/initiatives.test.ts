/** The seeded initiatives tell the stories of cross-department.md §5 on the story day. */
import { describe, expect, it } from "vitest";
import { initiativeStatus, managementFlags } from "@/domain/initiatives";
import { COMMITMENTS } from "./commitments";
import { INITIATIVES } from "./initiatives";
import { STORY_DAY } from "./org";

// The open conflicts the commitment register raises on the story day (Phase 4, conflict-rules-v1).
const CONFLICTS = [
  ["M-CAMPAIGN", "F-FREEZE"],
  ["S-PEAK", "IT-POS"],
  ["M-COAST-PROMO", "T-DELIST-COAST"],
];
const ownerOf = (key: string) => COMMITMENTS.find((c) => c.key === key)!.unit;

const view = (key: string) => {
  const i = INITIATIVES.find((x) => x.key === key)!;
  const facts = {
    ownerUnitId: i.owner,
    participatingUnitIds: i.participants,
    budgetIls: i.budgetIls,
    spentIls: i.spentIls,
    milestones: i.milestones.map((m, n) => ({ ...m, id: `${n}`, ownerUnitId: m.owner, doneOn: m.doneOn ?? null })),
    barriers: i.barriers.map((b, n) => ({
      ...b,
      id: `${n}`,
      ownerUnitId: b.owner,
      costIls: b.costIls ?? 0,
      resolvedOn: b.resolvedOn ?? null,
    })),
  };
  const conflicts = CONFLICTS.map(([a, b], n) => ({
    id: `${n}`,
    unitA: ownerOf(a),
    unitB: ownerOf(b),
    linked: i.commitments.includes(a) || i.commitments.includes(b),
    insightId: null,
  }));
  return {
    status: initiativeStatus(facts, STORY_DAY),
    rules: [...new Set(managementFlags(facts, conflicts, STORY_DAY).map((f) => f.rule))].sort(),
  };
};

describe("seeded initiatives on the story day", () => {
  it("North DC recovery is blocked and needs management (M1, M2, M3, M4)", () => {
    expect(view("I-NORTH-DC")).toEqual({ status: "blocked", rules: ["M1", "M2", "M3", "M4"] });
  });
  it("the POS upgrade is over budget (M5), blocked on the install-crew cost and in conflict with peak staffing", () => {
    expect(view("I-POS").rules).toEqual(["M1", "M3", "M5"]);
  });
  it("holiday readiness has a late milestone (M2)", () => {
    expect(view("I-HOLIDAY")).toEqual({ status: "at_risk", rules: ["M2"] });
  });
  it("the other five need no management", () => {
    for (const k of ["I-CLICK", "I-RECALL", "I-WAGE", "I-PRIVATE-LABEL", "I-BUDGET-REVIEW"])
      expect(view(k).rules, k).toEqual([]);
  });
});
