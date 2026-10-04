/**
 * Commitments, dependencies and conflicts (Phase 4; domain-model.md §4.6, §4.7). Every state change is a named
 * command: authorize, transition, persist and audit in one transaction (refusals are audited by runCommand).
 * The commitment monitor and the conflict detector act as `system:detector` and raise insights through the
 * normal detection path (recordDetection), so their insights carry signals, evidence and a scored priority.
 */
import { and, eq, inArray, or } from "drizzle-orm";
import {
  cascade,
  type CommitmentEffect,
  type CommitmentFacts,
  COMMITMENT_MONITOR_VERSION,
  conflictBetween,
  conflictPriority,
  CONFLICT_RULES_VERSION,
  type DependencyFacts,
  dependencyStatus,
  describeEffect,
  EFFECTS,
  introducedBy,
  overduePriority,
  shouldEscalate,
} from "@/domain/commitments";
import { DomainError } from "@/domain/errors";
import { requireRationale } from "@/domain/lifecycle/guards";
import { transition } from "@/domain/lifecycle/machines";
import { assertAuthorized, authorizeSystem, authorizeUser } from "@/domain/policy/authorize";
import { type Actor, actorId, inSubtree } from "@/domain/types";
import { commitment, conflict, dependency, insight, orgUnit, roleAssignment, user } from "@/infra/db/schema";
import { type AppContext, runCommand } from "../context";
import type { DbOrTx, Tx } from "../db";
import { holderOf } from "../detector";
import { type DetectionResult, recordDetection } from "./detection";
import { notFound, SYSTEM, unitsByIds, visibleIds } from "./shared";

type CommitmentRow = typeof commitment.$inferSelect;
type DependencyRow = typeof dependency.$inferSelect;

const HOUR = 3_600_000;
const writeCtx = (units: Awaited<ReturnType<typeof unitsByIds>>) => ({ targetUnits: units, isWrite: true });

export const toFacts = (c: CommitmentRow): CommitmentFacts => ({
  id: c.id,
  title: c.title,
  ownerUnitId: c.ownerUnitId,
  dueAt: c.dueAt,
  completedAt: c.completedAt,
  status: c.status,
  impactIls: Number(c.impactIls),
  compliance: c.compliance,
  effects: c.effects as CommitmentEffect[],
  createdAt: c.madeAt,
});
export const toDepFacts = (d: DependencyRow): DependencyFacts => ({
  id: d.id,
  commitmentId: d.commitmentId,
  downstreamUnitId: d.downstreamUnitId,
  downstreamCommitmentId: d.downstreamCommitmentId,
  needBy: d.needBy,
  impactIls: Number(d.impactIls),
});

async function lockCommitment(tx: Tx, orgId: string, id: string) {
  const [row] = await tx
    .select()
    .from(commitment)
    .where(and(eq(commitment.id, id), eq(commitment.orgId, orgId)))
    .for("update");
  return row ?? notFound("commitment");
}

function validEffects(effects: CommitmentEffect[]) {
  for (const e of effects) {
    if (!e.resource || !/^[a-z0-9:_-]{3,80}$/.test(e.resource))
      throw new DomainError("Invalid", `effect resource "${e.resource}" must be a resource name like sku-set:coast-14`);
    if (!EFFECTS.includes(e.effect)) throw new DomainError("Invalid", `unknown effect ${e.effect}`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(e.windowStart) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.windowEnd) ||
      e.windowStart > e.windowEnd
    )
      throw new DomainError("Invalid", "an effect window needs a start and an end date, start ≤ end");
  }
  return effects;
}

export type RecordCommitmentInput = {
  title: string;
  detail?: string | null;
  ownerUserId: string;
  ownerUnitId: string;
  beneficiaryUnitIds: string[];
  source: string;
  dueAt: Date;
  impactIls?: number;
  compliance?: number;
  effects?: CommitmentEffect[];
  /** Seed only: the catalog insight that tells this commitment's story. */
  insightId?: string;
};

