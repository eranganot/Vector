import { describe, expect, it } from "vitest";
import { actionHeader, commitmentHeader, opportunityHeader, riskHeader } from "./money-headers";

describe("₪ headers (executive-home.md §6)", () => {
  it("risks: at stake, P1, mitigated by executing or done actions, unanswered", () => {
    const h = riskHeader([
      { band: "P1", impactIls: 600_000, actionStatuses: ["pending_approval"] },
      { band: "P1", impactIls: 180_000, actionStatuses: ["executing"] },
      { band: "P2", impactIls: 400_000, actionStatuses: [] },
      { band: "P3", impactIls: 50_000, actionStatuses: ["cancelled"] },
    ]);
    expect(h).toEqual({ atStake: 1_230_000, p1: 780_000, mitigated: 180_000, unanswered: 450_000 });
  });

  it("opportunities: upside, cost, net value to quarter end, captured by outcomes", () => {
    const h = opportunityHeader(
      [
        { valueIls: 150_000, costIls: 20_000, confidence: 0.7, actionStatuses: [], verdicts: ["worked"] },
        { valueIls: 90_000, costIls: 35_000, confidence: 0.6, actionStatuses: [], verdicts: ["partially_worked"] },
      ],
      10,
    );
    expect(h.upside).toBe(240_000);
    expect(h.cost).toBe(55_000);
    expect(h.netEoq).toBe(150_000 * 10 * 0.7 - 20_000 + 90_000 * 10 * 0.6 - 35_000);
    expect(h.captured).toBe(150_000 + 45_000);
  });

  it("commitments: open and overdue value, delivered this month", () => {
    const m = new Date("2026-10-01T00:00:00Z");
    const h = commitmentHeader(
      [
        { status: "open", impactIls: 100, completedAt: null },
        { status: "overdue", impactIls: 40, completedAt: null },
        { status: "done", impactIls: 30, completedAt: new Date("2026-10-05T00:00:00Z") },
        { status: "done", impactIls: 99, completedAt: new Date("2026-09-30T00:00:00Z") },
        { status: "cancelled", impactIls: 7, completedAt: null },
      ],
      m,
    );
    expect(h).toEqual({ open: 140, overdue: 40, deliveredThisMonth: 30 });
  });

  it("actions: committed cost, expected and confirmed impact, hit rate", () => {
    const h = actionHeader([
      { status: "executed", cost: 10, impact: 100, verdict: "worked" },
      { status: "executed", cost: 20, impact: 80, verdict: "did_not_work" },
      { status: "executed", cost: 5, impact: 40, verdict: "partially_worked" },
      { status: "cancelled", cost: 999, impact: 999, verdict: null },
      { status: "proposed", cost: 1, impact: 10, verdict: "inconclusive" },
    ]);
    expect(h.committedCost).toBe(36);
    expect(h.expectedImpact).toBe(230);
    expect(h.confirmedImpact).toBe(120);
    expect(h.hitRate).toBeCloseTo(1 / 3, 6);
    expect(actionHeader([]).hitRate).toBeNull();
  });
});
