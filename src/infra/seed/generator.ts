/**
 * Deterministic synthetic KPI generator (docs/specs/synthetic-data.md). Every value depends only on
 * (seed, branch, KPI, day, interventions), never on generation order, so history and future days
 * produced by the scenario engine are reproducible.
 */
import { dayKind, tradingWeight } from "@/domain/calendar";
import { createRng } from "./prng";
import type { UnitSeed } from "./org";

export const GENERATOR_SEED = "vector-v1";

const BASE_SALES = { L: 190_000, M: 110_000 } as const;
const REGION_FACTOR: Record<string, number> = { NORTH: 0.97, COAST: 1.0, CENTER: 1.05, JERUSALEM: 0.98, SOUTH: 0.92 };

export type Interventions = {
  /** Day the stock transfer for planted story P2-S1 executed (recovery starts the next day). */
  p2s1TransferDay?: string;
};

export type DayValues = {
  net_sales: number;
  transactions: number;
  osa: number;
  labor_pct: number;
  shrink_pct: number;
  nps: number;
};

/** Planted story P2-S1: Haifa Grand Canyon OSA falls after a DC routing change; sales follow. */
export const P2S1 = {
  branch: "HFA-GC",
  osaDeclineStart: "2026-10-12",
  osaFloor: 88.8,
  cause: "DC routing change on 2026-10-11 dropped two top categories from the Haifa Grand Canyon delivery wave",
};

/**
 * Background conditions behind the scenario catalog (docs/specs/scenarios.md). They shape the KPIs the
 * dashboards show; none moves net sales, so the detector's only live finding stays P2-S1.
 */
export const CATALOG_PLANTS = {
  /** R3: OSA on the top-50 SKUs sags in 9 North branches two days before the holiday weekend. */
  northOsaDip: {
    branches: ["KAT", "KRM", "AKO", "NHR", "TIB", "AFL", "KSH", "YKN", "SAF"],
    from: "2026-10-20",
    points: 5.5,
  },
  /** R11: labor cost runs 6% over plan across the Center region for three weeks. */
  centerLabor: { region: "CENTER", from: "2026-10-01", factor: 1.06 },
  /** R10: shrinkage spike at Tel Aviv Dizengoff. */
  shrinkSpike: { branch: "TLV-DZ", from: "2026-10-17", points: 3.0 },
  /** R14: NPS at Tel Aviv Dizengoff 4 points below its range for two weeks. */
  npsDrop: { branch: "TLV-DZ", from: "2026-10-08", points: 4 },
} as const;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

function storyOsaShortfall(branchCode: string, day: string, iv: Interventions): number {
  if (branchCode !== P2S1.branch || day < P2S1.osaDeclineStart) return 0;
  const full = 96.8 - P2S1.osaFloor;
  const ramp = Math.min(1, (daysBetween(P2S1.osaDeclineStart, day) + 1) / 4);
  let shortfall = full * ramp;
  if (iv.p2s1TransferDay && day > iv.p2s1TransferDay) {
    const recovery = Math.min(1, daysBetween(iv.p2s1TransferDay, day) / 3);
    shortfall *= 1 - 0.9 * recovery;
  }
  return shortfall;
}

/**
 * Expected net sales for a branch and day: the plan line before noise and stories. Budgets are built from it
 * (financials.md §3); `generateDay` uses the same expression, so the two can never drift apart.
 */
export function expectedSales(branch: UnitSeed, day: string): number {
  const size = branch.sizeClass ?? "M";
  const branchFactor = 0.92 + 0.16 * createRng(`${GENERATOR_SEED}|${branch.code}`).next();
  const base = BASE_SALES[size] * (REGION_FACTOR[branch.parent ?? ""] ?? 1) * branchFactor;
  return base * tradingWeight(day) * (1 + 0.0002 * daysBetween("2026-07-01", day));
}

