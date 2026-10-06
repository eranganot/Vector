/**
 * Synthetic money lines and monthly budgets (plan v2, E1c; docs/specs/financials.md).
 * Deterministic like the KPI generator: every amount depends only on (seed, unit, account, day).
 * Region lines are summed from the branches' generated days; department lines sit on the department unit.
 * Calibrated to the group P&L of financials.md §1 (G-E0g): margin 26.0%, logistics 2.5%, occupancy 3.2%,
 * marketing 0.8%, other opex 0.7%. Store labor comes from the KPI generator (≈15.3%), so operating profit ≈ 3.5%.
 */
import { addDays } from "@/domain/calendar";
import { type DayValues, expectedSales, GENERATOR_SEED, generateDay, generateDepartmentDay } from "./generator";
import { type UnitSeed, UNITS } from "./org";
import { createRng } from "./prng";

export type FinAccountSeed = {
  code: string;
  name: string;
  kind: "revenue" | "cost" | "balance";
  unit: "ils" | "days";
  higherIsBetter: boolean;
  owner: string; // department code
  level: "region" | "department";
};

export const FIN_ACCOUNTS: FinAccountSeed[] = [
  {
    code: "rev_net_sales",
    name: "Net sales",
    kind: "revenue",
    unit: "ils",
    higherIsBetter: true,
    owner: "D-STORE",
    level: "region",
  },
  {
    code: "gm_amount",
    name: "Gross margin",
    kind: "revenue",
    unit: "ils",
    higherIsBetter: true,
    owner: "D-TRADE",
    level: "region",
  },
  {
    code: "cogs",
    name: "Cost of goods sold",
    kind: "cost",
    unit: "ils",
    higherIsBetter: false,
    owner: "D-TRADE",
    level: "region",
  },
  {
    code: "labor_cost",
    name: "Store labor cost",
    kind: "cost",
    unit: "ils",
    higherIsBetter: false,
    owner: "D-STORE",
    level: "region",
  },
  {
    code: "occupancy_cost",
    name: "Rent and occupancy",
    kind: "cost",
    unit: "ils",
    higherIsBetter: false,
    owner: "D-STORE",
    level: "region",
  },
  {
    code: "shrink_cost",
    name: "Shrinkage",
    kind: "cost",
    unit: "ils",
    higherIsBetter: false,
    owner: "D-STORE",
    level: "region",
  },
  {
    code: "waste_cost",
    name: "Fresh waste",
    kind: "cost",
    unit: "ils",
    higherIsBetter: false,
    owner: "D-SUPPLY",
    level: "region",
  },
  {
    code: "logistics_cost",
    name: "Logistics (DC and transport)",
    kind: "cost",
    unit: "ils",
    higherIsBetter: false,
    owner: "D-SUPPLY",
    level: "department",
  },
  {
    code: "inventory_days",
    name: "Inventory days on hand",
    kind: "balance",
    unit: "days",
    higherIsBetter: false,
    owner: "D-SUPPLY",
    level: "department",
  },
  {
    code: "mkt_spend",
    name: "Marketing spend",
    kind: "cost",
    unit: "ils",
    higherIsBetter: false,
    owner: "D-MKT",
    level: "department",
  },
  {
    code: "mkt_incremental",
    name: "Campaign incremental sales",
    kind: "revenue",
    unit: "ils",
    higherIsBetter: true,
    owner: "D-MKT",
    level: "department",
  },
  {
    code: "headcount_cost",
    name: "Headcount cost (all staff)",
    kind: "cost",
    unit: "ils",
    higherIsBetter: false,
    owner: "D-HR",
    level: "department",
  },
  {
    code: "overtime_cost",
    name: "Overtime",
    kind: "cost",
    unit: "ils",
    higherIsBetter: false,
    owner: "D-HR",
    level: "department",
  },
  {
    code: "penalty_exposure",
    name: "Open penalty exposure",
    kind: "balance",
    unit: "ils",
    higherIsBetter: false,
    owner: "D-LEGAL",
    level: "department",
  },
  {
    code: "it_opex",
    name: "IT operating spend",
    kind: "cost",
    unit: "ils",
    higherIsBetter: false,
    owner: "D-IT",
    level: "department",
  },
  {
    code: "it_capex",
    name: "IT capital spend",
    kind: "cost",
    unit: "ils",
    higherIsBetter: false,
    owner: "D-IT",
    level: "department",
  },
  {
    code: "dept_opex",
    name: "Department operating cost",
    kind: "cost",
    unit: "ils",
    higherIsBetter: false,
    owner: "D-FIN",
    level: "department",
  },
];

