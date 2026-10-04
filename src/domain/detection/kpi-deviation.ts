/**
 * KPI deviation detector v1 (pure). Compares the last 7 days with what the same weekdays usually
 * look like (prior 4 weeks, holidays excluded) and measures how unusual the gap is.
 */
import { addDays, dayKind, weekday } from "../calendar";

export const DETECTOR = { name: "kpi-deviation", version: "1" } as const;

export type Point = { day: string; value: number };

export type KpiConfig = {
  code: string;
  higherIsBetter: boolean;
  /** "ratio": compare relative change (sales); "points": absolute difference (percent KPIs). */
  mode: "ratio" | "points";
  /** Minimum adverse change to report: ratio (0.08 = 8%) or points. */
  minChange: number;
  minZ: number;
};

export const KPI_CONFIG: Record<string, KpiConfig> = {
  net_sales: { code: "net_sales", higherIsBetter: true, mode: "ratio", minChange: 0.08, minZ: 3 },
  transactions: { code: "transactions", higherIsBetter: true, mode: "ratio", minChange: 0.1, minZ: 3 },
  osa: { code: "osa", higherIsBetter: true, mode: "points", minChange: 2, minZ: 3 },
  labor_pct: { code: "labor_pct", higherIsBetter: false, mode: "points", minChange: 1.5, minZ: 3 },
};

export type Deviation = {
  kpi: string;
  windowStart: string;
  windowEnd: string; // inclusive
  actualTotal: number;
  expectedTotal: number;
  /** ratio mode: actual/expected − 1; points mode: mean actual − mean expected. */
  change: number;
  z: number;
  adverse: boolean;
  days: { day: string; actual: number; expected: number }[];
  baselineWeeks: number;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1));
};

/** Expected value for a day: mean of the same weekday over the 4 prior weeks, holidays excluded. */
function expectedFor(byDay: Map<string, number>, day: string, excludeDay?: string): number | undefined {
  const vals: number[] = [];
  for (let w = 1; w <= 4; w++) {
    const d = addDays(day, -7 * w);
    if (d === excludeDay || dayKind(d) !== "normal") continue;
    const v = byDay.get(d);
    if (v !== undefined) vals.push(v);
  }
  return vals.length >= 2 ? mean(vals) : undefined;
}

export function detectDeviation(series: Point[], asOf: string, cfg: KpiConfig): Deviation | null {
  const byDay = new Map(series.map((p) => [p.day, p.value]));
  const diff = (a: number, e: number) => (cfg.mode === "ratio" ? a / e - 1 : a - e);

  const days: Deviation["days"] = [];
  for (let i = 7; i >= 1; i--) {
    const d = addDays(asOf, -i);
    const a = byDay.get(d);
    const e = expectedFor(byDay, d);
    if (a === undefined || e === undefined || dayKind(d) !== "normal" || weekday(d) === 6) continue;
    days.push({ day: d, actual: a, expected: e });
  }
  if (days.length < 4) return null;

  // Noise: the same daily residual measured over the 4 weeks before the window.
  const noise: number[] = [];
  for (let i = 35; i >= 8; i--) {
    const d = addDays(asOf, -i);
    const a = byDay.get(d);
    const e = expectedFor(byDay, d);
    if (a === undefined || e === undefined || dayKind(d) !== "normal" || weekday(d) === 6) continue;
    noise.push(diff(a, e));
  }
  if (noise.length < 8) return null;

  const residuals = days.map((x) => diff(x.actual, x.expected));
  const sigma = Math.max(std(noise), cfg.mode === "ratio" ? 0.005 : 0.05);
  const meanResidual = mean(residuals);
  const z = meanResidual / (sigma / Math.sqrt(residuals.length));
  const actualTotal = days.reduce((s, x) => s + x.actual, 0);
  const expectedTotal = days.reduce((s, x) => s + x.expected, 0);
  const change = cfg.mode === "ratio" ? actualTotal / expectedTotal - 1 : meanResidual;
  const adverse = cfg.higherIsBetter ? change < 0 : change > 0;
  if (!adverse || Math.abs(change) < cfg.minChange || Math.abs(z) < cfg.minZ) return null;
  return {
    kpi: cfg.code,
    windowStart: days[0].day,
    windowEnd: days[days.length - 1].day,
    actualTotal,
    expectedTotal,
    change,
    z,
    adverse,
    days,
    baselineWeeks: 4,
  };
}