/**
 * C1. Records a promise for a unit in the actor's scope. `madeAt` (seed only) back-dates the meeting it was made in;
 * the due date must be after it. The conflict detector runs right after (K1).
 */
export async function recordCommitment(
  ctx: AppContext,
  actor: Actor,
  input: RecordCommitmentInput,
  opts: { madeAt?: Date } = {},
): Promise<{ id: string; conflicts: DetectionResult[] }> {
  const id = await runCommand(
    ctx,
    actor,
    "commitment.record",
    { entityType: "commitment", entityId: input.ownerUnitId },
    async ({ tx, now, audit }) => {
      const [owner] = await unitsByIds(tx, ctx.orgId, [input.ownerUnitId]);
      assertAuthorized(authorizeUser(actor, "commitment.record", writeCtx([owner])));
      const title = input.title.trim();
      if (title.length < 5) throw new DomainError("Invalid", "say what was promised (at least 5 characters)");
      const madeAt = opts.madeAt ?? now;
      if (input.dueAt.getTime() <= madeAt.getTime())
        throw new DomainError("Invalid", "the due date must be in the future");
      const impact = input.impactIls ?? 0;
      const compliance = input.compliance ?? 0;
      if (!(impact >= 0) || !(compliance >= 0 && compliance <= 1))
        throw new DomainError("Invalid", "impact ≥ 0, compliance 0–1");
      // The owner must hold a role in the owning unit's subtree: a promise is owned by someone who can keep it.
      const ownerRoles = await tx
        .select({ unit: orgUnit })
        .from(roleAssignment)
        .innerJoin(orgUnit, eq(orgUnit.id, roleAssignment.orgUnitId))
        .where(and(eq(roleAssignment.orgId, ctx.orgId), eq(roleAssignment.userId, input.ownerUserId)));
      if (!ownerRoles.some((r) => inSubtree(owner, r.unit.id) || r.unit.pathIds.includes(owner.id)))
        throw new DomainError("Invalid", "the owner must work in the owning unit");
      const beneficiaries = await unitsByIds(tx, ctx.orgId, [...new Set(input.beneficiaryUnitIds)]);
      const effects = validEffects(input.effects ?? []);
      const t = transition("commitment", null, "record");
      const [row] = await tx
        .insert(commitment)
        .values({
          orgId: ctx.orgId,
          title,
          detail: input.detail ?? null,
          ownerUserId: input.ownerUserId,
          ownerUnitId: owner.id,
          beneficiaryUnitIds: beneficiaries.map((b) => b.id),
          source: input.source.trim() || "Recorded in VECTOR",
          madeAt,
          dueAt: input.dueAt,
          impactIls: impact,
          compliance,
          effects,
          insightId: input.insightId ?? null,
          visibleUnitIds: visibleIds([owner, ...beneficiaries]),
          status: t.to as "open",
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: commitment.id });
      await audit({
        operation: "commitment.recorded",
        entityType: "commitment",
        entityId: row.id,
        fromState: null,
        toState: t.to,
        changes: {
          title,
          ownerUserId: input.ownerUserId,
          ownerUnitId: owner.id,
          dueAt: input.dueAt.toISOString(),
          effects,
        },
      });
      return row.id;
    },
  );
  const conflicts = await detectConflicts(ctx, id);
  return { id, conflicts };
}