export function generateDay(branch: UnitSeed, day: string, iv: Interventions = {}): DayValues {
  const size = branch.sizeClass ?? "M";
  const branchRng = createRng(`${GENERATOR_SEED}|${branch.code}`);
  const branchFactor = 0.92 + 0.16 * branchRng.next();
  const basket = 150 + 30 * branchRng.next();
  const base = BASE_SALES[size] * (REGION_FACTOR[branch.parent ?? ""] ?? 1) * branchFactor;

  const rng = createRng(`${GENERATOR_SEED}|${branch.code}|${day}`);
  const kind = dayKind(day);
  const dayFactor = tradingWeight(day);
  const trend = 1 + 0.0002 * daysBetween("2026-07-01", day);
  const expected = base * dayFactor * trend;

  const shortfall = storyOsaShortfall(branch.code, day, iv);
  const osaNoise = 0.45 * rng.gaussian();
  const osa = Math.min(99.5, 96.8 - (kind === "holiday_eve" ? 1.2 : 0) - shortfall + osaNoise);
  const salesStoryFactor = 1 - 2.2 * (shortfall / 100);
  const sales = expected * salesStoryFactor * (1 + 0.04 * rng.gaussian());
  const transactions = (sales / basket) * (1 + 0.02 * rng.gaussian());
  const P = CATALOG_PLANTS;
  const laborFactor = branch.parent === P.centerLabor.region && day >= P.centerLabor.from ? P.centerLabor.factor : 1;
  const laborCost = (0.12 * expected + 0.03 * base * (kind === "holiday" ? 0 : 1)) * laborFactor;
  const laborPct = kind === "holiday" ? 13 : (laborCost / sales) * 100;

  // Extra KPIs draw from their own streams so adding them never changes the original four.
  const xr = createRng(`${GENERATOR_SEED}|${branch.code}|${day}|x`);
  const osaDip =
    (P.northOsaDip.branches as readonly string[]).includes(branch.code) && day >= P.northOsaDip.from
      ? P.northOsaDip.points
      : 0;
  const shrink =
    1.35 +
    0.15 * branchRng.next() +
    0.12 * xr.gaussian() +
    (branch.code === P.shrinkSpike.branch && day >= P.shrinkSpike.from ? P.shrinkSpike.points : 0);
  const nps =
    40 +
    6 * branchRng.next() +
    1.5 * xr.gaussian() -
    (branch.code === P.npsDrop.branch && day >= P.npsDrop.from ? P.npsDrop.points : 0);

  return {
    net_sales: Math.round(sales),
    transactions: Math.round(transactions),
    osa: Math.round((osa - osaDip) * 10) / 10,
    labor_pct: Math.round(laborPct * 10) / 10,
    shrink_pct: Math.round(shrink * 100) / 100,
    nps: Math.round(nps * 10) / 10,
  };
}

/** Department KPIs: one value per day on the department unit, with the catalog's planted conditions. */
const DEPT_KPIS: Record<string, { base: number; sd: number; plants?: { from: string; to?: string; delta: number }[] }> =
  {
    dc_on_time: { base: 95.5, sd: 0.8, plants: [{ from: "2026-10-20", delta: -17 }] }, // R2
    supplier_fill: { base: 97.4, sd: 0.4, plants: [{ from: "2026-10-18", delta: -4 }] }, // R3
    gross_margin: { base: 25.95, sd: 0.15 }, // G-E0g: recalibrated from 31.8 (target 26.0)
    campaign_ready: { base: 92, sd: 1.5, plants: [{ from: "2026-10-19", delta: -20 }] }, // R4
    opex_vs_budget: { base: 99, sd: 0.6, plants: [{ from: "2026-10-05", delta: 7 }] }, // R7
    vacancy_pct: { base: 3.6, sd: 0.2 },
    training_pct: { base: 94.5, sd: 0.4 },
    compliance_on_time: { base: 99, sd: 0.5, plants: [{ from: "2026-10-17", delta: -19 }] }, // R5
    pos_uptime: { base: 99.92, sd: 0.03, plants: [{ from: "2026-10-21", to: "2026-10-21", delta: -0.4 }] }, // R13
    it_incidents: { base: 4, sd: 1, plants: [{ from: "2026-10-21", to: "2026-10-21", delta: 3 }] },
  };

export function generateDepartmentDay(kpiCode: string, day: string): number {
  const k = DEPT_KPIS[kpiCode];
  if (!k) throw new Error(`no department generator for ${kpiCode}`);
  const rng = createRng(`${GENERATOR_SEED}|dept|${kpiCode}|${day}`);
  const delta = (k.plants ?? [])
    .filter((p) => day >= p.from && (!p.to || day <= p.to))
    .reduce((sum, p) => sum + p.delta, 0);
  const v = k.base + k.sd * rng.gaussian() + delta;
  if (kpiCode === "it_incidents") return Math.max(0, Math.round(v));
  const capped = kpiCode === "opex_vs_budget" ? v : Math.min(v, 100);
  return Math.round(capped * 100) / 100;
}
