/**
 * Priority model v1 calibration (Phase 1). Computes scores for the hand-written scenario set and
 * finds band thresholds that reproduce the expected bands. The formula here moves into
 * src/domain/priority in Phase 2 unchanged, with these scenarios as golden fixtures.
 *   pnpm tsx scripts/calibrate-priority.ts
 */
import { readFileSync } from "node:fs";

type Breadth = "isolated" | "local" | "regional" | "systemic";
type Scenario = {
  id: string;
  title: string;
  z: number;
  impactIls: number;
  breadth: Breadth;
  hoursToImpact: number | null; // null = already happening
  strategicWeight: number;
  confidence: number;
  expected: "P1" | "P2" | "P3" | "P4";
};

export const WEIGHTS_V1 = { magnitude: 0.2, impact: 0.3, breadth: 0.15, urgency: 0.2, strategic: 0.15 } as const;

const IMPACT_FLOOR = 5_000; // ₪/week below which impact ≈ 0
const IMPACT_CEIL = 1_000_000; // ₪/week at which impact = 1

export function factors(s: Omit<Scenario, "id" | "title" | "expected">) {
  const magnitude = Math.min(Math.abs(s.z), 4) / 4;
  const impact = Math.min(
    1,
    Math.max(0, Math.log10(s.impactIls / IMPACT_FLOOR) / Math.log10(IMPACT_CEIL / IMPACT_FLOOR)),
  );
  const breadth = { isolated: 0.25, local: 0.5, regional: 0.75, systemic: 1 }[s.breadth];
  const h = s.hoursToImpact;
  const urgency = h === null ? 0.75 : h <= 24 ? 1 : h <= 72 ? 0.75 : h <= 168 ? 0.5 : h <= 720 ? 0.25 : 0.1;
  return { magnitude, impact, breadth, urgency, strategic: s.strategicWeight };
}

export function score(s: Omit<Scenario, "id" | "title" | "expected">) {
  const f = factors(s);
  const weighted =
    WEIGHTS_V1.magnitude * f.magnitude +
    WEIGHTS_V1.impact * f.impact +
    WEIGHTS_V1.breadth * f.breadth +
    WEIGHTS_V1.urgency * f.urgency +
    WEIGHTS_V1.strategic * f.strategic;
  return { factors: f, score: Math.round(100 * weighted * (0.6 + 0.4 * s.confidence) * 10) / 10 };
}

function main() {
  const { scenarios } = JSON.parse(readFileSync("docs/specs/priority-scenarios.json", "utf8")) as {
    scenarios: Scenario[];
  };
  const rows = scenarios.map((s) => ({ ...s, ...score(s) })).sort((a, b) => b.score - a.score);
  console.log("id   score  expected  magnitude impact breadth urgency strategic  title");
  for (const r of rows) {
    const f = r.factors;
    console.log(
      `${r.id}  ${r.score.toFixed(1).padStart(5)}  ${r.expected}        ${[
        f.magnitude,
        f.impact,
        f.breadth,
        f.urgency,
        f.strategic,
      ]
        .map((v) => v.toFixed(2).padStart(6))
        .join("   ")}  ${r.title}`,
    );
  }
  // Thresholds: midpoint between the lowest score of band k and the highest score of band k+1.
  const order = ["P1", "P2", "P3", "P4"] as const;
  const cuts: Record<string, number> = {};
  let ok = true;
  for (let i = 0; i < 3; i++) {
    const hi = rows.filter((r) => r.expected === order[i]).map((r) => r.score);
    const lo = rows.filter((r) => r.expected === order[i + 1]).map((r) => r.score);
    const minHi = Math.min(...hi);
    const maxLo = Math.max(...lo);
    if (minHi <= maxLo) ok = false;
    cuts[order[i]] = Math.round(((minHi + maxLo) / 2) * 10) / 10;
    console.log(
      `${order[i]}/${order[i + 1]}: lowest ${order[i]}=${minHi}, highest ${order[i + 1]}=${maxLo}, cut=${cuts[order[i]]}${minHi <= maxLo ? "  OVERLAP" : ""}`,
    );
  }
  console.log(ok ? "\nAll expected bands separable." : "\nBands overlap: revise weights or expectations.");
}

if (process.argv[1]?.endsWith("calibrate-priority.ts")) main();