/** A unit declares what it needs from a commitment, by when (dependencies have no lifecycle: status is derived, Q4). */
export async function recordDependency(
  ctx: AppContext,
  actor: Actor,
  input: {
    commitmentId: string;
    downstreamUnitId: string;
    downstreamCommitmentId?: string | null;
    needBy: Date;
    impactIls?: number;
    note: string;
  },
) {
  return runCommand(
    ctx,
    actor,
    "dependency.record",
    { entityType: "commitment", entityId: input.commitmentId },
    async ({ tx, now, audit }) => {
      const [down] = await unitsByIds(tx, ctx.orgId, [input.downstreamUnitId]);
      assertAuthorized(authorizeUser(actor, "commitment.record", writeCtx([down])));
      const c = await lockCommitment(tx, ctx.orgId, input.commitmentId);
      if (c.ownerUnitId === down.id) throw new DomainError("Invalid", "a unit cannot depend on its own commitment");
      const [row] = await tx
        .insert(dependency)
        .values({
          orgId: ctx.orgId,
          commitmentId: c.id,
          downstreamUnitId: down.id,
          downstreamCommitmentId: input.downstreamCommitmentId ?? null,
          needBy: input.needBy,
          impactIls: input.impactIls ?? 0,
          note: input.note,
          createdAt: now,
        })
        .returning({ id: dependency.id });
      // The dependent unit can now see the commitment it relies on.
      await tx
        .update(commitment)
        .set({ visibleUnitIds: [...new Set([...c.visibleUnitIds, ...down.pathIds])] })
        .where(eq(commitment.id, c.id));
      await audit({
        operation: "dependency.recorded",
        entityType: "commitment",
        entityId: c.id,
        changes: {
          dependencyId: row.id,
          downstreamUnitId: down.id,
          needBy: input.needBy.toISOString(),
          note: input.note,
        },
      });
      return row.id;
    },
  );
}

async function ownerScoped(tx: Tx, ctx: AppContext, actor: Actor, c: CommitmentRow, capability: "commitment.update") {
  const [owner] = await unitsByIds(tx, ctx.orgId, [c.ownerUnitId]);
  assertAuthorized(authorizeUser(actor, capability, writeCtx([owner])));
}

/** C2 / C4. `at` (seed only) back-dates delivery. */
export async function completeCommitment(ctx: AppContext, actor: Actor, id: string, opts: { at?: Date } = {}) {
  await runCommand(
    ctx,
    actor,
    "commitment.complete",
    { entityType: "commitment", entityId: id },
    async ({ tx, now, audit }) => {
      const c = await lockCommitment(tx, ctx.orgId, id);
      await ownerScoped(tx, ctx, actor, c, "commitment.update");
      const t = transition("commitment", c.status, "complete");
      const at = opts.at ?? now;
      await tx
        .update(commitment)
        .set({ status: t.to as "done", completedAt: at, updatedAt: now, version: c.version + 1 })
        .where(eq(commitment.id, c.id));
      await audit({
        operation: "commitment.completed",
        entityType: "commitment",
        entityId: c.id,
        fromState: c.status,
        toState: t.to,
        changes: { completedAt: at.toISOString(), late: at.getTime() > c.dueAt.getTime() },
      });
    },
  );
  await sweepConflicts(ctx);
}

/**
 * C5 (Q3): the owner moves the due date with a rationale; the dependents see the change (history on the commitment,
 * the audit trail, "What changed"). Effects may move too (e.g. a promotion window), which re-runs the conflict rules.
 */
export async function renegotiateCommitment(
  ctx: AppContext,
  actor: Actor,
  id: string,
  input: { dueAt: Date; rationale: string; effects?: CommitmentEffect[] },
) {
  await runCommand(
    ctx,
    actor,
    "commitment.renegotiate",
    { entityType: "commitment", entityId: id },
    async ({ tx, now, audit }) => {
      const c = await lockCommitment(tx, ctx.orgId, id);
      await ownerScoped(tx, ctx, actor, c, "commitment.update");
      const reason = requireRationale(input.rationale, "Moving a commitment's date");
      if (input.dueAt.getTime() <= now.getTime())
        throw new DomainError("Invalid", "the new date must be in the future");
      const t = transition("commitment", c.status, "renegotiate");
      const effects = input.effects ? validEffects(input.effects) : (c.effects as CommitmentEffect[]);
      const entry = {
        from: c.dueAt.toISOString(),
        to: input.dueAt.toISOString(),
        by: actorId(actor),
        at: now.toISOString(),
        rationale: reason,
      };
      await tx
        .update(commitment)
        .set({
          status: t.to as "open",
          dueAt: input.dueAt,
          effects,
          history: [...(c.history as unknown[]), entry],
          rationale: reason,
          updatedAt: now,
          version: c.version + 1,
        })
        .where(eq(commitment.id, c.id));
      await audit({
        operation: "commitment.renegotiated",
        entityType: "commitment",
        entityId: c.id,
        fromState: c.status,
        toState: t.to,
        reason,
        changes: { dueAt: { from: entry.from, to: entry.to }, ...(input.effects ? { effects } : {}) },
      });
    },
  );
  await sweepConflicts(ctx);
  await detectConflicts(ctx, id);
}

