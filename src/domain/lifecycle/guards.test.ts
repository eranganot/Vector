import { describe, expect, it } from "vitest";
import {
  approvalRequestExpired,
  approvalUsableForExecution,
  approvalValidUntil,
  assertCanRetry,
  assertSeparationOfDuties,
  autoDecideAllowed,
  outcomeVerdict,
  requireRationale,
} from "./guards";

const t0 = new Date("2026-10-22T05:00:00Z");
const hours = (h: number) => new Date(t0.getTime() + h * 3_600_000);

describe("guards", () => {
  it("requires a rationale", () => {
    expect(() => requireRationale("  ", "Deny")).toThrow(/rationale/);
    expect(requireRationale("stock needed", "Deny")).toBe("stock needed");
  });

  it("enforces separation of duties (AZ-2)", () => {
    expect(() => assertSeparationOfDuties("u1", "u1", "u2")).toThrow(/proposed/);
    expect(() => assertSeparationOfDuties("u1", "system:detector", "u1")).toThrow(/own/);
    expect(() => assertSeparationOfDuties("u1", "system:detector", "u2")).not.toThrow();
  });

  it("expires approval requests after 72 h and never earlier", () => {
    expect(approvalRequestExpired(t0, hours(72))).toBe(false);
    expect(approvalRequestExpired(t0, hours(72.01))).toBe(true);
  });

  describe("approval usable for execution (A7)", () => {
    const granted = { status: "granted", actionRevision: 2, validUntil: approvalValidUntil(t0) };
    it("accepts a granted, current, unexpired approval", () =>
      expect(approvalUsableForExecution(granted, 2, hours(1)).ok).toBe(true));
    it("rejects a missing approval", () => expect(approvalUsableForExecution(undefined, 2, hours(1)).ok).toBe(false));
    it("rejects an approval of an earlier action revision", () =>
      expect(approvalUsableForExecution(granted, 3, hours(1)).ok).toBe(false));
    it("rejects a lapsed approval", () =>
      expect(approvalUsableForExecution(granted, 2, hours(7 * 24 + 1)).ok).toBe(false));
    it("rejects a requested (unanswered) approval", () =>
      expect(approvalUsableForExecution({ ...granted, status: "requested" }, 2, hours(1)).ok).toBe(false));
  });

  it("limits retries to 3 attempts", () => {
    expect(() => assertCanRetry(2)).not.toThrow();
    expect(() => assertCanRetry(3)).toThrow(/limit/);
  });

  it("computes outcome verdicts", () => {
    const base = { baselineMean: 89, expectedDirection: "up" as const, threshold: 5, coverage: 1 };
    expect(outcomeVerdict({ ...base, windowMean: 96 })).toBe("worked");
    expect(outcomeVerdict({ ...base, windowMean: 92 })).toBe("partially_worked");
    expect(outcomeVerdict({ ...base, windowMean: 90 })).toBe("did_not_work");
    expect(outcomeVerdict({ ...base, windowMean: 96, coverage: 0.7 })).toBe("inconclusive");
  });

  it("allows automatic decisions only for P3/P4 notify-only recommendations (AD-1)", () => {
    expect(autoDecideAllowed("P3", ["notify_owner"], false)).toBe(true);
    expect(autoDecideAllowed("P2", ["notify_owner"], false)).toBe(false);
    expect(autoDecideAllowed("P4", ["inventory_transfer"], false)).toBe(false);
    expect(autoDecideAllowed("P4", ["notify_owner"], true)).toBe(false);
  });
});
