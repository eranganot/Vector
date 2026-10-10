import { describe, expect, it } from "vitest";
import {
  expectedProgress,
  initiativeStatus,
  managementFlags,
  milestoneState,
  onTimeRate,
  projectedSpend,
  type InitiativeFacts,
  type MilestoneFacts,
} from "./initiatives";

const today = "2026-10-22";
const ms = (o: Partial<MilestoneFacts>): MilestoneFacts => ({
  id: o.title ?? "m",
  title: "m",
  ownerUnitId: "A",
  startsOn: "2026-10-01",
  dueOn: "2026-10-31",
  doneOn: null,
  progress: 50,
  ...o,
});
const base = (o: Partial<InitiativeFacts> = {}): InitiativeFacts => ({
  ownerUnitId: "A",
  participatingUnitIds: ["A", "B"],
  budgetIls: 100,
  spentIls: 10,
  milestones: [ms({})],
  barriers: [],
  ...o,
});

describe("initiative rules (cross-department.md §3)", () => {
  it("expects straight-line progress from start to due", () => {
    expect(expectedProgress({ startsOn: "2026-10-01", dueOn: "2026-10-31" }, today)).toBeCloseTo(70, 5);
    expect(expectedProgress({ startsOn: "2026-10-25", dueOn: "2026-10-31" }, today)).toBe(0);
  });

  it("derives milestone state: done, late, at risk when > 20 points behind the line, else planned", () => {
    expect(milestoneState(ms({ doneOn: "2026-10-20" }), today)).toBe("done");
    expect(milestoneState(ms({ dueOn: "2026-10-21" }), today)).toBe("late");
    expect(milestoneState(ms({ progress: 49 }), today)).toBe("at_risk"); // expected 70
    expect(milestoneState(ms({ progress: 50 }), today)).toBe("planned");
  });

  it("derives status: blocked after 5 days of an open barrier, at risk with a late milestone, done when all done", () => {
    const barrier = (since: string) => ({
      id: "b",
      title: "b",
      kind: "decision",
      ownerUnitId: "A",
      costIls: 0,
      since,
      resolvedOn: null,
    });
    expect(initiativeStatus(base({ barriers: [barrier("2026-10-16")] }), today)).toBe("blocked"); // 6 days
    expect(initiativeStatus(base({ barriers: [barrier("2026-10-17")] }), today)).toBe("on_track"); // 5 days
    expect(initiativeStatus(base({ milestones: [ms({ dueOn: "2026-10-21" })] }), today)).toBe("at_risk");
    expect(initiativeStatus(base({ milestones: [ms({ doneOn: "2026-10-01" })] }), today)).toBe("done");
  });

  it("projects spend from the share of work done", () => {
    expect(projectedSpend(base({ spentIls: 30, milestones: [ms({ progress: 25 }), ms({ progress: 75 })] }))).toBe(60);
  });

  it("flags M1–M5 with who should step in", () => {
    const i = base({
      ownerUnitId: "A",
      budgetIls: 1000,
      spentIls: 1200,
      milestones: [ms({ id: "late", title: "late", ownerUnitId: "B", dueOn: "2026-10-18" })],
      barriers: [
        {
          id: "d",
          title: "d",
          kind: "decision",
          ownerUnitId: "B",
          costIls: 100,
          since: "2026-10-10",
          resolvedOn: null,
        },
      ],
    });
    const f = managementFlags(i, [{ id: "k", unitA: "A", unitB: "B", linked: true, insightId: null }], today);
    expect(f.map((x) => x.rule).sort()).toEqual(["M1", "M2", "M3", "M4", "M5"]);
    expect(f.find((x) => x.rule === "M4")!.stepIn).toBe("ceo_coo");
    // An unlinked conflict, or one with a non-participant, does not count.
    expect(
      managementFlags(base(), [{ id: "k", unitA: "A", unitB: "C", linked: true, insightId: null }], today),
    ).toEqual([]);
    expect(
      managementFlags(base(), [{ id: "k", unitA: "A", unitB: "B", linked: false, insightId: null }], today),
    ).toEqual([]);
  });

  it("measures on-time delivery of delivered milestones", () => {
    expect(onTimeRate([ms({ doneOn: "2026-10-30" }), ms({ dueOn: "2026-10-01", doneOn: "2026-10-02" })])).toBe(0.5);
    expect(onTimeRate([ms({})])).toBeNull();
  });
});