/** C6. */
export async function cancelCommitment(ctx: AppContext, actor: Actor, id: string, rationale: string) {
  await runCommand(
    ctx,
    actor,
    "commitment.cancel",
    { entityType: "commitment", entityId: id },
    async ({ tx, now, audit }) => {
      const c = await lockCommitment(tx, ctx.orgId, id);
      await ownerScoped(tx, ctx, actor, c, "commitment.update");
      const reason = requireRationale(rationale, "Cancelling a commitment");
      const t = transition("commitment", c.status, "cancel");
      await tx
        .update(commitment)
        .set({ status: t.to as "cancelled", rationale: reason, updatedAt: now, version: c.version + 1 })
        .where(eq(commitment.id, c.id));
      await audit({
        operation: "commitment.cancelled",
        entityType: "commitment",
        entityId: c.id,
        fromState: c.status,
        toState: t.to,
        reason,
      });
    },
  );
  await sweepConflicts(ctx);
}

// ── Detection (system:detector) ──────────────────────────────────────────────

async function loadAll(db: DbOrTx, orgId: string) {
  const [cs, ds, units, people] = await Promise.all([
    db.select().from(commitment).where(eq(commitment.orgId, orgId)),
    db.select().from(dependency).where(eq(dependency.orgId, orgId)),
    db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId)),
    db.select({ id: user.id, name: user.name }).from(user).where(eq(user.orgId, orgId)),
  ]);
  return { cs, ds, units, people };
}

const ils = (n: number) => `₪${Math.round(n / 1000).toLocaleString("en-US")}k`;
const day = (d: Date) => d.toISOString().slice(5, 10);

async function headFor(ctx: AppContext, unit: { id: string; type: string }) {
  return holderOf(ctx, unit.id, unit.type === "department" ? "department_manager" : "regional_manager");
}

/**
 * commitment-monitor-v1 (runs on every clock advance and at seed): open commitments past their due date become
 * `overdue` (C3). Those that matter (Q2) raise a scored `commitment_overdue` insight for the owning unit, with a
 * chase-and-mitigate recommendation and a notice to every unit waiting on it. Idempotent: dedupe key per commitment.
 */
