/** Context guards from the transition tables (docs/specs/domain-model.md §4), as pure functions. */
import { DomainError } from "../errors";

export const APPROVAL_REQUEST_TTL_HOURS = 72;
export const APPROVAL_VALIDITY_DAYS = 7;
export const MAX_ATTEMPTS = 3;

export function requireRationale(rationale: string | null | undefined, what: string): string {
  const r = (rationale ?? "").trim();
  if (r.length < 3) throw new DomainError("RationaleRequired", `${what} requires a rationale`);
  return r;
}

/** AZ-2: approver ≠ proposer, approver ≠ owner. */
export function assertSeparationOfDuties(approverId: string, proposedBy: string, ownerId: string): void {
  if (approverId === proposedBy)
    throw new DomainError("NotAuthorized", "AZ-2: you cannot approve an action you proposed");
  if (approverId === ownerId) throw new DomainError("NotAuthorized", "AZ-2: you cannot approve an action you own");
}

export function approvalRequestExpired(requestedAt: Date, now: Date): boolean {
  return now.getTime() - requestedAt.getTime() > APPROVAL_REQUEST_TTL_HOURS * 3_600_000;
}

export function approvalValidUntil(grantedAt: Date): Date {
  return new Date(grantedAt.getTime() + APPROVAL_VALIDITY_DAYS * 86_400_000);
}

/** A7 run-time check: a granted approval for this exact action revision that has not lapsed. */
export function approvalUsableForExecution(
  approval: { status: string; actionRevision: number; validUntil: Date | null } | undefined,
  actionRevision: number,
  now: Date,
): { ok: true } | { ok: false; reason: string } {
  if (!approval) return { ok: false, reason: "no approval on record" };
  if (approval.status !== "granted") return { ok: false, reason: `approval is ${approval.status}` };
  if (approval.actionRevision !== actionRevision) return { ok: false, reason: "action changed after approval" };
  if (!approval.validUntil || approval.validUntil <= now) return { ok: false, reason: "approval lapsed" };
  return { ok: true };
}

export function assertCanRetry(attempt: number): void {
  if (attempt >= MAX_ATTEMPTS)
    throw new DomainError("RetryLimit", `retried ${attempt} times; limit is ${MAX_ATTEMPTS}`);
}

export type Verdict = "worked" | "partially_worked" | "did_not_work" | "inconclusive";

/** O2 verdict rule (domain-model.md §4.5). Change is measured in the expected direction. */
export function outcomeVerdict(input: {
  baselineMean: number;
  windowMean: number;
  expectedDirection: "up" | "down";
  threshold: number;
  coverage: number;
}): Verdict {
  if (input.coverage < 0.8) return "inconclusive";
  const change = (input.windowMean - input.baselineMean) * (input.expectedDirection === "up" ? 1 : -1);
  if (change >= input.threshold) return "worked";
  if (change >= 0.5 * input.threshold) return "partially_worked";
  return "did_not_work";
}

/** AD-1: only P3/P4 "notify owner" recommendations may be decided automatically. */
export function autoDecideAllowed(band: string, actionTypes: string[], anyApprovalRequired: boolean): boolean {
  return (band === "P3" || band === "P4") && actionTypes.every((t) => t === "notify_owner") && !anyApprovalRequired;
}
