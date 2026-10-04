import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeLocalPriority,
  effectiveLocal,
  explainPriority,
  computeOpportunity,
  computePriority,
  type LocalScope,
  type OpportunityInput,
  type PriorityInput,
} from "./priority";

type Risk = PriorityInput & { id: string; expected: string; local?: LocalScope & { expected: string } };
type Opp = OpportunityInput & { id: string; expected: string };
const data = JSON.parse(readFileSync("docs/specs/priority-scenarios.json", "utf8")) as {
  risks: Risk[];
  opportunities: Opp[];
};

// Golden scores from the 2026-10-04 v2 calibration (docs/specs/priority.md).
const RISK: Record<string, number> = {
  S01: 57.8,
  S02: 72.3,
  S03: 30.3,
  S04: 77,
  S05: 46.2,
  S06: 68.7,
  S07: 43.9,
  S09: 48.5,
  S10: 32.1,
  S11: 59.4,
  S12: 91.7,
  S13: 54.1,
  S14: 64.8,
  S15: 59.4,
};
const LOCAL: Record<string, number> = { S01: 72.7, S03: 39.1, S05: 52.3, S09: 60.4, S10: 40.2 };
const OPP: Record<string, number> = { OP1: 64, OP2: 45.7, OP3: 48, OP4: 55.5, OP5: 19.5 };

describe("priority-v2 (risks) golden fixtures", () => {
  it.each(data.risks.map((s) => [s.id, s] as const))("%s keeps its calibrated score and band", (id, s) => {
    const p = computePriority(s);
    expect(p.score).toBe(RISK[id]);
    expect(p.band).toBe(s.expected);
  });
  it("is reproducible and records its versions", () => {
    const a = computePriority(data.risks[0]);
    expect(computePriority(data.risks[0])).toEqual(a);
    expect([a.model, a.weightsVersion]).toEqual(["priority-v2", "weights-v2"]);
  });
  it("treats overdue as maximally urgent", () =>
    expect(computePriority({ ...data.risks[0], hoursToImpact: -5 }).factors.urgency).toBe(1));
  it("R5 wage rule (S14) stays P2 even with its compliance exposure (Eran, 2026-10-04)", () =>
    expect(computePriority(data.risks.find((s) => s.id === "S14")!).band).toBe("P2"));
});

describe("priority-v2.1-local (scope-relative)", () => {
  const withLocal = data.risks.filter((s) => s.local);
  it.each(withLocal.map((s) => [s.id, s] as const))("%s local score and band", (id, s) => {
    const p = computeLocalPriority(s, s.local!);
    expect(p.score).toBe(LOCAL[id]);
    expect(p.band).toBe(s.local!.expected);
  });
  it("S09 shrinkage is P3 for the group but higher (P2) for the store manager", () => {
    const s = data.risks.find((x) => x.id === "S09")!;
    expect(computePriority(s).band).toBe("P3");
    expect(computeLocalPriority(s, s.local!).band).toBe("P2");
  });
  it("S05 labor overrun is P3 for the group but P2 for the region manager (Eran, 2026-10-04)", () => {
    const s = data.risks.find((x) => x.id === "S05")!;
    expect(computePriority(s).band).toBe("P3");
    expect(computeLocalPriority(s, s.local!).band).toBe("P2");
  });
  it("local priority raises an item for its scope but never lowers it below the organizational band", () => {
    const s = data.risks.find((x) => x.id === "S04")!; // group-wide P1
    const org = computePriority(s);
    const small = computeLocalPriority(s, {
      scope: "region",
      scopeWeeklySalesIls: 50_000_000,
      shareOfScopeAffected: 1,
    });
    expect(small.score).toBeLessThan(org.score);
    expect(effectiveLocal(org, small)).toBeNull();
    const r = data.risks.find((x) => x.id === "S09")!;
    expect(effectiveLocal(computePriority(r), computeLocalPriority(r, r.local!))?.band).toBe("P2");
  });
  it("a cost overrun is measured against its budget line only when one is given", () => {
    const s = data.risks.find((x) => x.id === "S05")!;
    const salesOnly = { ...s.local!, costLineBudgetIls: undefined };
    expect(computeLocalPriority(s, salesOnly).score).toBe(40.3);
    expect(computeLocalPriority({ ...s, costLine: undefined }, s.local!).score).toBe(40.3);
  });
});

describe("opportunity-v1 golden fixtures (separate workstream)", () => {
  it.each(data.opportunities.map((o) => [o.id, o] as const))("%s keeps its calibrated score and band", (id, o) => {
    const p = computeOpportunity(o);
    expect(p.score).toBe(OPP[id]);
    expect(p.band).toBe(o.expected);
  });
});

describe("explainPriority (the one-line 'why' on every card, Phase 3)", () => {
  const risk = (over: Partial<PriorityInput>): PriorityInput => ({
    z: -4,
    impactIls: 40_000,
    breadth: "isolated",
    hoursToImpact: 12,
    strategicWeight: 0.8,
    compliance: 0,
    confidence: 0.9,
    ...over,
  });

  it("names at most three reasons, strongest first, and never 'strategic'", () => {
    const line = explainPriority(computePriority(risk({})));
    expect(line.split(" · ").length).toBeLessThanOrEqual(3);
    expect(line).not.toMatch(/strategic|core KPI/);
    expect(line).toMatch(/σ from usual/);
  });

  it("always names a material regulatory or legal exposure first", () => {
    const line = explainPriority(computePriority(risk({ compliance: 1, impactIls: 2_000_000, breadth: "systemic" })));
    expect(line.split(" · ")[0]).toBe("regulator-mandated");
    expect(explainPriority(computePriority(risk({ compliance: 0.8 })))).toMatch(/^legal deadline/);
  });

  it("does not lead with compliance below the policy threshold (0.6)", () => {
    const line = explainPriority(computePriority(risk({ compliance: 0.3, impactIls: 900_000, breadth: "regional" })));
    expect(line.split(" · ")[0]).not.toBe("contract terms at stake");
  });

  it("explains opportunities by upside, window and cost to capture", () => {
    const line = explainPriority(
      computeOpportunity({
        valueIls: 150_000,
        costIls: 20_000,
        reach: "isolated",
        hoursToClose: 72,
        strategicFit: 0.5,
        confidence: 0.9,
      }),
    );
    expect(line).toMatch(/\/week upside/);
    expect(line.split(" · ").length).toBeLessThanOrEqual(3);
  });

  it("is deterministic", () => {
    const b = computePriority(risk({ compliance: 0.6 }));
    expect(explainPriority(b)).toBe(explainPriority(b));
  });
});