export async function runCommitmentMonitor(
  ctx: AppContext,
): Promise<{ overdue: string[]; insights: DetectionResult[] }> {
  assertAuthorized(authorizeSystem(SYSTEM.detector, "commitment.mark_overdue"));
  const now = ctx.clock.now();
  const { cs, ds, units, people } = await loadAll(ctx.db, ctx.orgId);
  const unitOf = (id: string) => units.find((u) => u.id === id)!;
  const due = cs.filter((c) => c.status === "open" && c.dueAt.getTime() < now.getTime());
  const overdue: string[] = [];
  const insights: DetectionResult[] = [];
  for (const c of due) {
    await runCommand(
      ctx,
      SYSTEM.detector,
      "commitment.mark_overdue",
      { entityType: "commitment", entityId: c.id },
      async ({ tx, audit }) => {
        const row = await lockCommitment(tx, ctx.orgId, c.id);
        const t = transition("commitment", row.status, "mark_overdue");
        await tx
          .update(commitment)
          .set({ status: t.to as "overdue", updatedAt: now, version: row.version + 1 })
          .where(eq(commitment.id, row.id));
        await audit({
          operation: "commitment.overdue",
          entityType: "commitment",
          entityId: row.id,
          fromState: row.status,
          toState: t.to,
          changes: { dueAt: row.dueAt.toISOString(), monitor: COMMITMENT_MONITOR_VERSION },
        });
      },
    );
    overdue.push(c.id);
  }

  // Escalate every overdue commitment that matters and has no insight yet (Q2).
  const fresh = (await ctx.db.select().from(commitment).where(eq(commitment.orgId, ctx.orgId))).filter(
    (c) => c.status === "overdue" && !c.insightId,
  );
  const facts = (await ctx.db.select().from(commitment).where(eq(commitment.orgId, ctx.orgId))).map(toFacts);
  const depFacts = ds.map(toDepFacts);
  for (const c of fresh) {
    const mine = ds.filter((d) => d.commitmentId === c.id);
    if (!shouldEscalate({ impactIls: Number(c.impactIls), compliance: c.compliance }, mine.length)) continue;
    const chain = cascade(c.id, facts, depFacts, now);
    const owner = unitOf(c.ownerUnitId);
    const affected = [...new Set([c.ownerUnitId, ...c.beneficiaryUnitIds, ...chain.unitIds])];
    const affectedBranches = affected
      .map(unitOf)
      .reduce((n, u) => n + (u.type === "branch" ? 1 : u.type === "region" ? 12 : u.type === "group" ? 60 : 1), 0);
    const priority = overduePriority(
      toFacts(c),
      mine.map((d) => ({ needBy: d.needBy, impactIls: Number(d.impactIls), unitId: d.downstreamUnitId })),
      affectedBranches,
      now,
    );
    const daysLate = Math.max(1, Math.round((now.getTime() - c.dueAt.getTime()) / (24 * HOUR)));
    const waiting = mine.map((d) => unitOf(d.downstreamUnitId).name);
    const ownerName = people.find((p) => p.id === c.ownerUserId)?.name ?? "the owner";
    const heads = await Promise.all(
      mine.map(async (d) => ({ d, head: await headFor(ctx, unitOf(d.downstreamUnitId)) })),
    );
    const r = await recordDetection(ctx, {
      signal: {
        type: "commitment_overdue",
        source: "commitment_register",
        detector: "commitment-monitor",
        detectorVersion: COMMITMENT_MONITOR_VERSION,
        observedAt: now,
        primaryUnitId: owner.id,
        measurements: {
          commitmentId: c.id,
          dueAt: c.dueAt.toISOString(),
          daysOverdue: daysLate,
          dependents: mine.length,
        },
        dedupeKey: `commitment_overdue:${c.id}`,
      },
      evidence: [
        {
          kind: "source_record",
          title: `Commitment record (${c.source})`,
          sourceRef: `commitment:${c.id}`,
          payload: {
            commitment: c.title,
            owner: ownerName,
            due: c.dueAt.toISOString().slice(0, 16).replace("T", " "),
            source: c.source,
            waiting: mine.map((d) => ({
              unit: unitOf(d.downstreamUnitId).name,
              needBy: day(d.needBy),
              note: d.note,
              status: dependencyStatus(d, toFacts({ ...c, status: "overdue" }), now),
            })),
          },
        },
      ],
      insight: {
        workstream: "risk",
        ownerDepartmentId: owner.type === "department" ? owner.id : undefined,
        title: `${owner.name}: “${c.title}” is ${daysLate} day${daysLate === 1 ? "" : "s"} overdue`,
        whatHappened: `${ownerName} committed to this at ${c.source}, due ${day(c.dueAt)}. It has not been delivered.`,
        whyItMatters:
          waiting.length > 0
            ? `${waiting.join(", ")} ${waiting.length === 1 ? "is" : "are"} waiting on it (${ils(priority.impactIls)}/week at stake)${chain.commitmentIds.length ? `, and ${chain.commitmentIds.length} downstream commitment${chain.commitmentIds.length === 1 ? " is" : "s are"} now at risk` : ""}.`
            : `${ils(priority.impactIls)}/week at stake${c.compliance >= 0.6 ? ", with compliance exposure" : ""}.`,
        primaryUnitId: owner.id,
        affectedUnitIds: affected,
        confidence: 0.95,
        priority,
        generatedBy: COMMITMENT_MONITOR_VERSION,
      },
      recommendation: {
        statement: `Deliver “${c.title}” now, or agree a new date with the teams waiting on it`,
        rationale: "A late promise with people waiting on it is cheaper to fix now than after their deadlines pass.",
        actions: [
          {
            type: "notify_owner",
            title: `Deliver or renegotiate: ${c.title}`,
            ownerUserId: c.ownerUserId,
            targetUnitIds: [owner.id],
            dueAt: new Date(now.getTime() + 24 * HOUR),
            estimatedCost: 0,
            params: { commitmentId: c.id },
          },
          ...heads
            .filter((h) => h.head && h.head.id !== c.ownerUserId)
            .map(({ d, head }) => ({
              type: "notify_owner",
              title: `Plan around the late “${c.title}” (${unitOf(d.downstreamUnitId).name})`,
              ownerUserId: head!.id,
              targetUnitIds: [d.downstreamUnitId],
              dueAt: new Date(Math.max(now.getTime() + 12 * HOUR, d.needBy.getTime() - 12 * HOUR)),
              estimatedCost: 0,
              params: { commitmentId: c.id, dependencyId: d.id },
            })),
        ],
      },
    });
    await linkInsight(ctx, c.id, r.insightId);
    insights.push(r);
  }
  await sweepConflicts(ctx);
  return { overdue, insights };
}

