/**
 * Priority model v1 calibration (Phase 1). Computes scores for the hand-written scenario set and
 * finds band thresholds that reproduce the expected bands. The formula lives in
 * src/domain/priority.ts; these scenarios are its golden fixtures (src/domain/priority.test.ts).
 *   pnpm tsx scripts/calibrate-priority.ts
 */
import { readFileSync } from "node:fs";
import { computePriority } from "../src/domain/priority";

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

function score(s: Omit<Scenario, "id" | "title" | "expected">) {
  const p = computePriority(s);
  return { factors: p.factors, score: p.score };
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
