import { describe, expect, it } from "vitest";
import { direction, project } from "./projection";

describe("projection-v1 (executive-home.md §4.3)", () => {
  it("adds the run-rate baseline to the actual, then subtracts risk drag and adds action lift (hand-computed)", () => {
    // October: ₪146.2M to date; ₪69.1M of budget still to come over 10 days; recent days run at 97.9% of budget.
    // Risk: ₪1.1M/week at 0.8 confidence, capped at 2 weeks → 1.1 × (10/7) × 0.8 = ₪1.257M.
    // Action: ₪0.6M approved → 0.5 × 0.6 = ₪0.3M.
    const p = project({
      actualToDate: 146.2,
      budgetRemaining: 69.1,
      budgetTotal: 218.4,
      recentRatios: [0.979, 0.979, 0.979],
      daysRemaining: 10,
      risks: [{ weeklyIls: 1.1, confidence: 0.8 }],
      actions: [{ status: "approved", impactIls: 0.6 }],
      higherIsBetter: true,
    });
    expect(p.terms.baseline).toBeCloseTo(69.1 * 0.979, 6);
    expect(p.terms.riskDrag).toBeCloseTo(1.1 * (10 / 7) * 0.8, 6);
    expect(p.terms.actionLift).toBeCloseTo(0.3, 6);
    expect(p.mid).toBeCloseTo(146.2 + 67.6489 - 1.25714 + 0.3, 3);
    expect(p.verdict).toBe("miss"); // about −2.4% vs ₪218.4M
    expect(p.low).toBe(p.mid); // identical recent days: no spread
  });

  it("widens the range with the spread of recent days and the days to come", () => {
    const p = project({
      actualToDate: 0,
      budgetRemaining: 100,
      budgetTotal: 100,
      recentRatios: [0.9, 1.1, 0.9, 1.1],
      daysRemaining: 25,
      risks: [],
      actions: [],
      higherIsBetter: true,
    });
    expect(p.mid).toBeCloseTo(100, 6);
    expect(p.high - p.mid).toBeCloseTo(0.11547 * 4 * 5, 3); // sd × daily budget × √days
    expect(p.verdict).toBe("on_track");
  });

  it("judges a cost line the other way and ignores risk drag on it", () => {
    const p = project({
      actualToDate: 50,
      budgetRemaining: 50,
      budgetTotal: 100,
      recentRatios: [1.1],
      daysRemaining: 10,
      risks: [{ weeklyIls: 5, confidence: 1 }],
      actions: [],
      higherIsBetter: false,
    });
    expect(p.terms.riskDrag).toBe(0);
    expect(p.mid).toBeCloseTo(105, 6);
    expect(p.gapPct).toBeCloseTo(-5, 6);
    expect(p.verdict).toBe("miss");
  });

  it("names the direction with a ±3 point band", () => {
    expect(direction(60, 64)).toBe("improving");
    expect(direction(60, 58)).toBe("stable");
    expect(direction(60, 56)).toBe("worsening");
  });
});