async function linkInsight(ctx: AppContext, commitmentId: string, insightId: string) {
  await runCommand(
    ctx,
    SYSTEM.detector,
    "commitment.link_insight",
    { entityType: "commitment", entityId: commitmentId },
    async ({ tx, now, audit }) => {
      const c = await lockCommitment(tx, ctx.orgId, commitmentId);
      await tx
        .update(commitment)
        .set({ insightId, updatedAt: now, version: c.version + 1 })
        .where(eq(commitment.id, c.id));
      await audit({
        operation: "commitment.insight_linked",
        entityType: "commitment",
        entityId: c.id,
        changes: { insightId },
      });
    },
  );
}

/**
 * conflict-rules-v1 for one commitment against every other (K1). A pair that both belong to the same catalog story
 * links to that story's insight; otherwise a `decision_conflict` insight is raised for the unit that introduced the
 * conflict (Q1). Idempotent: one conflict per pair and resource.
 */
export async function detectConflicts(ctx: AppContext, commitmentId: string): Promise<DetectionResult[]> {
  assertAuthorized(authorizeSystem(SYSTEM.detector, "conflict.detect"));
  const now = ctx.clock.now();
  const { cs, units, people } = await loadAll(ctx.db, ctx.orgId);
  const me = cs.find((c) => c.id === commitmentId);
  if (!me) return [];
  const existing = await ctx.db
    .select()
    .from(conflict)
    .where(
      and(
        eq(conflict.orgId, ctx.orgId),
        or(eq(conflict.commitmentAId, commitmentId), eq(conflict.commitmentBId, commitmentId)),
      ),
    );
  const unitOf = (id: string) => units.find((u) => u.id === id)!;
  const nameOf = (uid: string) => people.find((p) => p.id === uid)?.name ?? "the owner";
  const out: DetectionResult[] = [];
  for (const other of cs) {
    const overlap = conflictBetween(toFacts(me), toFacts(other));
    if (!overlap) continue;
    const [a, b] = me.madeAt.getTime() <= other.madeAt.getTime() ? [me, other] : [other, me];
    if (
      existing.some(
        (x) =>
          x.status === "open" &&
          x.resource === overlap.resource &&
          [x.commitmentAId, x.commitmentBId].includes(other.id),
      )
    )
      continue;
    const later = introducedBy(toFacts(a), toFacts(b)).id === a.id ? a : b;
    const earlier = later.id === a.id ? b : a;
    let insightId = a.insightId && a.insightId === b.insightId ? a.insightId : null;
    if (!insightId) {
      const lu = unitOf(later.ownerUnitId);
      const eu = unitOf(earlier.ownerUnitId);
      const affected = [...new Set([lu.id, eu.id, ...later.beneficiaryUnitIds, ...earlier.beneficiaryUnitIds])];
      const branchCount = affected
        .map(unitOf)
        .reduce((n, u) => n + (u.type === "branch" ? 1 : u.type === "region" ? 12 : u.type === "group" ? 60 : 1), 0);
      const eLater = (later.effects as CommitmentEffect[]).find((e) => e.resource === overlap.resource)!;
      const eEarlier = (earlier.effects as CommitmentEffect[]).find((e) => e.resource === overlap.resource)!;
      const r = await recordDetection(ctx, {
        signal: {
          type: "decision_conflict",
          source: "commitment_register",
          detector: "conflict-rules",
          detectorVersion: CONFLICT_RULES_VERSION,
          observedAt: now,
          primaryUnitId: lu.id,
          measurements: {
            resource: overlap.resource,
            overlap: [overlap.start, overlap.end],
            commitments: [earlier.id, later.id],
          },
          dedupeKey: `conflict:${[a.id, b.id].sort().join(":")}:${overlap.resource}`,
        },
        evidence: [
          {
            kind: "source_record",
            title: "The two commitments (commitment register)",
            sourceRef: `conflict:${a.id}:${b.id}`,
            payload: {
              resource: overlap.resource,
              overlap: `${overlap.start} → ${overlap.end}`,
              first: {
                unit: eu.name,
                owner: nameOf(earlier.ownerUserId),
                commitment: earlier.title,
                effect: eEarlier.effect,
                window: `${eEarlier.windowStart} → ${eEarlier.windowEnd}`,
                source: earlier.source,
              },
              second: {
                unit: lu.name,
                owner: nameOf(later.ownerUserId),
                commitment: later.title,
                effect: eLater.effect,
                window: `${eLater.windowStart} → ${eLater.windowEnd}`,
                source: later.source,
              },
            },
          },
        ],
        insight: {
          workstream: "risk",
          ownerDepartmentId: lu.type === "department" ? lu.id : undefined,
          title: `${lu.name}'s “${later.title}” collides with ${eu.name}'s “${earlier.title}”`,
          whatHappened: `${lu.name} ${describeEffect(eLater.effect)} ${overlap.resource} (${eLater.windowStart} → ${eLater.windowEnd}) while ${eu.name} ${describeEffect(eEarlier.effect)} it (${eEarlier.windowStart} → ${eEarlier.windowEnd}). They overlap ${overlap.start} → ${overlap.end}.`,
          whyItMatters: `Both cannot happen: about ${ils(Math.max(Number(a.impactIls), Number(b.impactIls)))}/week is at stake, and the overlap starts ${overlap.start}.`,
          primaryUnitId: lu.id,
          affectedUnitIds: affected,
          confidence: 0.9,
          priority: conflictPriority(toFacts(a), toFacts(b), overlap, branchCount, now),
          generatedBy: CONFLICT_RULES_VERSION,
        },
        recommendation: {
          statement: `Move “${later.title}” out of ${overlap.start} → ${overlap.end}, or agree with ${eu.name} which plan stands`,
          rationale: `${lu.name} introduced the overlap (recorded later), so it adjusts first; ${eu.name} confirms.`,
          actions: [
            {
              type: "notify_owner",
              title: `Adjust or withdraw: ${later.title}`,
              ownerUserId: later.ownerUserId,
              targetUnitIds: [lu.id],
              dueAt: new Date(now.getTime() + 24 * HOUR),
              estimatedCost: 0,
              params: { commitmentId: later.id, resource: overlap.resource },
            },
            {
              type: "notify_owner",
              title: `Confirm your plan with ${lu.name}: ${earlier.title}`,
              ownerUserId: earlier.ownerUserId,
              targetUnitIds: [eu.id],
              dueAt: new Date(now.getTime() + 24 * HOUR),
              estimatedCost: 0,
              params: { commitmentId: earlier.id, resource: overlap.resource },
            },
          ],
        },
      });
      insightId = r.insightId;
      out.push(r);
    }
    await runCommand(
      ctx,
      SYSTEM.detector,
      "conflict.detect",
      { entityType: "conflict", entityId: `${a.id}:${b.id}` },
      async ({ tx, audit }) => {
        const t = transition("conflict", null, "detect");
        const [row] = await tx
          .insert(conflict)
          .values({
            orgId: ctx.orgId,
            commitmentAId: a.id,
            commitmentBId: b.id,
            rule: `${CONFLICT_RULES_VERSION}:${[...overlap.effects].sort().join("×")}`,
            resource: overlap.resource,
            overlapStart: overlap.start,
            overlapEnd: overlap.end,
            insightId,
            status: t.to as "open",
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing()
          .returning({ id: conflict.id });
        if (!row) return;
        // Each side of a conflict can see the plan it collides with (the deciding unit needs both, Q1).
        const [ua, ub] = await unitsByIds(tx, ctx.orgId, [a.ownerUnitId, b.ownerUnitId]);
        for (const [c, other] of [
          [a, ub],
          [b, ua],
        ] as const) {
          const [cur] = await tx
            .select({ v: commitment.visibleUnitIds })
            .from(commitment)
            .where(eq(commitment.id, c.id));
          await tx
            .update(commitment)
            .set({ visibleUnitIds: [...new Set([...cur.v, ...other.pathIds])] })
            .where(eq(commitment.id, c.id));
        }
        await audit({
          operation: "conflict.detected",
          entityType: "conflict",
          entityId: row.id,
          fromState: null,
          toState: t.to,
          changes: {
            commitments: [a.id, b.id],
            resource: overlap.resource,
            overlap: [overlap.start, overlap.end],
            insightId,
          },
        });
      },
    );
  }
  return out;
}

/** K2: open conflicts whose pair no longer collides (a side cancelled or moved), or whose insight was closed. */
export async function sweepConflicts(ctx: AppContext) {
  assertAuthorized(authorizeSystem(SYSTEM.detector, "conflict.resolve"));
  const open = await ctx.db
    .select()
    .from(conflict)
    .where(and(eq(conflict.orgId, ctx.orgId), eq(conflict.status, "open")));
  if (open.length === 0) return [];
  const ids = [...new Set(open.flatMap((k) => [k.commitmentAId, k.commitmentBId]))];
  const cs = await ctx.db.select().from(commitment).where(inArray(commitment.id, ids));
  const ins = await ctx.db
    .select({ id: insight.id, status: insight.status })
    .from(insight)
    .where(
      inArray(
        insight.id,
        open.map((k) => k.insightId).filter((x): x is string => !!x),
      ),
    );
  const resolved: string[] = [];
  for (const k of open) {
    const a = cs.find((c) => c.id === k.commitmentAId)!;
    const b = cs.find((c) => c.id === k.commitmentBId)!;
    const still = conflictBetween(toFacts(a), toFacts(b));
    const insightClosed = ins.some(
      (i) => i.id === k.insightId && (i.status === "resolved" || i.status === "dismissed"),
    );
    const reason =
      !still || still.resource !== k.resource
        ? a.status === "cancelled" || b.status === "cancelled"
          ? "a commitment was cancelled"
          : "the windows no longer overlap"
        : insightClosed
          ? "its insight was closed"
          : null;
    if (!reason) continue;
    await runCommand(
      ctx,
      SYSTEM.detector,
      "conflict.resolve",
      { entityType: "conflict", entityId: k.id },
      async ({ tx, now, audit }) => {
        const [row] = await tx.select().from(conflict).where(eq(conflict.id, k.id)).for("update");
        const t = transition("conflict", row.status, "resolve");
        await tx
          .update(conflict)
          .set({ status: t.to as "resolved", resolvedReason: reason, updatedAt: now, version: row.version + 1 })
          .where(eq(conflict.id, k.id));
        await audit({
          operation: "conflict.resolved",
          entityType: "conflict",
          entityId: k.id,
          fromState: row.status,
          toState: t.to,
          reason,
        });
      },
    );
    resolved.push(k.id);
  }
  return resolved;
}
