import { describe, expect, it } from "vitest";
import { mk1, mk2, mk2AtRiskIls, mk3, mk3UpsideIls, mk4, priceLeads } from "./market-v1";

const series = (vals: number[], start = 6) =>
  vals.map((value, i) => ({ period: `2026-${String(start + i).padStart(2, "0")}`, value }));

describe("market-v1", () => {
  it("MK2 fires when CBS food falls and ours rises two months running", () => {
    const r = mk2(series([100, 99.6, 99.2]), series([100, 100.3, 100.7]));
    expect(r?.months.map((m) => m.period)).toEqual(["2026-07", "2026-08"]);
    expect(r?.months[0]).toEqual({ period: "2026-07", cbsPct: -0.4, oursPct: 0.3 });
    expect(r?.gapPts).toBe(1.5);
    expect(mk2AtRiskIls(10_000_000, 1.5)).toBe(225_000);
  });

  it("MK2 stays quiet with one month, or when we move with the market", () => {
    expect(mk2(series([100, 100.2, 99.8]), series([100, 100.3, 100.7]))).toBeNull();
    expect(mk2(series([100, 99.6, 99.2]), series([100, 99.8, 99.5]))).toBeNull();
    expect(mk2(series([100, 99]), series([100, 101]))).toBeNull();
  });

  it("MK2 aligns months by period, not position", () => {
    const ours = series([100, 100.3, 100.7]);
    const cbs = [...series([101], 5), ...series([100, 99.6, 99.2])];
    expect(mk2(cbs, ours)?.gapPts).toBe(1.5);
  });

  it("MK3 needs the competitor at −5% or worse and our growth positive", () => {
    expect(mk3(-8.6, 1.84)).toEqual({ competitorSss: -8.6, ourGrowthPct: 1.8 });
    expect(mk3(-4.9, 2)).toBeNull();
    expect(mk3(-8.6, -0.1)).toBeNull();
    expect(mk3(null, 2)).toBeNull();
    expect(mk3UpsideIls(10_000_000)).toBe(100_000);
  });

  it("price leads: categories where we are cheaper, biggest lead first", () => {
    expect(
      priceLeads(
        { dairy: 113, bakery: 98, snacks: 95, drinks: null },
        { dairy: 109, bakery: 104, snacks: 110, drinks: 100 },
      ),
    ).toEqual([
      { category: "snacks", ours: 95, theirs: 110, leadPts: 15 },
      { category: "bakery", ours: 98, theirs: 104, leadPts: 6 },
    ]);
  });

  it("MK1 compares with the latest day at least 14 days back; a single day never fires", () => {
    expect(mk1([{ day: "2026-10-10", index: 100 }])).toBeNull();
    const p = [
      { day: "2026-09-20", index: 104 },
      { day: "2026-09-26", index: 103 },
      { day: "2026-10-05", index: 101 },
      { day: "2026-10-10", index: 99.5 },
    ];
    expect(mk1(p)).toMatchObject({ from: { day: "2026-09-26" }, changePct: -3.4 });
    expect(mk1(p.map((x) => ({ ...x, index: 100 })))).toBeNull();
  });

  it("MK4 fires when the store count drops", () => {
    expect(mk4([{ day: "2026-10-10", count: 30 }])).toBeNull();
    expect(
      mk4([
        { day: "2026-10-10", count: 30 },
        { day: "2026-10-11", count: 29 },
      ]),
    ).toMatchObject({ closed: 1 });
    expect(
      mk4([
        { day: "2026-10-10", count: 30 },
        { day: "2026-10-11", count: 31 },
      ]),
    ).toBeNull();
  });
});
