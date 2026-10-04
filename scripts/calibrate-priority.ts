/**
 * Prints the calibration for every model (docs/specs/priority.md): organizational risk priority,
 * scope-relative local priority, and the opportunity model, with each scenario's expected band.
 *   pnpm exec tsx scripts/calibrate-priority.ts
 */
import { readFileSync } from "node:fs";
import {
  BANDS,
  computeLocalPriority,
  computeOpportunity,
  computePriority,
  OPPORTUNITY_BANDS,
} from "../src/domain/priority";

const d = JSON.parse(readFileSync("docs/specs/priority-scenarios.json", "utf8"));
const f2 = (x: number) => x.toFixed(2).padStart(5);
let ok = true;

console.log(`RISKS · priority-v2 · P1 ≥ ${BANDS.P1}, P2 ≥ ${BANDS.P2}, P3 ≥ ${BANDS.P3}`);
console.log("id    score band exp | mag   imp   brd   urg   str   cmp  | title");
for (const s of [...d.risks].sort((a, b) => computePriority(b).score - computePriority(a).score)) {
  const p = computePriority(s);
  const f = p.factors;
  if (p.band !== s.expected) ok = false;
  console.log(
    `${s.id.padEnd(5)} ${String(p.score).padStart(5)} ${p.band}   ${s.expected}  | ${[f.magnitude, f.impact, f.breadth, f.urgency, f.strategic, f.compliance].map(f2).join(" ")} | ${s.title}`,
  );
}
console.log("\nLOCAL · priority-v2-local (viewer's own scope)");
for (const s of d.risks.filter((x: { local?: unknown }) => x.local)) {
  const p = computeLocalPriority(s, s.local);
  if (p.band !== s.local.expected) ok = false;
  console.log(
    `${s.id.padEnd(5)} ${s.local.scope.padEnd(7)} ${String(p.score).padStart(5)} ${p.band} exp ${s.local.expected} (org ${computePriority(s).band})`,
  );
}
console.log(`\nOPPORTUNITIES · opportunity-v1 · O1 ≥ ${OPPORTUNITY_BANDS.O1}, O2 ≥ ${OPPORTUNITY_BANDS.O2}`);
for (const o of d.opportunities) {
  const p = computeOpportunity(o);
  if (p.band !== o.expected) ok = false;
  console.log(
    `${o.id.padEnd(5)} ${String(p.score).padStart(5)} ${p.band} exp ${o.expected} | ${Object.values(p.factors)
      .map((v) => f2(v as number))
      .join(" ")} | ${o.title}`,
  );
}
console.log(
  ok ? "\nAll scenarios land in their expected band." : "\nMISMATCH: some scenarios land outside their expected band.",
);
process.exit(ok ? 0 : 1);
