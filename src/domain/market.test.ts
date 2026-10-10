import { describe, expect, it } from "vitest";
import { basketIndex, yoy, type BasketItem } from "./market";

const basket: BasketItem[] = [
  { code: "milk", category: "dairy" },
  { code: "cheese", category: "dairy" },
  { code: "bread", category: "bakery" },
  { code: "only-a", category: "bakery" },
];

describe("basket-index-v1", () => {
  it("indexes each chain against the median price of the chains, per category and overall", () => {
    const r = basketIndex(basket, {
      a: { milk: 6, cheese: 10, bread: 8, "only-a": 5 },
      b: { milk: 6.6, cheese: 11, bread: 8 },
      c: { milk: 5.4, cheese: 9, bread: 8.8 },
    });
    // dairy: a is the median on both items (100); b is 10% above; c 10% below.
    expect(r.byCategory.a.dairy).toBe(100);
    expect(r.byCategory.b.dairy).toBe(110);
    expect(r.byCategory.c.dairy).toBe(90);
    // bakery: "only-a" is skipped (not sold by every chain); bread median 8 → c is 110.
    expect(r.items).toEqual({ dairy: 2, bakery: 1 });
    expect(r.byCategory.c.bakery).toBe(110);
    // overall weights dairy 0.20 and bakery 0.15 among the categories present.
    expect(r.overall.c).toBe(Math.round(((90 * 0.2 + 110 * 0.15) / 0.35) * 10) / 10);
  });

  it("year on year from a monthly series", () => {
    expect(
      yoy([
        { period: "2025-08", value: 100 },
        { period: "2026-08", value: 101 },
      ]),
    ).toBe(1);
    expect(yoy([{ period: "2026-08", value: 101 }])).toBeNull();
  });
});

describe("CBS chaining", () => {
  it("chains a re-based series from the monthly changes, so year on year matches CBS", async () => {
    const { chainCbs } = await import("@/infra/market/load");
    // Real CBS food (110050): Dec 2024 110.9 on base 2022, Jan 2025 102.0 on base 2024 (+1.0% m/m).
    const c = chainCbs([
      { period: "2024-12", index: 110.9, mom: -0.7 },
      { period: "2025-01", index: 102.0, mom: 1.0 },
      { period: "2025-02", index: 102.3, mom: 0.3 },
    ]);
    expect(c[2].index).toBe(102.3);
    expect(c[1].index).toBeCloseTo(102.3 / 1.003, 1);
    expect(c[0].index).toBeCloseTo(c[1].index / 1.01, 1); // no step at the base change
  });
});
