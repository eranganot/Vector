import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computePriority, type PriorityInput } from "./priority";

type Scenario = PriorityInput & { id: string; expected: string };
const { scenarios } = JSON.parse(readFileSync("docs/specs/priority-scenarios.json", "utf8")) as {
  scenarios: Scenario[];
};

// Golden scores from the approved calibration (docs/specs/priority.md).
const GOLDEN: Record<string, number> = {
  S01: 60.2,
  S02: 79.3,
  S03: 28.1,
  S04: 85.4,
  S05: 52.7,
  S06: 76.1,
  S07: 44.8,
  S08: 58.1,
  S09: 52.5,
  S10: 33.7,
  S11: 62.5,
  S12: 88.5,
  S13: 58.7,
  S14: 67.7,
  S15: 63.0,
};

describe("priority-v1 golden fixtures", () => {
  it.each(scenarios.map((s) => [s.id, s] as const))("%s keeps its calibrated score and band", (id, s) => {
    const p = computePriority(s);
    expect(p.score).toBe(GOLDEN[id]);
    expect(p.band).toBe(s.expected);
  });

  it("is reproducible and records its versions", () => {
    const a = computePriority(scenarios[0]);
    expect(computePriority(scenarios[0])).toEqual(a);
    expect(a.model).toBe("priority-v1");
    expect(a.weightsVersion).toBe("weights-v1");
  });

  it("treats overdue as maximally urgent", () => {
    expect(computePriority({ ...scenarios[0], hoursToImpact: -5 }).factors.urgency).toBe(1);
  });
});
