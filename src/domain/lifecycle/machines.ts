/**
 * Lifecycle state machines as data (docs/specs/domain-model.md §4). Row ids match the spec tables
 * (I1…, D1…, A1…, P1…, O1…). Anything not listed is an IllegalTransition. Context guards (scope,
 * approval eligibility, rationale) are applied by the commands using the helpers in guards.ts.
 */
import { illegal } from "../errors";

type Row<S extends string, C extends string> = { id: string; from: S | "∅"; command: C; to: S };

export type InsightState = "open" | "acknowledged" | "dismissed" | "resolved" | "superseded";
export type DecisionState = "recommended" | "decided" | "declined" | "superseded";
export type ActionState =
  "proposed" | "pending_approval" | "rejected" | "ready" | "executing" | "executed" | "failed" | "cancelled";
export type ApprovalState = "requested" | "granted" | "denied" | "expired" | "withdrawn" | "lapsed";
export type OutcomeState = "observing" | "evaluated" | "reviewed";

export const INSIGHT: Row<InsightState, string>[] = [
  { id: "I1", from: "∅", command: "create", to: "open" },
  { id: "I2", from: "open", command: "acknowledge", to: "acknowledged" },
  { id: "I3", from: "open", command: "dismiss", to: "dismissed" },
  { id: "I3", from: "acknowledged", command: "dismiss", to: "dismissed" },
  { id: "I4", from: "open", command: "resolve", to: "resolved" },
  { id: "I4", from: "acknowledged", command: "resolve", to: "resolved" },
  { id: "I5", from: "open", command: "supersede", to: "superseded" },
  { id: "I5", from: "acknowledged", command: "supersede", to: "superseded" },
];

export const DECISION: Row<DecisionState, string>[] = [
  { id: "D1", from: "∅", command: "recommend", to: "recommended" },
  { id: "D2", from: "∅", command: "decide_directly", to: "decided" },
  { id: "D3", from: "recommended", command: "accept", to: "decided" },
  { id: "D4", from: "recommended", command: "auto_decide", to: "decided" },
  { id: "D5", from: "recommended", command: "decline", to: "declined" },
  { id: "D6", from: "recommended", command: "supersede", to: "superseded" },
];

export const ACTION: Row<ActionState, string>[] = [
  { id: "A1", from: "∅", command: "propose", to: "proposed" },
  { id: "A2", from: "proposed", command: "submit_requires_approval", to: "pending_approval" },
  { id: "A3", from: "proposed", command: "submit_no_approval", to: "ready" },
  { id: "A4", from: "pending_approval", command: "approval_granted", to: "ready" },
  { id: "A5", from: "pending_approval", command: "approval_denied", to: "rejected" },
  { id: "A6", from: "pending_approval", command: "approval_expired", to: "proposed" },
  { id: "A7", from: "ready", command: "start_execution", to: "executing" },
  { id: "A7b", from: "ready", command: "requirement_grew", to: "pending_approval" },
  { id: "A8", from: "executing", command: "complete_execution", to: "executed" },
  { id: "A9", from: "executing", command: "fail_execution", to: "failed" },
  { id: "A10", from: "failed", command: "retry", to: "ready" },
  { id: "A11", from: "proposed", command: "cancel", to: "cancelled" },
  { id: "A11", from: "pending_approval", command: "cancel", to: "cancelled" },
  { id: "A11", from: "ready", command: "cancel", to: "cancelled" },
  { id: "P6b", from: "ready", command: "approval_lapsed", to: "pending_approval" },
  { id: "A12", from: "proposed", command: "amend", to: "proposed" },
  { id: "A12", from: "pending_approval", command: "amend", to: "proposed" },
  { id: "A12", from: "ready", command: "amend", to: "proposed" },
];

export const APPROVAL: Row<ApprovalState, string>[] = [
  { id: "P1", from: "∅", command: "request", to: "requested" },
  { id: "P2", from: "requested", command: "grant", to: "granted" },
  { id: "P3", from: "requested", command: "deny", to: "denied" },
  { id: "P4", from: "requested", command: "expire", to: "expired" },
  { id: "P5", from: "requested", command: "withdraw", to: "withdrawn" },
  { id: "P6", from: "granted", command: "lapse", to: "lapsed" },
  { id: "P5b", from: "granted", command: "withdraw", to: "withdrawn" },
];

export const OUTCOME: Row<OutcomeState, string>[] = [
  { id: "O1", from: "∅", command: "start_watch", to: "observing" },
  { id: "O2", from: "observing", command: "evaluate", to: "evaluated" },
  { id: "O3", from: "evaluated", command: "review", to: "reviewed" },
];

export const MACHINES = {
  insight: INSIGHT,
  decision: DECISION,
  action: ACTION,
  approval: APPROVAL,
  outcome: OUTCOME,
} as const;
export type MachineName = keyof typeof MACHINES;

/** Returns the next state and the spec row id, or throws IllegalTransition. */
export function transition(machine: MachineName, from: string | null, command: string): { to: string; rowId: string } {
  const f = from ?? "∅";
  const row = (MACHINES[machine] as Row<string, string>[]).find((r) => r.from === f && r.command === command);
  if (!row) throw illegal(machine, f, command);
  return { to: row.to, rowId: row.id };
}
