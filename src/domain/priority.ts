/**
 * Priority model v1 (docs/specs/priority.md, ADR-005). Deterministic and versioned: the same inputs
 * and versions always produce the same score; the breakdown is stored on the insight.
 */
export const PRIORITY_MODEL_VERSION = "priority-v1";
export const WEIGHTS_VERSION = "weights-v1";
export const WEIGHTS_V1 = { magnitude: 0.2, impact: 0.3, breadth: 0.15, urgency: 0.2, strategic: 0.15 } as const;
export const BANDS = { P1: 70, P2: 55, P3: 40 } as const;

const IMPACT_FLOOR = 5_000;
const IMPACT_CEIL = 1_000_000;

export type Breadth = "isolated" | "local" | "regional" | "systemic";
export type Band = "P1" | "P2" | "P3" | "P4";

export type PriorityInput = {
  z: number;
  impactIls: number;
  breadth: Breadth;
  /** Hours until impact or due date; null = already happening; negative = overdue. */
  hoursToImpact: number | null;
  strategicWeight: number;
  confidence: number;
};

export type PriorityBreakdown = {
  model: string;
  weightsVersion: string;
  input: PriorityInput;
  factors: Record<keyof typeof WEIGHTS_V1, number>;
  weights: typeof WEIGHTS_V1;
  confidenceMultiplier: number;
  score: number;
  band: Band;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function priorityFactors(i: PriorityInput) {
  const h = i.hoursToImpact;
  return {
    magnitude: Math.min(Math.abs(i.z), 4) / 4,
    impact: clamp01(Math.log10(Math.max(i.impactIls, 1) / IMPACT_FLOOR) / Math.log10(IMPACT_CEIL / IMPACT_FLOOR)),
    breadth: { isolated: 0.25, local: 0.5, regional: 0.75, systemic: 1 }[i.breadth],
    urgency: h === null ? 0.75 : h <= 24 ? 1 : h <= 72 ? 0.75 : h <= 168 ? 0.5 : h <= 720 ? 0.25 : 0.1,
    strategic: clamp01(i.strategicWeight),
  };
}

export const bandFor = (score: number): Band =>
  score >= BANDS.P1 ? "P1" : score >= BANDS.P2 ? "P2" : score >= BANDS.P3 ? "P3" : "P4";

export function computePriority(input: PriorityInput): PriorityBreakdown {
  const f = priorityFactors(input);
  const weighted = (Object.keys(WEIGHTS_V1) as (keyof typeof WEIGHTS_V1)[]).reduce(
    (sum, k) => sum + WEIGHTS_V1[k] * f[k],
    0,
  );
  const confidenceMultiplier = 0.6 + 0.4 * clamp01(input.confidence);
  const score = Math.round(100 * weighted * confidenceMultiplier * 10) / 10;
  return {
    model: PRIORITY_MODEL_VERSION,
    weightsVersion: WEIGHTS_VERSION,
    input,
    factors: f,
    weights: WEIGHTS_V1,
    confidenceMultiplier,
    score,
    band: bandFor(score),
  };
}
