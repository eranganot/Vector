import { describe, expect, it } from "vitest";
import { addDays } from "@/domain/calendar";
import { budgets, daysOfMonth, FIN_ACCOUNTS, financeHistory, nextMonth } from "./finance";
import { HISTORY_DAYS, STORY_DAY } from "./org";

const last = addDays(STORY_DAY, -1);
const first = addDays(STORY_DAY, -HISTORY_DAYS);
const rows = financeHistory(first, last);
const sum = (account: string, from = first, to = last, unit?: string) =>
  rows
    .filter((r) => r.account === account && r.day >= from && r.day <= to && (!unit || r.unit === unit))
    .reduce((s, r) => s + r.amount, 0);
const sales = sum("rev_net_sales");
const share = (a: string) => (100 * sum(a)) / sales;

describe("money lines (financials.md, G-E0g)", () => {
  it("cover 52 weeks of every account", () => {
    const days = new Set(rows.map((r) => r.day));
    expect(days.size).toBe(HISTORY_DAYS);
    expect(new Set(rows.map((r) => r.account))).toEqual(new Set(FIN_ACCOUNTS.map((a) => a.code)));
  });

  it("match the calibrated P&L within ±0.3 pts over 52 weeks", () => {
    expect(share("gm_amount")).toBeCloseTo(26.0, 0);
    expect(Math.abs(share("gm_amount") - 26.0)).toBeLessThan(0.3);
    expect(Math.abs(share("logistics_cost") - 2.5)).toBeLessThan(0.3);
    expect(Math.abs(share("occupancy_cost") - 3.2)).toBeLessThan(0.3);
    expect(Math.abs(share("mkt_spend") - 0.8)).toBeLessThan(0.3);
    expect(Math.abs(share("it_opex") + share("dept_opex") - 0.7)).toBeLessThan(0.3);
    const ebitda =
      share("gm_amount") -
      ["labor_cost", "logistics_cost", "occupancy_cost", "mkt_spend", "it_opex", "dept_opex"]
        .map(share)
        .reduce((a, b) => a + b, 0);
    expect(ebitda).toBeGreaterThan(2.5);
    expect(ebitda).toBeLessThan(4.5);
  });

  it("are deterministic", () => {
    const again = financeHistory(addDays(last, -6), last);
    const mine = rows.filter((r) => r.day >= addDays(last, -6));
    expect(again).toEqual(mine);
  });

  it("tell October's money stories against budget", () => {
    const b = budgets("2026-10", "2026-10");
    const bud = (a: string) => b.filter((r) => r.account === a).reduce((s, r) => s + r.amount, 0);
    const mtd = (a: string) => sum(a, "2026-10-01", last);
    const ratio = (a: string) => mtd(a) / ((bud(a) * 21) / 31);
    expect(ratio("logistics_cost")).toBeGreaterThan(1.02); // North DC delays
    expect(ratio("mkt_spend")).toBeLessThan(0.75); // R7 spend freeze
    expect(ratio("it_capex")).toBeGreaterThan(1.08); // POS upgrade over budget
    expect(sum("penalty_exposure", last, last)).toBe(250_000); // R5 compliance slip
  });
});

describe("budgets", () => {
  it("cover every account and unit for every month of the history and the rest of the year", () => {
    const months: string[] = [];
    for (let m = first.slice(0, 7); m <= "2026-12"; m = nextMonth(m)) months.push(m);
    const b = budgets(months[0], "2026-12");
    const keys = new Set(rows.map((r) => `${r.account}|${r.unit}`));
    for (const m of months)
      for (const k of keys)
        expect(
          b.some((r) => `${r.account}|${r.unit}` === k && r.month === m),
          `${k} ${m}`,
        ).toBe(true);
  });
  it("knows month lengths", () => {
    expect(daysOfMonth("2026-02")).toHaveLength(28);
    expect(daysOfMonth("2026-10").at(-1)).toBe("2026-10-31");
    expect(nextMonth("2025-12")).toBe("2026-01");
  });
});
