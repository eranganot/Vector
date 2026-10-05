/**
 * Commitments, dependencies and conflicts (Phase 4, docs/specs/domain-model.md §2, §4.6, §4.7). Pure functions:
 * dependency status is derived from the commitment and the clock (Q4), cascades follow the dependency chain,
 * conflict rules are explicit resource/effect pairs, and the monitor's priority inputs are deterministic.
 */
import type { Breadth, PriorityInput } from "./priority";

export const CONFLICT_RULES_VERSION = "conflict-rules-v1";
export const COMMITMENT_MONITOR_VERSION = "commitment-monitor-v1";

export const EFFECTS = ["promote", "delist", "spend", "freeze_spend", "cutover", "peak_trading"] as const;
export type Effect = (typeof EFFECTS)[number];

/** A commitment's effect on a named resource during a window (e.g. promote sku-set:coast-14, 1–3 Nov). */
export type CommitmentEffect = { resource: string; effect: Effect; windowStart: string; windowEnd: string };

export type CommitmentStatus = "open" | "overdue" | "done" | "cancelled";

export type CommitmentFacts = {
  id: string;
  title: string;
  ownerUnitId: string;
  dueAt: Date;
  completedAt: Date | null;
  status: CommitmentStatus;
  impactIls: number;
  compliance: number;
  effects: CommitmentEffect[];
  createdAt: Date;
};

export type DependencyFacts = {
  id: string;
  commitmentId: string;
  downstreamUnitId: string;
  downstreamCommitmentId: string | null;
  needBy: Date;
  impactIls: number;
};

export type DependencyStatus = "met" | "waiting" | "at_risk" | "blocked" | "cancelled";

/** Opposing effects (conflict-rules-v1). Symmetric. */
const OPPOSING: [Effect, Effect][] = [
  ["promote", "delist"],
  ["spend", "freeze_spend"],
  ["cutover", "peak_trading"],
];
export const opposes = (a: Effect, b: Effect) =>
  OPPOSING.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** In force for conflicts: open, overdue, or done (a delivered plan still applies over its window). Not cancelled. */
const inForce = (c: Pick<CommitmentFacts, "status">) => c.status !== "cancelled";

/**
 * Q4: a dependency's status comes from its commitment and the clock, never from a stored field.
 * met: delivered by the need-by date (or delivered late, once the need is past, it still counts as met late → "met").
 */
export function dependencyStatus(
  d: Pick<DependencyFacts, "needBy">,
  c: Pick<CommitmentFacts, "status" | "dueAt" | "completedAt">,
  now: Date,
): DependencyStatus {
  if (c.status === "done") return "met";
  if (c.status === "cancelled") return "cancelled";
  if (now.getTime() > d.needBy.getTime()) return "blocked";
  if (c.status === "overdue" || c.dueAt.getTime() > d.needBy.getTime()) return "at_risk";
  return "waiting";
}

export type Overlap = { resource: string; effects: [Effect, Effect]; start: string; end: string };

/** conflict-rules-v1: different owner units, same resource, overlapping windows, opposing effects; neither cancelled. */
export function conflictBetween(a: CommitmentFacts, b: CommitmentFacts): Overlap | null {
  if (a.id === b.id || a.ownerUnitId === b.ownerUnitId || !inForce(a) || !inForce(b)) return null;
  for (const ea of a.effects)
    for (const eb of b.effects) {
      if (ea.resource !== eb.resource || !opposes(ea.effect, eb.effect)) continue;
      const start = ea.windowStart > eb.windowStart ? ea.windowStart : eb.windowStart;
      const end = ea.windowEnd < eb.windowEnd ? ea.windowEnd : eb.windowEnd;
      if (start <= end) return { resource: ea.resource, effects: [ea.effect, eb.effect], start, end };
    }
  return null;
}

/** Q1: the conflict is decided by the owner of the commitment recorded second (it introduced the conflict). */
export const introducedBy = (a: CommitmentFacts, b: CommitmentFacts) =>
  a.createdAt.getTime() > b.createdAt.getTime() ? a : b;

/**
 * Cascade: commitments put at risk, directly or through a chain of dependencies, by a late commitment.
 * A downstream commitment is at risk when a dependency it relies on is at risk or blocked.
 */
export function cascade(
  rootId: string,
  commitments: CommitmentFacts[],
  deps: DependencyFacts[],
  now: Date,
): { commitmentIds: string[]; dependencyIds: string[]; unitIds: string[] } {
  const byId = new Map(commitments.map((c) => [c.id, c]));
  const seen = new Set<string>([rootId]);
  const depIds = new Set<string>();
  const units = new Set<string>();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    const c = byId.get(id);
    if (!c) continue;
    for (const d of deps.filter((x) => x.commitmentId === id)) {
      const st = dependencyStatus(d, c, now);
      // Through the root itself every dependency is affected; further down only those already in trouble.
      if (id !== rootId && st !== "at_risk" && st !== "blocked") continue;
      depIds.add(d.id);
      units.add(d.downstreamUnitId);
      if (d.downstreamCommitmentId && !seen.has(d.downstreamCommitmentId)) {
        seen.add(d.downstreamCommitmentId);
        queue.push(d.downstreamCommitmentId);
      }
    }
  }
  seen.delete(rootId);
  return { commitmentIds: [...seen], dependencyIds: [...depIds], unitIds: [...units] };
}

export type Bottleneck = { unitId: string; blocked: number; atRisk: number; impactIls: number };

