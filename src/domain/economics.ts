/**
 * Action economics, baseline (plan v2, E1c; cross-department.md §2). Every proposed action carries the ₪ it is
 * expected to deliver by the end of the quarter, its cost, and an execution risk. This is `economics-v0`: impact from
 * the insight's weekly ₪ and the playbook's capture rate, risk from the playbook's baseline. `economics-v1` (E3) adds
 * the live risk factors (dependencies, conflicts, track record, owner load). Pure and deterministic.
 */
export const ECONOMICS_MODEL = "economics-v0";

/** Share of the weekly ₪ at stake (or upside) the action type is expected to capture. */
const CAPTURE: Record<string, number> = {
  inventory_transfer: 0.7,
  reroute_delivery: 0.6,
  staffing_change: 0.6,
  recall: 0.9,
  regulatory_notification: 0.5,
  contract_clause_invocation: 0.4,
  schedule_change: 0.5,
  campaign_change: 0.5,
  purchase_order: 0.5,
  price_change: 0.5,
  budget_decision: 0.4,
  forecast_update: 0.2,
  training_session: 0.3,
  customer_message: 0.2,
  supplier_message: 0.3,
  notify_owner: 0.1,
};

/** Baseline execution risk (0–1) of the action type before live factors. */
const BASE_RISK: Record<string, number> = {
  inventory_transfer: 0.25,
  reroute_delivery: 0.35,
  staffing_change: 0.35,
  recall: 0.3,
  regulatory_notification: 0.15,
  contract_clause_invocation: 0.45,
  schedule_change: 0.4,
  campaign_change: 0.4,
  purchase_order: 0.6,
  price_change: 0.45,
  budget_decision: 0.3,
  forecast_update: 0.15,
  training_session: 0.2,
  customer_message: 0.15,
  supplier_message: 0.25,
  notify_owner: 0.1,
};

export type EconomicsInput = {
  type: string;
  /** ₪ per week at stake (risk) or upside (opportunity) of the insight. */
  weeklyIls: number;
  confidence: number;
  /** How many actions share the response (the impact is split between them). */
  actionsInResponse: number;
  /** Proposal time and the end of the quarter it is measured to. */
  now: Date;
};

export type Economics = {
  expectedImpactIls: number;
  impactBasis: string;
  executionRisk: number;
  riskFactors: { model: string; baseline: number; captureRate: number; weeks: number; note: string };
};

/** End of the calendar quarter (FB-5: the fiscal year is the calendar year). */
export function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return new Date(Date.UTC(d.getUTCFullYear(), q * 3 + 3, 1) - 1);
}

export function actionEconomics(i: EconomicsInput): Economics {
  const capture = CAPTURE[i.type] ?? 0.3;
  const baseline = BASE_RISK[i.type] ?? 0.3;
  const weeks = Math.max(
    1,
    Math.min(13, Math.round((endOfQuarter(i.now).getTime() - i.now.getTime()) / (7 * 86_400_000))),
  );
  const n = Math.max(1, i.actionsInResponse);
  const impact = Math.round((i.weeklyIls * weeks * capture * i.confidence) / n / 1000) * 1000;
  return {
    expectedImpactIls: impact,
    impactBasis: `₪${Math.round(i.weeklyIls / 1000)}k/week × ${weeks} weeks to quarter end × ${Math.round(capture * 100)}% captured × confidence ${i.confidence}${n > 1 ? ` ÷ ${n} actions` : ""}`,
    executionRisk: baseline,
    riskFactors: {
      model: ECONOMICS_MODEL,
      baseline,
      captureRate: capture,
      weeks,
      note: "baseline by action type; dependencies, conflicts, track record and owner load arrive with economics-v1 (E3)",
    },
  };
}

// ── economics-v1: live execution risk (E3; cross-department.md §2) ──────────────────────────────────────────────

export const EXECUTION_RISK_MODEL = "economics-v1";
export const EXECUTION_RISK_WEIGHTS = { dependency: 0.3, conflict: 0.25, trackRecord: 0.25, ownerLoad: 0.2 } as const;

export type ExecutionRiskInput = {
  /** Open dependencies the action needs (its target units wait on them), and how many are at risk or blocked. */
  dependencies: { open: number; troubled: number };
  /** An open conflict touches the action's units. */
  inConflict: boolean;
  /** Past outcomes of the same action type: worked and judged (worked, partly worked, did not work). */
  pastOutcomes: { worked: number; judged: number };
  /** The owner's open action items and how many of them are overdue. */
  ownerItems: { open: number; overdue: number };
};

export type ExecutionRisk = {
  model: string;
  score: number;
  level: "low" | "medium" | "high";
  factors: { dependency: number; conflict: number; trackRecord: number; ownerLoad: number };
};

/**
 * execution risk = 0.30 × dependency (share of the open dependencies it needs that are at risk or blocked)
 *               + 0.25 × conflict (1 when an open conflict touches its units)
 *               + 0.25 × track record (1 − hit rate of the same action type; 0.5 with no history)
 *               + 0.20 × owner load (owner's overdue ÷ open items)
 */
export function executionRisk(i: ExecutionRiskInput): ExecutionRisk {
  const factors = {
    dependency: i.dependencies.open ? i.dependencies.troubled / i.dependencies.open : 0,
    conflict: i.inConflict ? 1 : 0,
    trackRecord: i.pastOutcomes.judged ? 1 - i.pastOutcomes.worked / i.pastOutcomes.judged : 0.5,
    ownerLoad: i.ownerItems.open ? i.ownerItems.overdue / i.ownerItems.open : 0,
  };
  const w = EXECUTION_RISK_WEIGHTS;
  const score =
    Math.round(
      (w.dependency * factors.dependency +
        w.conflict * factors.conflict +
        w.trackRecord * factors.trackRecord +
        w.ownerLoad * factors.ownerLoad) *
        100,
    ) / 100;
  return { model: EXECUTION_RISK_MODEL, score, level: riskLevel(score), factors };
}

export const riskLevel = (r: number): ExecutionRisk["level"] => (r < 0.3 ? "low" : r <= 0.6 ? "medium" : "high");
