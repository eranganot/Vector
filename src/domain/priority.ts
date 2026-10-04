/**
 * Prioritization (docs/specs/priority.md, ADR-005 as amended 2026-10-04). Deterministic and versioned:
 * the same inputs and versions always give the same result, and the breakdown is stored with it.
 *
 * Two workstreams are scored separately and never ranked against each other (ADR-006):
 *  - risks: priority-v2 (bands P1–P4), plus a scope-relative "local" view for region/branch managers;
 *  - opportunities: opportunity-v1 (bands O1–O3).
 */
export type Breadth = "isolated" | "local" | "regional" | "systemic";
export type Band = "P1" | "P2" | "P3" | "P4";
export type OpportunityBand = "O1" | "O2" | "O3";

const BREADTH: Record<Breadth, number> = { isolated: 0.25, local: 0.5, regional: 0.75, systemic: 1 };
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const round1 = (x: number) => Math.round(x * 10) / 10;
const confidenceMultiplier = (c: number) => 0.6 + 0.4 * clamp01(c);

/** ₪ per week on a log scale: ₪5k → 0, ₪1M → 1. */
const ilsScale = (ils: number) => clamp01(Math.log10(Math.max(ils, 1) / 5_000) / Math.log10(1_000_000 / 5_000));

/** Hours until impact / due / close; null = already happening; negative (overdue) counts as now. */
export const timeFactor = (h: number | null) =>
  h === null ? 0.75 : h <= 24 ? 1 : h <= 72 ? 0.75 : h <= 168 ? 0.5 : h <= 720 ? 0.25 : 0.1;

function weighted<K extends string>(weights: Record<K, number>, factors: Record<K, number>) {
  return (Object.keys(weights) as K[]).reduce((s, k) => s + weights[k] * factors[k], 0);
}

// ── Risks: priority-v2 ───────────────────────────────────────────────────────
export const PRIORITY_MODEL_VERSION = "priority-v2";
export const WEIGHTS_VERSION = "weights-v2";
export const WEIGHTS_V2 = {
  magnitude: 0.15,
  impact: 0.2,
  breadth: 0.1,
  urgency: 0.15,
  strategic: 0.3,
  compliance: 0.1,
} as const;
export const BANDS = { P1: 67, P2: 51, P3: 38 } as const;

export type RiskFactor = keyof typeof WEIGHTS_V2;

export type PriorityInput = {
  z: number;
  impactIls: number;
  breadth: Breadth;
  hoursToImpact: number | null;
  strategicWeight: number;
  /**
   * Regulatory or contractual exposure if unhandled: 0 none · 0.3 contractual terms at stake ·
   * 0.6 internal policy obligation · 0.8 legal/regulatory deadline · 1.0 safety or regulator-mandated action.
   */
  compliance: number;
  confidence: number;
};

export type PriorityBreakdown = {
  model: string;
  weightsVersion: string;
  input: PriorityInput;
  factors: Record<RiskFactor, number>;
  weights: typeof WEIGHTS_V2;
  confidenceMultiplier: number;
  score: number;
  band: Band;
};

export const bandFor = (score: number): Band =>
  score >= BANDS.P1 ? "P1" : score >= BANDS.P2 ? "P2" : score >= BANDS.P3 ? "P3" : "P4";

export function priorityFactors(i: PriorityInput): Record<RiskFactor, number> {
  return {
    magnitude: Math.min(Math.abs(i.z), 4) / 4,
    impact: ilsScale(i.impactIls),
    breadth: BREADTH[i.breadth],
    urgency: timeFactor(i.hoursToImpact),
    strategic: clamp01(i.strategicWeight),
    compliance: clamp01(i.compliance),
  };
}

export function computePriority(input: PriorityInput): PriorityBreakdown {
  const factors = priorityFactors(input);
  const cm = confidenceMultiplier(input.confidence);
  const score = round1(100 * weighted(WEIGHTS_V2, factors) * cm);
  return {
    model: PRIORITY_MODEL_VERSION,
    weightsVersion: WEIGHTS_VERSION,
    input,
    factors,
    weights: WEIGHTS_V2,
    confidenceMultiplier: cm,
    score,
    band: bandFor(score),
  };
}