/** Units others are blocked or at risk on, worst first (weighted by ₪ impact of the waiting dependencies). */
export function bottlenecks(commitments: CommitmentFacts[], deps: DependencyFacts[], now: Date): Bottleneck[] {
  const byId = new Map(commitments.map((c) => [c.id, c]));
  const by = new Map<string, Bottleneck>();
  for (const d of deps) {
    const c = byId.get(d.commitmentId);
    if (!c) continue;
    const st = dependencyStatus(d, c, now);
    if (st !== "at_risk" && st !== "blocked") continue;
    const b = by.get(c.ownerUnitId) ?? { unitId: c.ownerUnitId, blocked: 0, atRisk: 0, impactIls: 0 };
    if (st === "blocked") b.blocked++;
    else b.atRisk++;
    b.impactIls += d.impactIls;
    by.set(c.ownerUnitId, b);
  }
  return [...by.values()].sort((a, b) => b.impactIls - a.impactIls || b.blocked - a.blocked);
}

/** Share of commitments due so far that were delivered by their due date (null when none was due yet). */
export function onTimeRate(commitments: CommitmentFacts[], now: Date): number | null {
  const due = commitments.filter((c) => c.status !== "cancelled" && c.dueAt.getTime() <= now.getTime());
  if (due.length === 0) return null;
  const onTime = due.filter(
    (c) => c.status === "done" && c.completedAt && c.completedAt.getTime() <= c.dueAt.getTime(),
  );
  return onTime.length / due.length;
}

/** Q2: overdue becomes an insight only with dependents, ≥ ₪10k/week at stake, or compliance ≥ 0.6. */
export const ESCALATION = { minImpactIls: 10_000, minCompliance: 0.6 } as const;
export const shouldEscalate = (c: Pick<CommitmentFacts, "impactIls" | "compliance">, dependents: number) =>
  dependents > 0 || c.impactIls >= ESCALATION.minImpactIls || c.compliance >= ESCALATION.minCompliance;

const breadthOf = (units: number): Breadth =>
  units >= 10 ? "systemic" : units >= 4 ? "regional" : units >= 2 ? "local" : "isolated";

const HOUR = 3_600_000;

/** Priority inputs for an overdue commitment (commitment-monitor-v1; priority-v2 scores them). */
export function overduePriority(
  c: CommitmentFacts,
  dependents: { needBy: Date; impactIls: number; unitId: string }[],
  affectedUnits: number,
  now: Date,
): PriorityInput {
  const daysOverdue = Math.max(0, (now.getTime() - c.dueAt.getTime()) / (24 * HOUR));
  const open = dependents.map((d) => d.needBy.getTime());
  const hoursToImpact = open.length
    ? Math.round((Math.min(...open) - now.getTime()) / HOUR)
    : -Math.round(daysOverdue * 24);
  return {
    z: Math.min(4, Math.round((1 + daysOverdue * 0.5) * 10) / 10),
    impactIls: Math.max(
      c.impactIls,
      dependents.reduce((a, d) => a + d.impactIls, 0),
    ),
    breadth: breadthOf(affectedUnits),
    hoursToImpact,
    strategicWeight: 0.6,
    compliance: c.compliance,
    confidence: 0.95,
  };
}

/** Priority inputs for a conflict between two commitments (conflict-rules-v1). */
export function conflictPriority(
  a: CommitmentFacts,
  b: CommitmentFacts,
  overlap: Overlap,
  affectedUnits: number,
  now: Date,
): PriorityInput {
  const start = new Date(`${overlap.start}T00:00:00Z`).getTime();
  return {
    z: 2,
    impactIls: Math.max(a.impactIls, b.impactIls),
    breadth: breadthOf(affectedUnits),
    hoursToImpact: Math.round((start - now.getTime()) / HOUR),
    strategicWeight: 0.6,
    compliance: Math.max(a.compliance, b.compliance),
    confidence: 0.9,
  };
}

const EFFECT_WORDS: Record<Effect, string> = {
  promote: "promotes",
  delist: "delists",
  spend: "spends from",
  freeze_spend: "freezes",
  cutover: "cuts over",
  peak_trading: "runs peak trading on",
};
export const describeEffect = (e: Effect) => EFFECT_WORDS[e];

/**
 * Q1 (Eran, 2026-10-05: options 1 + 5 + 2): the unit that recorded second decides, the other owner confirms, and an
 * undecided conflict escalates to the two units' common manager 48 h after it was detected, or 2 days before the
 * overlap starts, whichever comes first.
 */
export const CONFLICT_ESCALATION = { afterHours: 48, beforeOverlapHours: 48 } as const;

export function conflictEscalationDue(detectedAt: Date, overlapStart: string, now: Date): boolean {
  const sinceDetected = (now.getTime() - detectedAt.getTime()) / HOUR;
  const toOverlap = (new Date(`${overlapStart}T00:00:00Z`).getTime() - now.getTime()) / HOUR;
  return sinceDetected >= CONFLICT_ESCALATION.afterHours || toOverlap <= CONFLICT_ESCALATION.beforeOverlapHours;
}

/** The lowest unit both paths share (root first): the common manager's unit. */
export function commonAncestor(pathA: string[], pathB: string[]): string | null {
  let last: string | null = null;
  for (let i = 0; i < Math.min(pathA.length, pathB.length); i++) {
    if (pathA[i] !== pathB[i]) break;
    last = pathA[i];
  }
  return last;
}
