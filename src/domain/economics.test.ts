import { describe, expect, it } from "vitest";
import { actionEconomics, endOfQuarter, executionRisk } from "./economics";

const story = new Date("2026-10-22T05:00:00Z");

describe("action economics (economics-v0)", () => {
  it("measures to the end of the calendar quarter", () => {
    expect(endOfQuarter(story).toISOString()).toBe("2026-12-31T23:59:59.999Z");
    expect(endOfQuarter(new Date("2026-03-31T10:00:00Z")).toISOString()).toBe("2026-03-31T23:59:59.999Z");
  });

  it("impact = weekly ₪ × weeks to quarter end × capture × confidence, split across the response", () => {
    const e = actionEconomics({
      type: "inventory_transfer",
      weeklyIls: 420_000,
      confidence: 0.8,
      actionsInResponse: 2,
      now: story,
    });
    // 10 weeks to 31 Dec · 70% captured · 0.8 confidence · 2 actions → 420k × 10 × 0.7 × 0.8 / 2 = 1,176,000
    expect(e.riskFactors.weeks).toBe(10);
    expect(e.expectedImpactIls).toBe(1_176_000);
    expect(e.executionRisk).toBe(0.25);
    expect(e.impactBasis).toBe("₪420k/week × 10 weeks to quarter end × 70% captured × confidence 0.8 ÷ 2 actions");
  });

  it("falls back for an unknown action type and never measures less than a week", () => {
    const e = actionEconomics({
      type: "new_kind",
      weeklyIls: 10_000,
      confidence: 1,
      actionsInResponse: 1,
      now: new Date("2026-12-31T20:00:00Z"),
    });
    expect(e.riskFactors.weeks).toBe(1);
    expect(e.expectedImpactIls).toBe(3_000);
    expect(e.executionRisk).toBe(0.3);
  });
});

describe("economics-v1 execution risk (cross-department.md §2)", () => {
  it("weighs dependencies 30%, conflict 25%, track record 25%, owner load 20% (hand-computed)", () => {
    // 1 of 2 dependencies blocked → 0.5; in conflict → 1; 1 of 4 past outcomes worked → 0.75; 1 of 4 items overdue → 0.25.
    const r = executionRisk({
      dependencies: { open: 2, troubled: 1 },
      inConflict: true,
      pastOutcomes: { worked: 1, judged: 4 },
      ownerItems: { open: 4, overdue: 1 },
    });
    expect(r.score).toBeCloseTo(0.3 * 0.5 + 0.25 + 0.25 * 0.75 + 0.2 * 0.25, 2);
    expect(r.level).toBe("high");
  });

  it("scores a clean action with no history as low: only the unknown track record counts", () => {
    const r = executionRisk({
      dependencies: { open: 0, troubled: 0 },
      inConflict: false,
      pastOutcomes: { worked: 0, judged: 0 },
      ownerItems: { open: 0, overdue: 0 },
    });
    expect(r.score).toBe(0.13); // 0.25 × 0.5 = 0.125, rounded to 2 places
    expect(r.level).toBe("low");
    expect(r.factors.trackRecord).toBe(0.5);
  });
});
