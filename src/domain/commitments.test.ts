import { describe, expect, it } from "vitest";
import {
  bottlenecks,
  cascade,
  type CommitmentFacts,
  conflictBetween,
  type DependencyFacts,
  dependencyStatus,
  introducedBy,
  onTimeRate,
  opposes,
  overduePriority,
  shouldEscalate,
} from "./commitments";
import { transition } from "./lifecycle/machines";
import { computePriority } from "./priority";

const T = (s: string) => new Date(`${s}Z`);
const now = T("2026-10-22T05:00:00");

const c = (over: Partial<CommitmentFacts> & { id: string }): CommitmentFacts => ({
  title: over.id,
  ownerUnitId: "u-mkt",
  dueAt: T("2026-10-25T12:00:00"),
  completedAt: null,
  status: "open",
  impactIls: 0,
  compliance: 0,
  effects: [],
  createdAt: T("2026-10-15T09:00:00"),
  ...over,
});
const d = (over: Partial<DependencyFacts> & { id: string; commitmentId: string }): DependencyFacts => ({
  downstreamUnitId: "u-store",
  downstreamCommitmentId: null,
  needBy: T("2026-10-26T00:00:00"),
  impactIls: 10_000,
  ...over,
});

describe("commitment state machine (C1–C6)", () => {
  it.each([
    [null, "record", "open", "C1"],
    ["open", "complete", "done", "C2"],
    ["open", "mark_overdue", "overdue", "C3"],
    ["overdue", "complete", "done", "C4"],
    ["open", "renegotiate", "open", "C5"],
    ["overdue", "renegotiate", "open", "C5"],
    ["open", "cancel", "cancelled", "C6"],
    ["overdue", "cancel", "cancelled", "C6"],
  ] as const)("%s --%s--> %s (%s)", (from, cmd, to, row) => {
    expect(transition("commitment", from, cmd)).toEqual({ to, rowId: row });
  });
  it.each([
    ["done", "complete"],
    ["done", "renegotiate"],
    ["cancelled", "complete"],
    ["overdue", "mark_overdue"],
    ["done", "mark_overdue"],
  ] as const)("refuses %s --%s-->", (from, cmd) => {
    expect(() => transition("commitment", from, cmd)).toThrow(/IllegalTransition|not allowed|illegal/i);
  });
  it("conflicts open then resolve once (K1, K2)", () => {
    expect(transition("conflict", null, "detect")).toEqual({ to: "open", rowId: "K1" });
    expect(transition("conflict", "open", "resolve")).toEqual({ to: "resolved", rowId: "K2" });
    expect(() => transition("conflict", "resolved", "resolve")).toThrow();
  });
});

describe("dependency status is derived (Q4)", () => {
  const dep = d({ id: "d", commitmentId: "c" });
  it("waiting while the promise can still land before it is needed", () =>
    expect(dependencyStatus(dep, c({ id: "c" }), now)).toBe("waiting"));
  it("at risk when the promise is overdue, or due after it is needed", () => {
    expect(dependencyStatus(dep, c({ id: "c", status: "overdue" }), now)).toBe("at_risk");
    expect(dependencyStatus(dep, c({ id: "c", dueAt: T("2026-10-27T00:00:00") }), now)).toBe("at_risk");
  });
  it("blocked once the need-by date passes undelivered", () =>
    expect(dependencyStatus(dep, c({ id: "c", status: "overdue" }), T("2026-10-26T01:00:00"))).toBe("blocked"));
  it("met when delivered; cancelled when the promise is withdrawn", () => {
    expect(dependencyStatus(dep, c({ id: "c", status: "done", completedAt: now }), now)).toBe("met");
    expect(dependencyStatus(dep, c({ id: "c", status: "cancelled" }), now)).toBe("cancelled");
  });
});

describe("conflict-rules-v1", () => {
  const promo = c({
    id: "promo",
    ownerUnitId: "u-mkt",
    createdAt: T("2026-10-22T04:00:00"),
    effects: [
      { resource: "sku-set:south-dairy-6", effect: "promote", windowStart: "2026-10-31", windowEnd: "2026-11-02" },
    ],
  });
  const delist = c({
    id: "delist",
    ownerUnitId: "u-trade",
    effects: [
      { resource: "sku-set:south-dairy-6", effect: "delist", windowStart: "2026-10-30", windowEnd: "2026-12-31" },
    ],
  });
  it("finds the overlap of opposing effects on the same resource", () => {
    expect(conflictBetween(promo, delist)).toEqual({
      resource: "sku-set:south-dairy-6",
      effects: ["promote", "delist"],
      start: "2026-10-31",
      end: "2026-11-02",
    });
  });
  it("is symmetric on the opposing pairs", () => {
    for (const [a, b] of [
      ["promote", "delist"],
      ["spend", "freeze_spend"],
      ["cutover", "peak_trading"],
    ] as const) {
      expect(opposes(a, b)).toBe(true);
      expect(opposes(b, a)).toBe(true);
    }
    expect(opposes("promote", "spend")).toBe(false);
  });
  it("no conflict without overlap, on another resource, within one owner unit, or once one side is cancelled", () => {
    const later = { ...promo, effects: [{ ...promo.effects[0], windowStart: "2026-10-20", windowEnd: "2026-10-29" }] };
    expect(conflictBetween(later, delist)).toBeNull();
    const other = { ...promo, effects: [{ ...promo.effects[0], resource: "sku-set:coast-14" }] };
    expect(conflictBetween(other, delist)).toBeNull();
    expect(conflictBetween({ ...promo, ownerUnitId: "u-trade" }, delist)).toBeNull();
    expect(conflictBetween({ ...promo, status: "cancelled" }, delist)).toBeNull();
    // A delivered plan is still in force over its window (Finance's freeze is "done" and still blocks spending).
    expect(conflictBetween({ ...promo, status: "done" }, delist)).not.toBeNull();
  });
  it("Q1: the commitment recorded second introduced the conflict", () => {
    expect(introducedBy(promo, delist).id).toBe("promo");
    expect(introducedBy(delist, promo).id).toBe("promo");
  });
});

