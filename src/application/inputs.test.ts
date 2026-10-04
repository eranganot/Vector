import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import { parseInput } from "./inputs";

const U = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";
const bad = (fn: () => unknown, msg: RegExp) => {
  expect(fn).toThrow(DomainError);
  expect(fn).toThrow(msg);
};

describe("input validation at the action boundary", () => {
  it("accepts well-formed input and trims notes", () => {
    expect(parseInput("acceptDecision", { insightId: U, decisionId: U, rationale: "  ok " })).toEqual({
      insightId: U,
      decisionId: U,
      rationale: "ok",
    });
    expect(parseInput("advanceClock", { hours: "24" })).toEqual({ hours: 24 });
  });
  it("rejects ids that are not ids (and so paths built from them)", () =>
    bad(() => parseInput("acceptDecision", { insightId: "../admin", decisionId: U }), /insightId/));
  it("requires a reason to decline and a lesson to review", () => {
    bad(() => parseInput("declineDecision", { insightId: U, decisionId: U, rationale: "   " }), /reason is required/);
    bad(() => parseInput("reviewOutcome", { insightId: U, outcomeId: U }), /lesson/);
  });
  it("only allows grant or deny as a verdict", () =>
    bad(() => parseInput("approve", { actionId: U, verdict: "auto" }), /verdict/));
  it("bounds the demo clock", () => {
    bad(() => parseInput("advanceClock", { hours: "0" }), /hours/);
    bad(() => parseInput("advanceClock", { hours: "1000" }), /hours/);
  });
  it("blocks open redirects in the persona switcher", () => {
    for (const next of ["https://evil.example", "//evil.example", "javascript:alert(1)", "evil"])
      bad(() => parseInput("switchPersona", { email: "dana@vector-retail.example", next }), /path inside VECTOR/);
    expect(parseInput("switchPersona", { email: "dana@vector-retail.example", next: "/units/abc" }).next).toBe(
      "/units/abc",
    );
  });
  it("caps note length", () =>
    bad(() => parseInput("approve", { actionId: U, verdict: "grant", rationale: "x".repeat(2001) }), /2,000/));
});
