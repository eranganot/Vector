import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeOpportunity, computePriority } from "@/domain/priority";
import { CATALOG } from "./catalog";
import { UNITS, USERS } from "./org";

const fixtures = JSON.parse(readFileSync("docs/specs/priority-scenarios.json", "utf8"));

describe("scenario catalog (seeded insights)", () => {
  it("covers every catalog scenario except R8, which the live detector finds", () => {
    expect(CATALOG.map((c) => c.id)).toEqual([
      ...["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R9", "R10", "R11", "R12", "R13", "R14"],
      ...["O1", "O2", "O3", "O4", "O5"],
    ]);
  });

  it.each(CATALOG.map((c) => [c.id, c] as const))(
    "%s uses the calibrated fixture inputs and lands in its band",
    (_id, c) => {
      if (c.workstream === "risk") {
        const f = fixtures.risks.find((x: { id: string }) => x.id === c.fixture);
        for (const k of ["z", "impactIls", "breadth", "hoursToImpact", "strategicWeight", "compliance", "confidence"])
          expect(c[k as keyof typeof c], `${c.id}.${k}`).toEqual(f[k]);
        expect(computePriority(c).band).toBe(f.expected);
      } else {
        const f = fixtures.opportunities.find((x: { id: string }) => x.id === c.fixture);
        for (const k of ["valueIls", "costIls", "reach", "hoursToClose", "strategicFit", "confidence"])
          expect(c[k as keyof typeof c], `${c.id}.${k}`).toEqual(f[k]);
        expect(computeOpportunity(c).band).toBe(f.expected);
      }
    },
  );

  it("references only seeded units and people", () => {
    const codes = new Set(UNITS.map((u) => u.code));
    const people = new Set(USERS.map((u) => u.key));
    for (const c of CATALOG) {
      for (const code of [c.primary, c.owner, ...c.affected, ...c.recommendation.actions.flatMap((a) => a.targets)])
        expect(codes.has(code), `${c.id}: unit ${code}`).toBe(true);
      for (const a of c.recommendation.actions) expect(people.has(a.owner), `${c.id}: ${a.owner}`).toBe(true);
      expect(UNITS.find((u) => u.code === c.owner)?.type).toBe("department");
    }
  });

  it("every department owns at least one scenario", () => {
    const owners = new Set([...CATALOG.map((c) => c.owner), "D-STORE"]); // R8 (live) is Store Operations
    expect(UNITS.filter((u) => u.type === "department").every((d) => owners.has(d.code))).toBe(true);
  });
});