describe("cascade and bottlenecks", () => {
  // signage (Marketing) → launch (Store Ops) → regional execution (North)
  const signage = c({ id: "signage", ownerUnitId: "u-mkt", status: "overdue", dueAt: T("2026-10-19T12:00:00") });
  const launch = c({ id: "launch", ownerUnitId: "u-store", dueAt: T("2026-10-24T08:00:00") });
  const exec = c({ id: "exec", ownerUnitId: "u-north" });
  const unrelated = c({ id: "ok", ownerUnitId: "u-it" });
  const deps = [
    d({
      id: "d1",
      commitmentId: "signage",
      downstreamUnitId: "u-store",
      downstreamCommitmentId: "launch",
      needBy: T("2026-10-23T00:00:00"),
      impactIls: 300_000,
    }),
    d({
      id: "d2",
      commitmentId: "launch",
      downstreamUnitId: "u-north",
      downstreamCommitmentId: "exec",
      needBy: T("2026-10-23T00:00:00"),
      impactIls: 50_000,
    }),
    d({ id: "d3", commitmentId: "ok", downstreamUnitId: "u-fin", impactIls: 5_000 }),
  ];
  it("a late promise puts the chain downstream at risk", () => {
    const r = cascade("signage", [signage, launch, exec, unrelated], deps, now);
    expect(r.dependencyIds).toEqual(["d1", "d2"]);
    expect(r.commitmentIds).toEqual(["launch", "exec"]);
    expect(r.unitIds).toEqual(["u-store", "u-north"]);
  });
  it("bottlenecks rank owners by the ₪ waiting on them", () => {
    const b = bottlenecks([signage, launch, exec, unrelated], deps, now);
    expect(b.map((x) => x.unitId)).toEqual(["u-mkt", "u-store"]);
    expect(b[0]).toMatchObject({ atRisk: 1, blocked: 0, impactIls: 300_000 });
  });
  it("on-time rate counts only promises already due", () => {
    const done = c({ id: "a", status: "done", dueAt: T("2026-10-18T00:00:00"), completedAt: T("2026-10-17T00:00:00") });
    expect(onTimeRate([done, signage, launch], now)).toBe(0.5);
    expect(onTimeRate([launch], now)).toBeNull();
  });
});

describe("commitment-monitor-v1 scoring", () => {
  it("Q2: escalate only with dependents, ₪10k+/week or compliance ≥ 0.6", () => {
    expect(shouldEscalate({ impactIls: 0, compliance: 0 }, 0)).toBe(false);
    expect(shouldEscalate({ impactIls: 0, compliance: 0 }, 1)).toBe(true);
    expect(shouldEscalate({ impactIls: 10_000, compliance: 0 }, 0)).toBe(true);
    expect(shouldEscalate({ impactIls: 0, compliance: 0.6 }, 0)).toBe(true);
  });
  it("an overdue promise with 60 branches waiting scores as a serious, systemic risk; deterministic", () => {
    const signage = c({ id: "s", status: "overdue", dueAt: T("2026-10-19T12:00:00"), impactIls: 300_000 });
    const input = overduePriority(
      signage,
      [{ needBy: T("2026-10-24T00:00:00"), impactIls: 300_000, unitId: "u-store" }],
      60,
      now,
    );
    expect(input).toMatchObject({ breadth: "systemic", impactIls: 300_000, hoursToImpact: 43 });
    const p = computePriority(input);
    expect(["P1", "P2"]).toContain(p.band);
    expect(
      computePriority(
        overduePriority(signage, [{ needBy: T("2026-10-24T00:00:00"), impactIls: 300_000, unitId: "u" }], 60, now),
      ),
    ).toEqual(p);
  });
  it("a small promise with nobody waiting stays low", () => {
    const small = c({ id: "x", status: "overdue", dueAt: T("2026-10-21T12:00:00"), impactIls: 12_000 });
    expect(["P3", "P4"]).toContain(computePriority(overduePriority(small, [], 1, now)).band);
  });
});