/** Shares of net sales (G-E0g). `dept_opex` is split across the eight departments by DEPT_OPEX_SPLIT. */
export const PLAN = {
  grossMargin: 0.26,
  labor: 0.158,
  logistics: 0.025,
  occupancy: 0.032,
  marketing: 0.008,
  itOpex: 0.0025,
  deptOpex: 0.0045,
  shrink: 0.015,
  waste: 0.009,
  incrementalPerShekel: 3.2,
  hqStaff: 0.003,
  overtimeShareOfHeadcount: 0.04,
  inventoryDays: 22,
  budgetGrowth: 1.015,
};
export const DEPT_OPEX_SPLIT: Record<string, number> = {
  "D-STORE": 0.2,
  "D-SUPPLY": 0.15,
  "D-TRADE": 0.12,
  "D-MKT": 0.08,
  "D-FIN": 0.13,
  "D-HR": 0.12,
  "D-LEGAL": 0.08,
  "D-IT": 0.12,
};

/**
 * Planted money stories, consistent with the KPI plants and the catalog (scenarios.md):
 * North DC delays push logistics and overtime up; the R7 spend freeze cuts marketing; the POS upgrade (R13)
 * overspends IT capex; the R5 compliance slip opens a penalty exposure; inventory builds up behind the DC.
 */
export const FIN_PLANTS = {
  logisticsOverrun: { from: "2026-10-12", factor: 1.1 },
  overtimeNorth: { from: "2026-10-20", factor: 1.4 },
  marketingFreeze: { from: "2026-10-05", factor: 0.55 },
  posCapex: { from: "2026-09-01", dailyPlan: 70_000, overrun: 1.14 },
  penalty: { from: "2026-10-17", amount: 250_000 },
  inventoryBuild: { from: "2026-10-15", perDay: 0.25, cap: 1.8 },
};

const BRANCHES = UNITS.filter((u) => u.type === "branch");
const REGIONS = UNITS.filter((u) => u.type === "region").map((u) => u.code);
const round = (v: number) => Math.round(v * 100) / 100;

/** Occupancy per branch per day: rent does not follow sales (size class, region, a fixed branch factor). */
function occupancy(b: UnitSeed): number {
  const branchFactor = 0.9 + 0.2 * createRng(`${GENERATOR_SEED}|${b.code}|rent`).next();
  // 0.88: branches sell ~12% below their size-class base on an average day (weekday shape, region factors).
  const daily = { L: 190_000, M: 110_000 }[b.sizeClass ?? "M"] * 0.88 * PLAN.occupancy * branchFactor;
  return daily;
}

export type FinRow = { account: string; unit: string; day: string; amount: number };

