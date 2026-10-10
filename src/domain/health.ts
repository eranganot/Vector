/**
 * Department health (health-v2; docs/specs/executive-home.md §4). Pure and deterministic.
 *
 *   health = 0.45 × KPI attainment + 0.35 × money attainment + 0.20 × risk load
 *
 * Attainment of one measure: 100 when on or better than its reference (target, budget or usual level), otherwise
 * max(0, 100 + 8 × gap%), where gap% is the signed relative gap, negative when worse. −2.5% scores 80, −5% scores 60.
 * Risk load is the Phase 3 pulse: 100 − open risks owned (P1 20 · P2 10 · P3 4 · P4 1) − risks it must act on but does
 * not own (P1 6 · P2 3 · P3 1), floored at 0.
 */
export const HEALTH_MODEL = "health-v2";
export const HEALTH_WEIGHTS = { kpi: 0.45, money: 0.35, risk: 0.2 } as const;
const OWNED: Record<string, number> = { P1: 20, P2: 10, P3: 4, P4: 1 };
const INVOLVED: Record<string, number> = { P1: 6, P2: 3, P3: 1 };

export type Measure = {
  code: string;
  name: string;
  kind: "kpi" | "money";
  value: number;
  /** Target, budget to date or usual level. */
  reference: number;
  higherIsBetter: boolean;
  /** A fixed attainment for measures with no meaningful relative gap (e.g. penalty exposure against a zero budget). */
  score?: number;
};

/** Signed gap in %: negative when the measure is worse than its reference. */
export function gapPct(m: Pick<Measure, "value" | "reference" | "higherIsBetter">): number {
  if (!m.reference) return m.value === 0 ? 0 : m.higherIsBetter ? 100 : -100;
  const raw = ((m.value - m.reference) / Math.abs(m.reference)) * 100;
  return m.higherIsBetter ? raw : -raw;
}

export function attainment(gap: number): number {
  return gap >= 0 ? 100 : Math.max(0, 100 + 8 * gap);
}

export function riskLoad(owned: string[], involved: string[]): number {
  const p = owned.reduce((s, b) => s + (OWNED[b] ?? 0), 0) + involved.reduce((s, b) => s + (INVOLVED[b] ?? 0), 0);
  return Math.max(0, 100 - p);
}

export type HealthInput = { measures: Measure[]; ownedRiskBands: string[]; involvedRiskBands: string[] };

export type HealthResult = {
  model: string;
  score: number;
  status: "healthy" | "watch" | "at_risk";
  kpi: number;
  money: number;
  risk: number;
  /** Each measure's attainment and its weight in the score (weight × attainment = its contribution). */
  parts: { code: string; name: string; kind: "kpi" | "money"; gap: number; attainment: number; weight: number }[];
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 100);
export const statusOf = (s: number): HealthResult["status"] => (s >= 80 ? "healthy" : s >= 60 ? "watch" : "at_risk");

export function health(i: HealthInput): HealthResult {
  const kpis = i.measures.filter((m) => m.kind === "kpi");
  const money = i.measures.filter((m) => m.kind === "money");
  const parts = i.measures.map((m) => {
    const gap = m.score !== undefined ? m.score - 100 : gapPct(m);
    const group = m.kind === "kpi" ? kpis : money;
    return {
      code: m.code,
      name: m.name,
      kind: m.kind,
      gap,
      attainment: m.score !== undefined ? Math.max(0, Math.min(100, m.score)) : attainment(gap),
      weight: (m.kind === "kpi" ? HEALTH_WEIGHTS.kpi : HEALTH_WEIGHTS.money) / group.length,
    };
  });
  // A department with no measure of a kind scores that kind at 100 (nothing measured is off target).
  const kpi = mean(parts.filter((p) => p.kind === "kpi").map((p) => p.attainment));
  const m = mean(parts.filter((p) => p.kind === "money").map((p) => p.attainment));
  const risk = riskLoad(i.ownedRiskBands, i.involvedRiskBands);
  const score = HEALTH_WEIGHTS.kpi * kpi + HEALTH_WEIGHTS.money * m + HEALTH_WEIGHTS.risk * risk;
  return { model: HEALTH_MODEL, score: round1(score), status: statusOf(score), kpi, money: m, risk, parts };
}

/**
 * The change between two health results, decomposed into each measure's contribution (its weight × its change in
 * attainment) and the risk load's. Sorted by size, largest first; contributions sum to the change.
 */
export function decompose(now: HealthResult, before: HealthResult) {
  const contributions = now.parts.map((p) => {
    const b = before.parts.find((x) => x.code === p.code);
    return {
      code: p.code,
      name: p.name,
      kind: p.kind,
      points: p.weight * (p.attainment - (b?.attainment ?? p.attainment)),
    };
  });
  contributions.push({
    code: "risk_load",
    name: "Open risks",
    kind: "kpi",
    points: HEALTH_WEIGHTS.risk * (now.risk - before.risk),
  });
  return {
    change: round1(now.score - before.score),
    contributions: contributions
      .map((c) => ({ ...c, points: round1(c.points) }))
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points)),
  };
}

export const round1 = (v: number) => Math.round(v * 10) / 10;
