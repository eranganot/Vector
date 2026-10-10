/**
 * Cross-department initiatives (plan v2, E3; cross-department.md §3): milestone state, initiative status and the
 * "management needed" rules M1–M5. Pure and deterministic; status is derived, never typed in.
 */
import { addDays, daysBetween } from "./calendar";

export const INITIATIVE_RULES_VERSION = "initiative-rules-v1";

export type MilestoneFacts = {
  id: string;
  title: string;
  ownerUnitId: string;
  startsOn: string;
  dueOn: string;
  doneOn: string | null;
  progress: number;
};
export type BarrierFacts = {
  id: string;
  title: string;
  kind: string;
  ownerUnitId: string;
  costIls: number;
  since: string;
  resolvedOn: string | null;
};
export type InitiativeFacts = {
  ownerUnitId: string;
  participatingUnitIds: string[];
  budgetIls: number;
  spentIls: number;
  milestones: MilestoneFacts[];
  barriers: BarrierFacts[];
};
/** An open conflict between two plans, by their owner units, and whether one of them is linked to the initiative. */
export type ConflictFacts = { id: string; unitA: string; unitB: string; linked: boolean; insightId: string | null };

export type MilestoneState = "planned" | "at_risk" | "late" | "done";
export type InitiativeStatus = "on_track" | "at_risk" | "blocked" | "done";

/** Behind the straight line from start to due by more than this many points of progress → at risk. */
const BEHIND_POINTS = 20;
const BLOCKED_AFTER_DAYS = 5;
const LATE_FLAG_DAYS = 3;
const SOON_DAYS = 7;
const DECISION_COST_ILS = 250_000;
const OVERSPEND = 1.1;

/** Progress the milestone should have reached today on a straight line from start to due (0–100). */
export function expectedProgress(m: Pick<MilestoneFacts, "startsOn" | "dueOn">, today: string): number {
  const span = daysBetween(m.startsOn, m.dueOn);
  if (span <= 0) return today >= m.dueOn ? 100 : 0;
  return Math.max(0, Math.min(100, (daysBetween(m.startsOn, today) / span) * 100));
}

export function milestoneState(m: MilestoneFacts, today: string): MilestoneState {
  if (m.doneOn) return "done";
  if (m.dueOn < today) return "late";
  return m.progress < expectedProgress(m, today) - BEHIND_POINTS ? "at_risk" : "planned";
}

const open = (b: BarrierFacts, today: string) => !b.resolvedOn || b.resolvedOn > today;

/** The next milestone: the earliest due that is not done. */
export function nextMilestone(i: Pick<InitiativeFacts, "milestones">): MilestoneFacts | null {
  return [...i.milestones].filter((m) => !m.doneOn).sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0] ?? null;
}

/**
 * done: every milestone done · blocked: an open barrier for more than 5 days · at risk: a milestone late, or the next
 * one at risk · on track otherwise.
 */
export function initiativeStatus(i: InitiativeFacts, today: string): InitiativeStatus {
  if (i.milestones.length > 0 && i.milestones.every((m) => m.doneOn)) return "done";
  if (i.barriers.some((b) => open(b, today) && b.since <= addDays(today, -BLOCKED_AFTER_DAYS - 1))) return "blocked";
  const next = nextMilestone(i);
  if (i.milestones.some((m) => milestoneState(m, today) === "late")) return "at_risk";
  if (next && milestoneState(next, today) === "at_risk") return "at_risk";
  return "on_track";
}

/** Mean progress of the milestones (0–100): the share of the work done. */
export function progressOf(i: Pick<InitiativeFacts, "milestones">): number {
  if (i.milestones.length === 0) return 0;
  return i.milestones.reduce((a, m) => a + (m.doneOn ? 100 : m.progress), 0) / i.milestones.length;
}

/** Spend at the end if it keeps pace with the work: spent ÷ share of the work done. */
export function projectedSpend(i: InitiativeFacts): number {
  const share = progressOf(i) / 100;
  return share > 0 ? i.spentIls / share : i.spentIls;
}

export type StepIn = "sponsor" | "common_manager" | "ceo_coo" | "cfo_sponsor";
export type Flag = {
  rule: "M1" | "M2" | "M3" | "M4" | "M5";
  reason: string;
  stepIn: StepIn;
  /** What it is about: a barrier, a milestone, a conflict, or the budget. */
  subject: { kind: "barrier" | "milestone" | "conflict" | "budget"; id: string | null; title: string };
  /** Unit expected to act (owner of the barrier or milestone; for a conflict, the first party). */
  unitId: string | null;
  /** The numbers behind the reason, so a screen can phrase it in the reader's language. */
  facts: { days?: number; due?: string; pct?: number; spent?: boolean; overLimit?: boolean };
};

