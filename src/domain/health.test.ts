import { describe, expect, it } from "vitest";
import { attainment, decompose, gapPct, health, riskLoad, type Measure } from "./health";

const m = (code: string, kind: Measure["kind"], value: number, reference: number, higherIsBetter = true): Measure => ({
  code,
  name: code,
  kind,
  value,
  reference,
  higherIsBetter,
});

describe("health-v2 (executive-home.md §4)", () => {
  it("scores attainment: 100 on target, −2.5% → 80, −5% → 60, floored at 0", () => {
    expect(attainment(0)).toBe(100);
    expect(attainment(3)).toBe(100);
    expect(attainment(-2.5)).toBe(80);
    expect(attainment(-5)).toBe(60);
    expect(attainment(-20)).toBe(0);
  });

  it("signs the gap so worse is negative, for both directions", () => {
    expect(gapPct({ value: 94.9, reference: 96, higherIsBetter: true })).toBeCloseTo(-1.146, 2);
    expect(gapPct({ value: 104.9, reference: 100, higherIsBetter: false })).toBeCloseTo(-4.9, 5);
    expect(gapPct({ value: 0, reference: 0, higherIsBetter: false })).toBe(0);
  });

  it("weighs risk load like the Phase 3 pulse", () => {
    expect(riskLoad(["P1", "P2"], ["P1"])).toBe(64);
    expect(riskLoad(["P1", "P1", "P1", "P1", "P1", "P1"], [])).toBe(0);
  });

  it("combines 45% KPIs, 35% money and 20% risk load (hand-computed Supply Chain fixture)", () => {
    // KPIs: OSA 94.9 vs 96 (−1.146% → 90.83), DC on time 81 vs 95 (−14.74% → 0). Mean 45.42.
    // Money: logistics 104.9% of budget (−4.9% → 60.8), inventory days 23.8 vs 22 (−8.18% → 34.55). Mean 47.67.
    // Risks: owns P1 + P2 (70), involved in one P1 (−6) → 64.
    const h = health({
      measures: [
        m("osa", "kpi", 94.9, 96),
        m("dc_on_time", "kpi", 81, 95),
        m("logistics_cost", "money", 104.9, 100, false),
        m("inventory_days", "money", 23.8, 22, false),
      ],
      ownedRiskBands: ["P1", "P2"],
      involvedRiskBands: ["P1"],
    });
    expect(h.kpi).toBeCloseTo(45.42, 1);
    expect(h.money).toBeCloseTo(47.67, 1);
    expect(h.risk).toBe(64);
    expect(h.score).toBeCloseTo(0.45 * 45.42 + 0.35 * 47.67 + 0.2 * 64, 0);
    expect(h.status).toBe("at_risk");
  });

  it("uses a fixed score when a measure has no meaningful relative gap", () => {
    const h = health({
      measures: [{ ...m("penalty", "money", 250_000, 0, false), score: 50 }],
      ownedRiskBands: [],
      involvedRiskBands: [],
    });
    expect(h.money).toBe(50);
    expect(h.parts[0].gap).toBe(-50);
  });

  it("decomposes a change into contributions that sum to it, largest first", () => {
    const before = health({
      measures: [m("a", "kpi", 100, 100), m("b", "money", 100, 100)],
      ownedRiskBands: [],
      involvedRiskBands: [],
    });
    const now = health({
      measures: [m("a", "kpi", 97.5, 100), m("b", "money", 100, 100)],
      ownedRiskBands: ["P2"],
      involvedRiskBands: [],
    });
    const d = decompose(now, before);
    expect(d.contributions[0].code).toBe("a"); // 0.45 × (80 − 100) = −9
    expect(d.contributions[0].points).toBe(-9);
    expect(d.contributions.find((c) => c.code === "risk_load")!.points).toBe(-2);
    expect(d.change).toBe(-11);
  });
});
