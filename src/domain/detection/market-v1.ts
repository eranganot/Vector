/**
 * market-v1 (plan v2, E6; market-intelligence.md §4): rules that turn public market data into signals. Pure.
 *
 * MK1 a competitor's basket index in a category drops ≥ 3% over 14 days in a region we trade in (needs daily snapshots)
 * MK2 CBS food prices fall month on month while our price index rises, two months running
 * MK3 a competitor reports same-store sales ≤ −5% while ours grow
 * MK4 a competitor's store count in a region drops (needs daily snapshots)
 *
 * The ₪ figures are stated assumptions, shown with the insight: MK2 volume at risk = weekly sales × the gap between our
 * price moves and CBS's × PRICE_ELASTICITY; MK3 upside = weekly sales × SHARE_GAIN_UPLIFT.
 */
export const MARKET_RULES = { name: "market-v1", version: "1.0.0" } as const;

/** Volume lost per 1% of relative price increase (grocery, conservative). */
export const PRICE_ELASTICITY = 1.5;
/** Weekly sales uplift we target by pushing the categories where we lead on price while a competitor shrinks. */
export const SHARE_GAIN_UPLIFT = 0.01;
export const MK1_DROP = 0.03;
export const MK1_DAYS = 14;
export const MK3_SSS = -5;

type Monthly = { period: string; value: number }[];
const mom = (xs: Monthly, i: number) => xs[i].value / xs[i - 1].value - 1;
const r1 = (x: number) => Math.round(x * 10) / 10;

export type Mk2 = {
  months: { period: string; cbsPct: number; oursPct: number }[];
  /** Percentage points our prices moved against CBS food over the run. */
  gapPts: number;
};

/** MK2: the last `run` months (aligned by period) each have CBS food m/m < 0 and ours > 0. */
export function mk2(cbsFood: Monthly, ours: Monthly, run = 2): Mk2 | null {
  const periods = cbsFood.map((p) => p.period).filter((p) => ours.some((o) => o.period === p));
  const c = periods.map((p) => cbsFood.find((x) => x.period === p)!);
  const o = periods.map((p) => ours.find((x) => x.period === p)!);
  if (c.length < run + 1) return null;
  const months: Mk2["months"] = [];
  for (let i = c.length - run; i < c.length; i++) {
    const cbsPct = mom(c, i) * 100;
    const oursPct = mom(o, i) * 100;
    if (!(cbsPct < 0 && oursPct > 0)) return null;
    months.push({ period: c[i].period, cbsPct: r1(cbsPct), oursPct: r1(oursPct) });
  }
  return { months, gapPts: r1(months.reduce((a, m) => a + m.oursPct - m.cbsPct, 0)) };
}

export const mk2AtRiskIls = (weeklySalesIls: number, gapPts: number) =>
  Math.round(weeklySalesIls * (gapPts / 100) * PRICE_ELASTICITY);

/** MK3: a competitor's reported same-store sales ≤ −5% while our same-store sales grow. */
export function mk3(competitorSss: number | null, ourGrowthPct: number | null) {
  if (competitorSss === null || ourGrowthPct === null) return null;
  return competitorSss <= MK3_SSS && ourGrowthPct > 0 ? { competitorSss, ourGrowthPct: r1(ourGrowthPct) } : null;
}

export const mk3UpsideIls = (weeklySalesIls: number) => Math.round(weeklySalesIls * SHARE_GAIN_UPLIFT);

/** Categories where our index is below the competitor's (we are cheaper), cheapest lead first. */
export function priceLeads(ours: Record<string, number | null>, theirs: Record<string, number | null>) {
  return Object.keys(ours)
    .filter((k) => ours[k] !== null && theirs[k] !== null && ours[k]! < theirs[k]!)
    .map((k) => ({ category: k, ours: ours[k]!, theirs: theirs[k]!, leadPts: r1(theirs[k]! - ours[k]!) }))
    .sort((a, b) => b.leadPts - a.leadPts);
}

/** MK1: the index on the last day vs the latest day at least 14 days earlier dropped by ≥ 3%. */
export function mk1(points: { day: string; index: number }[]) {
  const s = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const last = s.at(-1);
  if (!last) return null;
  const cutoff = new Date(Date.parse(last.day) - MK1_DAYS * 86_400_000).toISOString().slice(0, 10);
  const before = s.filter((p) => p.day <= cutoff).at(-1);
  if (!before) return null;
  const change = last.index / before.index - 1;
  return change <= -MK1_DROP ? { from: before, to: last, changePct: r1(change * 100) } : null;
}

/** MK4: the store count on the last day is below the previous observation. */
export function mk4(points: { day: string; count: number }[]) {
  const s = [...points].sort((a, b) => a.day.localeCompare(b.day));
  if (s.length < 2) return null;
  const [prev, last] = s.slice(-2);
  return last.count < prev.count ? { from: prev, to: last, closed: prev.count - last.count } : null;
}

/** MK6 (G-E6b, Eran 2026-10-10): a category where we are this far above the market median (index ≥ 103). */
export const MK6_GAP = 3;

export type Mk6 = {
  ours: number;
  gapPct: number;
  /** Our gap to every other chain in the region, dearest gap first (positive: we are dearer). */
  vsChains: { chain: string; index: number; gapPct: number }[];
};

/**
 * MK6 price gap: our category index in a region is ≥ 3% above the market median (100); the gap to each chain is our
 * index ÷ theirs − 1, so "we are 4% dearer than Shufersal" reads directly.
 */
export function mk6(ours: number | null, chains: Record<string, number | null>): Mk6 | null {
  if (ours === null || ours - 100 < MK6_GAP) return null;
  const vsChains = Object.entries(chains)
    .filter((e): e is [string, number] => e[1] !== null)
    .map(([chain, index]) => ({ chain, index, gapPct: r1((ours / index - 1) * 100) }))
    .sort((a, b) => b.gapPct - a.gapPct);
  return { ours, gapPct: r1(ours - 100), vsChains };
}

/** ₪ a week at risk: the category's weekly sales × the gap × PRICE_ELASTICITY. */
export const mk6AtRiskIls = (categoryWeeklySalesIls: number, gapPct: number) =>
  Math.round(categoryWeeklySalesIls * (gapPct / 100) * PRICE_ELASTICITY);
