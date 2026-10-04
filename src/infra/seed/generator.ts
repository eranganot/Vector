/**
 * Deterministic synthetic KPI generator (docs/specs/synthetic-data.md). Every value depends only on
 * (seed, branch, KPI, day, interventions), never on generation order, so history and future days
 * produced by the scenario engine are reproducible.
 */
import { dayKind, weekday } from "@/domain/calendar";
import { createRng } from "./prng";
import type { UnitSeed } from "./org";

export const GENERATOR_SEED = "vector-v1";

const WEEKDAY_SHAPE = [0.95, 0.9, 0.9, 1.0, 1.25, 1.1, 0.35]; // Sun..Sat
const BASE_SALES = { L: 190_000, M: 110_000 } as const;
const REGION_FACTOR: Record<string, number> = { NORTH: 0.97, CENTER: 1.05 };

export type Interventions = {
  /** Day the stock transfer for planted story P2-S1 executed (recovery starts the next day). */
  p2s1TransferDay?: string;
};

export type DayValues = { net_sales: number; transactions: number; osa: number; labor_pct: number };

/** Planted story P2-S1: Haifa Grand Canyon OSA falls after a DC routing change; sales follow. */
export const P2S1 = {
  branch: "HFA-GC",
  osaDeclineStart: "2026-10-12",
  osaFloor: 88.8,
  cause: "DC routing change on 2026-10-11 dropped two top categories from the Haifa Grand Canyon delivery wave",
};

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

export function generateDay(branch: UnitSeed, day: string, iv: Interventions = {}): DayValues {
  const size = branch.sizeClass ?? "M";
  const branchRng = createRng(`${GENERATOR_SEED}|${branch.code}`);
  const branchFactor = 0.92 + 0.16 * branchRng.next();
  const basket = 150 + 30 * branchRng.next();
  const base = BASE_SALES[size] * (REGION_FACTOR[branch.parent ?? ""] ?? 1) * branchFactor;

  const rng = createRng(`${GENERATOR_SEED}|${branch.code}|${day}`);
  const kind = dayKind(day);
  const dayFactor = kind === "holiday" ? 0.05 : kind === "holiday_eve" ? 1.45 : WEEKDAY_SHAPE[weekday(day)];
  const trend = 1 + 0.0002 * daysBetween("2026-07-01", day);
  const expected = base * dayFactor * trend;

  const shortfall = storyOsaShortfall(branch.code, day, iv);
  const osaNoise = 0.45 * rng.gaussian();
  const osa = Math.min(99.5, 96.8 - (kind === "holiday_eve" ? 1.2 : 0) - shortfall + osaNoise);
  const salesStoryFactor = 1 - 2.2 * (shortfall / 100);
  const sales = expected * salesStoryFactor * (1 + 0.04 * rng.gaussian());
  const transactions = (sales / basket) * (1 + 0.02 * rng.gaussian());
  const laborCost = 0.12 * expected + 0.03 * base * (kind === "holiday" ? 0 : 1);
  const laborPct = kind === "holiday" ? 13 : (laborCost / sales) * 100;

  return {
    net_sales: Math.round(sales),
    transactions: Math.round(transactions),
    osa: Math.round(osa * 10) / 10,
    labor_pct: Math.round(laborPct * 10) / 10,
  };
}