/**
 * "Management needed" (cross-department.md §3):
 * M1 blocked for more than 5 days → sponsor · M2 a milestone late by more than 3 days, or the next at risk and due
 * within 7 days → sponsor · M3 an open conflict between two participating units, one of whose plans is linked to the
 * initiative → their common manager · M4 a decision barrier costing more than ₪250k or trading off between units
 * (owned by another unit than the initiative's owner) → CEO / COO · M5 spent, or projected spend at the end, above
 * budget × 1.1 → CFO and sponsor.
 */
export function managementFlags(i: InitiativeFacts, conflicts: ConflictFacts[], today: string): Flag[] {
  const flags: Flag[] = [];
  const openBarriers = i.barriers.filter((b) => open(b, today));
  for (const b of openBarriers.filter((x) => x.since <= addDays(today, -BLOCKED_AFTER_DAYS - 1)))
    flags.push({
      rule: "M1",
      reason: `blocked ${daysBetween(b.since, today)} days: ${b.title}`,
      stepIn: "sponsor",
      subject: { kind: "barrier", id: b.id, title: b.title },
      unitId: b.ownerUnitId,
      facts: { days: daysBetween(b.since, today) },
    });
  const next = nextMilestone(i);
  for (const m of i.milestones) {
    const late = !m.doneOn && m.dueOn < today ? daysBetween(m.dueOn, today) : 0;
    const soonAtRisk =
      next?.id === m.id && milestoneState(m, today) === "at_risk" && daysBetween(today, m.dueOn) <= SOON_DAYS;
    if (late > LATE_FLAG_DAYS || soonAtRisk)
      flags.push({
        rule: "M2",
        reason: late > LATE_FLAG_DAYS ? `${m.title}: ${late} days late` : `${m.title}: at risk, due ${m.dueOn}`,
        stepIn: "sponsor",
        subject: { kind: "milestone", id: m.id, title: m.title },
        unitId: m.ownerUnitId,
        facts: late > LATE_FLAG_DAYS ? { days: late } : { due: m.dueOn },
      });
  }
  const parts = new Set(i.participatingUnitIds);
  for (const k of conflicts.filter((c) => c.linked && parts.has(c.unitA) && parts.has(c.unitB)))
    flags.push({
      rule: "M3",
      reason: "open conflict between two participating units",
      stepIn: "common_manager",
      subject: { kind: "conflict", id: k.id, title: "conflict" },
      unitId: k.unitA,
      facts: {},
    });
  for (const b of openBarriers.filter(
    (x) => x.kind === "decision" && (x.costIls > DECISION_COST_ILS || x.ownerUnitId !== i.ownerUnitId),
  ))
    flags.push({
      rule: "M4",
      reason: b.costIls > DECISION_COST_ILS ? `decision over ₪250k: ${b.title}` : `decision between units: ${b.title}`,
      stepIn: "ceo_coo",
      subject: { kind: "barrier", id: b.id, title: b.title },
      unitId: b.ownerUnitId,
      facts: { overLimit: b.costIls > DECISION_COST_ILS },
    });
  if (i.budgetIls > 0) {
    const projected = projectedSpend(i);
    if (i.spentIls > i.budgetIls * OVERSPEND || projected > i.budgetIls * OVERSPEND)
      flags.push({
        rule: "M5",
        reason:
          i.spentIls > i.budgetIls * OVERSPEND
            ? `spent ${Math.round((i.spentIls / i.budgetIls) * 100)}% of budget`
            : `projected to spend ${Math.round((projected / i.budgetIls) * 100)}% of budget`,
        stepIn: "cfo_sponsor",
        subject: { kind: "budget", id: null, title: "budget" },
        unitId: i.ownerUnitId,
        facts:
          i.spentIls > i.budgetIls * OVERSPEND
            ? { spent: true, pct: Math.round((i.spentIls / i.budgetIls) * 100) }
            : { spent: false, pct: Math.round((projected / i.budgetIls) * 100) },
      });
  }
  return flags;
}

/** Milestones delivered by their due date ÷ milestones delivered; null before any delivery. */
export function onTimeRate(milestones: Pick<MilestoneFacts, "dueOn" | "doneOn">[]): number | null {
  const done = milestones.filter((m) => m.doneOn);
  return done.length ? done.filter((m) => m.doneOn! <= m.dueOn).length / done.length : null;
}
