/**
 * Projection to end of month and end of quarter (projection-v1; executive-home.md §4.3). Pure and deterministic.
 *
 *   projected = actual to date + baseline (budget still to come × recent run-rate ratio)
 *               − risk drag (₪ per week at stake × weeks it bites × confidence; revenue lines only)
 *               + action lift (approved 0.5 · executing 0.8 of each action's expected impact in the horizon)
 *
 * The range is ±1 standard deviation of the recent daily ratio, scaled to the days still to come.
 * When the AI agent arrives it may propose a projection beside this one; it never replaces it silently (FB-6).
 */
export const PROJECTION_MODEL = "projection-v1";

export type ProjectionInput = {
  /** Actual so far in the horizon (month or quarter to date). */
  actualToDate: number;
  /** Budget for the days still to come in the horizon. */
  budgetRemaining: number;
  /** Budget for the whole horizon (the target the projection is judged against). */
  budgetTotal: number;
  /** Recent daily actual ÷ daily budget ratios (e.g. the last 28 days). */
  recentRatios: number[];
  /** Days still to come in the horizon. */
  daysRemaining: number;
  /** Risks that bite this line inside the horizon. */
  risks: { weeklyIls: number; confidence: number }[];
  /** Approved or executing actions that lift this line inside the horizon. */
  actions: { status: "approved" | "executing"; impactIls: number }[];
  /** Weeks a risk keeps biting before its response lands (the drag is capped there). */
  riskWeeksCap?: number;
  higherIsBetter: boolean;
};

export type Projection = {
  model: string;
  mid: number;
  low: number;
  high: number;
  terms: { actualToDate: number; baseline: number; riskDrag: number; actionLift: number; runRate: number };
  /** Signed % vs the horizon budget, negative when worse. */
  gapPct: number;
  verdict: "on_track" | "at_risk" | "miss";
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 1);
const sd = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

export function project(i: ProjectionInput): Projection {
  const runRate = mean(i.recentRatios.filter((r) => Number.isFinite(r)));
  const baseline = i.budgetRemaining * runRate;
  const weeks = Math.min(i.daysRemaining / 7, i.riskWeeksCap ?? 2);
  const riskDrag = i.higherIsBetter ? i.risks.reduce((s, r) => s + r.weeklyIls * weeks * r.confidence, 0) : 0;
  const actionLift = i.actions.reduce((s, a) => s + a.impactIls * (a.status === "executing" ? 0.8 : 0.5), 0);
  const mid = i.actualToDate + baseline - riskDrag + (i.higherIsBetter ? actionLift : -actionLift);
  // Daily ratios are independent days: the spread of the remaining total grows with √days.
  const daily = i.daysRemaining > 0 ? i.budgetRemaining / i.daysRemaining : 0;
  const spread = sd(i.recentRatios) * daily * Math.sqrt(Math.max(0, i.daysRemaining));
  const raw = i.budgetTotal ? ((mid - i.budgetTotal) / Math.abs(i.budgetTotal)) * 100 : 0;
  const gapPct = i.higherIsBetter ? raw : -raw;
  return {
    model: PROJECTION_MODEL,
    mid,
    low: mid - spread,
    high: mid + spread,
    terms: { actualToDate: i.actualToDate, baseline, riskDrag, actionLift, runRate },
    gapPct,
    verdict: gapPct >= 0 ? "on_track" : gapPct >= -2 ? "at_risk" : "miss",
  };
}

/** Direction word from health now vs projected health (±3 points). */
export function direction(now: number, projected: number): "improving" | "stable" | "worsening" {
  return projected - now >= 3 ? "improving" : projected - now <= -3 ? "worsening" : "stable";
}