/** One day of region money lines from the branches' generated days (pass them in to avoid regenerating). */
export function regionDay(day: string, branchDays: Map<string, DayValues>): FinRow[] {
  const gm = generateDepartmentDay("gross_margin", day) / 100;
  const rows: FinRow[] = [];
  for (const region of REGIONS) {
    let sales = 0;
    let labor = 0;
    let shrink = 0;
    let occ = 0;
    for (const b of BRANCHES.filter((x) => x.parent === region)) {
      const v = branchDays.get(b.code) ?? generateDay(b, day);
      sales += v.net_sales;
      labor += (v.net_sales * v.labor_pct) / 100;
      shrink += (v.net_sales * v.shrink_pct) / 100;
      occ += occupancy(b);
    }
    const rng = createRng(`${GENERATOR_SEED}|fin|${region}|${day}`);
    const waste = sales * PLAN.waste * (1 + 0.08 * rng.gaussian());
    rows.push(
      { account: "rev_net_sales", unit: region, day, amount: round(sales) },
      { account: "gm_amount", unit: region, day, amount: round(sales * gm) },
      { account: "cogs", unit: region, day, amount: round(sales * (1 - gm)) },
      { account: "labor_cost", unit: region, day, amount: round(labor) },
      { account: "occupancy_cost", unit: region, day, amount: round(occ) },
      { account: "shrink_cost", unit: region, day, amount: round(shrink) },
      { account: "waste_cost", unit: region, day, amount: round(waste) },
    );
  }
  return rows;
}

/** One day of department money lines; `groupSales` and `groupLabor` are the day's totals over all branches. */
export function departmentDay(day: string, groupSales: number, groupLabor: number, northLabor: number): FinRow[] {
  const P = FIN_PLANTS;
  const r = createRng(`${GENERATOR_SEED}|fin|dept|${day}`);
  const g = () => 1 + r.gaussian() * 0.03;
  const logistics =
    groupSales * PLAN.logistics * g() * (day >= P.logisticsOverrun.from ? P.logisticsOverrun.factor : 1);
  const build =
    day >= P.inventoryBuild.from
      ? Math.min(P.inventoryBuild.cap, P.inventoryBuild.perDay * (daysFrom(P.inventoryBuild.from, day) + 1))
      : 0;
  const inventory = PLAN.inventoryDays + 0.3 * r.gaussian() + build;
  const mkt = groupSales * PLAN.marketing * g() * (day >= P.marketingFreeze.from ? P.marketingFreeze.factor : 1);
  const incremental = mkt * PLAN.incrementalPerShekel * (1 + 0.1 * r.gaussian());
  const headcount = groupLabor + groupSales * PLAN.hqStaff;
  const overtime =
    headcount * PLAN.overtimeShareOfHeadcount * g() +
    (day >= P.overtimeNorth.from ? northLabor * PLAN.overtimeShareOfHeadcount * (P.overtimeNorth.factor - 1) : 0);
  const penalty = day >= P.penalty.from ? P.penalty.amount : 0;
  const itOpex = groupSales * PLAN.itOpex * g();
  const capex = day >= P.posCapex.from ? P.posCapex.dailyPlan * P.posCapex.overrun * g() : 0;
  const rows: FinRow[] = [
    { account: "logistics_cost", unit: "D-SUPPLY", day, amount: round(logistics) },
    { account: "inventory_days", unit: "D-SUPPLY", day, amount: round(inventory) },
    { account: "mkt_spend", unit: "D-MKT", day, amount: round(mkt) },
    { account: "mkt_incremental", unit: "D-MKT", day, amount: round(incremental) },
    { account: "headcount_cost", unit: "D-HR", day, amount: round(headcount) },
    { account: "overtime_cost", unit: "D-HR", day, amount: round(overtime) },
    { account: "penalty_exposure", unit: "D-LEGAL", day, amount: penalty },
    { account: "it_opex", unit: "D-IT", day, amount: round(itOpex) },
    { account: "it_capex", unit: "D-IT", day, amount: round(capex) },
  ];
  for (const [dept, share] of Object.entries(DEPT_OPEX_SPLIT))
    rows.push({ account: "dept_opex", unit: dept, day, amount: round(groupSales * PLAN.deptOpex * share * g()) });
  return rows;
}