// ── Risks seen from a region or branch: local priority ──────────────────────
export const LOCAL_MODEL_VERSION = "priority-v2-local";

export type LocalScope = {
  /** The viewer's scope unit kind (a group-level viewer uses the organizational priority). */
  scope: "region" | "branch";
  scopeWeeklySalesIls: number;
  /** Share of the scope's branches (or the branch itself = 1) the issue affects. */
  shareOfScopeAffected: number;
};

/**
 * The same model, with impact and breadth measured against the viewer's own scope: ₪40k is small for
 * the group but large for one branch, and one branch is "isolated" for the group but all of a branch
 * manager's world.
 */
export function computeLocalPriority(input: PriorityInput, scope: LocalScope): PriorityBreakdown {
  const share = input.impactIls / Math.max(scope.scopeWeeklySalesIls, 1);
  const s = scope.shareOfScopeAffected;
  const factors: Record<RiskFactor, number> = {
    ...priorityFactors(input),
    impact: clamp01(Math.log10(Math.max(share, 1e-9) / 0.005) / Math.log10(0.1 / 0.005)),
    breadth: s >= 0.5 ? 1 : s >= 0.25 ? 0.75 : s >= 0.1 ? 0.5 : 0.25,
  };
  const cm = confidenceMultiplier(input.confidence);
  const score = round1(100 * weighted(WEIGHTS_V2, factors) * cm);
  return {
    model: LOCAL_MODEL_VERSION,
    weightsVersion: WEIGHTS_VERSION,
    input,
    factors,
    weights: WEIGHTS_V2,
    confidenceMultiplier: cm,
    score,
    band: bandFor(score),
  };
}

// ── Opportunities: opportunity-v1 ────────────────────────────────────────────
export const OPPORTUNITY_MODEL_VERSION = "opportunity-v1";
export const OPPORTUNITY_WEIGHTS = { value: 0.3, window: 0.25, reach: 0.1, strategic: 0.2, ease: 0.15 } as const;
export const OPPORTUNITY_BANDS = { O1: 60, O2: 33 } as const;
export type OpportunityFactor = keyof typeof OPPORTUNITY_WEIGHTS;

export type OpportunityInput = {
  /** Upside per week (or one-off value spread over a week), ₪. */
  valueIls: number;
  /** Cost to capture it, ₪. */
  costIls: number;
  reach: Breadth;
  /** Hours until the window closes. */
  hoursToClose: number;
  strategicFit: number;
  confidence: number;
};

export type OpportunityBreakdown = {
  model: string;
  input: OpportunityInput;
  factors: Record<OpportunityFactor, number>;
  weights: typeof OPPORTUNITY_WEIGHTS;
  confidenceMultiplier: number;
  score: number;
  band: OpportunityBand;
};

export const opportunityBandFor = (score: number): OpportunityBand =>
  score >= OPPORTUNITY_BANDS.O1 ? "O1" : score >= OPPORTUNITY_BANDS.O2 ? "O2" : "O3";

export function computeOpportunity(input: OpportunityInput): OpportunityBreakdown {
  const factors: Record<OpportunityFactor, number> = {
    value: ilsScale(input.valueIls),
    window: timeFactor(input.hoursToClose),
    reach: BREADTH[input.reach],
    strategic: clamp01(input.strategicFit),
    ease: input.valueIls / (input.valueIls + Math.max(input.costIls, 0)),
  };
  const cm = confidenceMultiplier(input.confidence);
  const score = round1(100 * weighted(OPPORTUNITY_WEIGHTS, factors) * cm);
  return {
    model: OPPORTUNITY_MODEL_VERSION,
    input,
    factors,
    weights: OPPORTUNITY_WEIGHTS,
    confidenceMultiplier: cm,
    score,
    band: opportunityBandFor(score),
  };
}