function daysFrom(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/** All money lines for the days in [first, last]. Generates each branch-day once. */
export function financeHistory(first: string, last: string): FinRow[] {
  const out: FinRow[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) {
    const branchDays = new Map(BRANCHES.map((b) => [b.code, generateDay(b, day)]));
    out.push(...regionDay(day, branchDays));
    let sales = 0;
    let labor = 0;
    let north = 0;
    for (const b of BRANCHES) {
      const v = branchDays.get(b.code)!;
      sales += v.net_sales;
      const l = (v.net_sales * v.labor_pct) / 100;
      labor += l;
      if (b.parent === "NORTH") north += l;
    }
    out.push(...departmentDay(day, sales, labor, north));
  }
  return out;
}

export type BudgetRow = { account: string; unit: string; month: string; amount: number };

/**
 * Monthly budgets (version 1) from the plan line: expected sales (before noise and stories) × budget growth, and
 * each cost at its planned share. Balance lines (inventory days, penalty exposure) budget their target level.
 */
export function budgets(firstMonth: string, lastMonth: string): BudgetRow[] {
  const out: BudgetRow[] = [];
  for (let m = firstMonth; m <= lastMonth; m = nextMonth(m)) {
    const days = daysOfMonth(m);
    let groupSales = 0;
    let groupOcc = 0;
    for (const region of REGIONS) {
      let sales = 0;
      let occ = 0;
      for (const b of BRANCHES.filter((x) => x.parent === region)) {
        for (const d of days) sales += expectedSales(b, d);
        occ += occupancy(b) * days.length;
      }
      sales *= PLAN.budgetGrowth;
      groupSales += sales;
      groupOcc += occ;
      out.push(
        { account: "rev_net_sales", unit: region, month: m, amount: round(sales) },
        { account: "gm_amount", unit: region, month: m, amount: round(sales * PLAN.grossMargin) },
        { account: "cogs", unit: region, month: m, amount: round(sales * (1 - PLAN.grossMargin)) },
        { account: "labor_cost", unit: region, month: m, amount: round(sales * PLAN.labor) },
        { account: "occupancy_cost", unit: region, month: m, amount: round(occ) },
        { account: "shrink_cost", unit: region, month: m, amount: round(sales * PLAN.shrink) },
        { account: "waste_cost", unit: region, month: m, amount: round(sales * PLAN.waste) },
      );
    }
    void groupOcc;
    const mkt = groupSales * PLAN.marketing;
    const headcount = groupSales * (PLAN.labor + PLAN.hqStaff);
    out.push(
      { account: "logistics_cost", unit: "D-SUPPLY", month: m, amount: round(groupSales * PLAN.logistics) },
      { account: "inventory_days", unit: "D-SUPPLY", month: m, amount: PLAN.inventoryDays },
      { account: "mkt_spend", unit: "D-MKT", month: m, amount: round(mkt) },
      { account: "mkt_incremental", unit: "D-MKT", month: m, amount: round(mkt * PLAN.incrementalPerShekel) },
      { account: "headcount_cost", unit: "D-HR", month: m, amount: round(headcount) },
      { account: "overtime_cost", unit: "D-HR", month: m, amount: round(headcount * PLAN.overtimeShareOfHeadcount) },
      { account: "penalty_exposure", unit: "D-LEGAL", month: m, amount: 0 },
      { account: "it_opex", unit: "D-IT", month: m, amount: round(groupSales * PLAN.itOpex) },
      {
        account: "it_capex",
        unit: "D-IT",
        month: m,
        amount: m >= FIN_PLANTS.posCapex.from.slice(0, 7) ? FIN_PLANTS.posCapex.dailyPlan * days.length : 0,
      },
    );
    for (const [dept, share] of Object.entries(DEPT_OPEX_SPLIT))
      out.push({ account: "dept_opex", unit: dept, month: m, amount: round(groupSales * PLAN.deptOpex * share) });
  }
  return out;
}

export function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

export function daysOfMonth(m: string): string[] {
  const out: string[] = [];
  for (let d = `${m}-01`; d.startsWith(m); d = addDays(d, 1)) out.push(d);
  return out;
}
