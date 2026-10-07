/**
 * Cross-department initiatives (plan v2, E1c; cross-department.md §3). Recording one is a named, authorized and
 * audited command, like every other state change. E3 adds milestone and barrier commands and the M1–M5 rules.
 */
import { and, eq } from "drizzle-orm";
import { barrier, initiative, initiativeReminder, milestone } from "@/infra/db/schema";
import { DomainError } from "@/domain/errors";
import { assertAuthorized, authorizeUser } from "@/domain/policy/authorize";
import { hasPermission } from "@/domain/policy/permissions";
import type { Actor } from "@/domain/types";
import { type AppContext, runCommand } from "../context";
import { notFound, unitsByIds, visibleIds } from "./shared";

export type RecordInitiativeInput = {
  key: string;
  title: string;
  kind: "project" | "process";
  sponsorUserId: string;
  ownerUnitId: string;
  participatingUnitIds: string[];
  budgetIls: number;
  spentIls: number;
  valueIls: number;
  startsOn: string;
  endsOn?: string;
  commitmentIds?: string[];
  insightIds?: string[];
  milestones: {
    title: string;
    ownerUnitId: string;
    startsOn: string;
    dueOn: string;
    doneOn?: string;
    progress: number;
  }[];
  barriers: {
    title: string;
    kind: string;
    ownerUnitId: string;
    costIls?: number;
    since: string;
    resolvedOn?: string;
  }[];
};

export async function recordInitiative(ctx: AppContext, actor: Actor, input: RecordInitiativeInput): Promise<string> {
  return runCommand(
    ctx,
    actor,
    "initiative.record",
    { entityType: "org_unit", entityId: input.ownerUnitId }, // no initiative exists yet: a refusal names the unit
    async ({ tx, now, audit }) => {
      const [owner] = await unitsByIds(tx, ctx.orgId, [input.ownerUnitId]);
      assertAuthorized(authorizeUser(actor, "initiative.record", { targetUnits: [owner], isWrite: true }));
      const parts = await unitsByIds(tx, ctx.orgId, [...new Set([input.ownerUnitId, ...input.participatingUnitIds])]);
      if (parts.length < 2 || !parts.some((u) => u.type === "department"))
        throw new DomainError("Invalid", "an initiative spans at least two units, one of them a department");
      if (input.milestones.some((m) => m.dueOn < m.startsOn || m.progress < 0 || m.progress > 100))
        throw new DomainError("Invalid", "a milestone ends after it starts, with progress 0–100");
      const [row] = await tx
        .insert(initiative)
        .values({
          orgId: ctx.orgId,
          key: input.key,
          title: input.title.trim(),
          kind: input.kind,
          sponsorUserId: input.sponsorUserId,
          ownerUnitId: owner.id,
          participatingUnitIds: parts.map((u) => u.id),
          visibleUnitIds: visibleIds(parts),
          budgetIls: input.budgetIls,
          spentIls: input.spentIls,
          valueIls: input.valueIls,
          startsOn: input.startsOn,
          endsOn: input.endsOn ?? null,
          commitmentIds: input.commitmentIds ?? [],
          insightIds: input.insightIds ?? [],
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (input.milestones.length)
        await tx.insert(milestone).values(
          input.milestones.map((m) => ({
            orgId: ctx.orgId,
            initiativeId: row.id,
            title: m.title,
            ownerUnitId: m.ownerUnitId,
            startsOn: m.startsOn,
            dueOn: m.dueOn,
            doneOn: m.doneOn ?? null,
            progress: m.progress,
          })),
        );
      if (input.barriers.length)
        await tx.insert(barrier).values(
          input.barriers.map((b) => ({
            orgId: ctx.orgId,
            initiativeId: row.id,
            title: b.title,
            kind: b.kind,
            ownerUnitId: b.ownerUnitId,
            costIls: b.costIls ?? 0,
            since: b.since,
            resolvedOn: b.resolvedOn ?? null,
          })),
        );
      await audit({
        operation: "initiative.recorded",
        entityType: "initiative",
        entityId: row.id,
        changes: {
          title: row.title,
          participants: parts.map((u) => u.id),
          milestones: input.milestones.length,
          barriers: input.barriers.length,
        },
      });
      return row.id;
    },
  );
}

// ── E3: milestones, barriers and reminders (cross-department.md §3) ──────────────────────────────────────────────

type Loaded = {
  i: typeof initiative.$inferSelect;
  parts: Awaited<ReturnType<typeof unitsByIds>>;
};

async function loadInitiative(tx: Parameters<Parameters<typeof runCommand>[4]>[0]["tx"], orgId: string, id: string) {
  const [i] = await tx
    .select()
    .from(initiative)
    .where(and(eq(initiative.orgId, orgId), eq(initiative.id, id)));
  if (!i) notFound("initiative");
  return { i, parts: await unitsByIds(tx, orgId, i.participatingUnitIds) } as Loaded;
}

/**
 * Who may change an item of an initiative: a manager of the unit that owns it, anyone above it (AZ-1 subtree), or the
 * initiative's sponsor. Reading is not enough (ADR-008): the capability comes from a managing role.
 */
async function assertMayUpdate(
  tx: Parameters<Parameters<typeof runCommand>[4]>[0]["tx"],
  orgId: string,
  actor: Actor,
  i: typeof initiative.$inferSelect,
  ownerUnitId: string,
) {
  if (actor.kind === "user" && actor.userId === i.sponsorUserId) {
    assertAuthorized(authorizeUser(actor, "initiative.update", { targetUnits: [], isWrite: true }));
    return;
  }
  const [unit] = await unitsByIds(tx, orgId, [ownerUnitId]);
  assertAuthorized(authorizeUser(actor, "initiative.update", { targetUnits: [unit], isWrite: true }));
}

export async function completeMilestone(ctx: AppContext, actor: Actor, milestoneId: string) {
  return runCommand(
    ctx,
    actor,
    "milestone.complete",
    { entityType: "milestone", entityId: milestoneId },
    async ({ tx, now, audit }) => {
      const [m] = await tx
        .select()
        .from(milestone)
        .where(and(eq(milestone.orgId, ctx.orgId), eq(milestone.id, milestoneId)));
      if (!m) notFound("milestone");
      const { i } = await loadInitiative(tx, ctx.orgId, m.initiativeId);
      await assertMayUpdate(tx, ctx.orgId, actor, i, m.ownerUnitId);
      if (m.doneOn) throw new DomainError("IllegalTransition", "the milestone is already done");
      const day = now.toISOString().slice(0, 10);
      await tx.update(milestone).set({ doneOn: day, progress: 100 }).where(eq(milestone.id, m.id));
      await audit({
        operation: "milestone.completed",
        entityType: "milestone",
        entityId: m.id,
        changes: { initiativeId: i.id, doneOn: day, dueOn: m.dueOn, late: day > m.dueOn },
      });
    },
  );
}

export async function moveMilestone(ctx: AppContext, actor: Actor, milestoneId: string, dueOn: string, reason: string) {
  return runCommand(
    ctx,
    actor,
    "milestone.move",
    { entityType: "milestone", entityId: milestoneId },
    async ({ tx, now, audit }) => {
      const [m] = await tx
        .select()
        .from(milestone)
        .where(and(eq(milestone.orgId, ctx.orgId), eq(milestone.id, milestoneId)));
      if (!m) notFound("milestone");
      const { i } = await loadInitiative(tx, ctx.orgId, m.initiativeId);
      await assertMayUpdate(tx, ctx.orgId, actor, i, m.ownerUnitId);
      if (m.doneOn) throw new DomainError("IllegalTransition", "a done milestone cannot move");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn) || dueOn < m.startsOn)
        throw new DomainError("Invalid", "the new date is a day on or after the milestone's start");
      if (reason.trim().length < 5) throw new DomainError("Invalid", "say why the date moves (G4-Q Q3)");
      const entry = {
        from: m.dueOn,
        to: dueOn,
        by: actor.kind === "user" ? actor.userId : "system",
        at: now.toISOString(),
        reason: reason.trim(),
      };
      await tx
        .update(milestone)
        .set({ dueOn, history: [...((m.history as unknown[]) ?? []), entry] })
        .where(eq(milestone.id, m.id));
      await audit({
        operation: "milestone.moved",
        entityType: "milestone",
        entityId: m.id,
        changes: { initiativeId: i.id, from: m.dueOn, to: dueOn },
        reason: reason.trim(),
      });
    },
  );
}

export async function raiseBarrier(
  ctx: AppContext,
  actor: Actor,
  initiativeId: string,
  input: { title: string; kind: string; ownerUnitId: string; costIls?: number },
) {
  return runCommand(
    ctx,
    actor,
    "barrier.raise",
    { entityType: "initiative", entityId: initiativeId },
    async ({ tx, now, audit }) => {
      const { i, parts } = await loadInitiative(tx, ctx.orgId, initiativeId);
      if (!BARRIER_KINDS.includes(input.kind))
        throw new DomainError("Invalid", `barrier kind is one of ${BARRIER_KINDS.join(", ")}`);
      if (!parts.some((u) => u.id === input.ownerUnitId))
        throw new DomainError("Invalid", "a barrier is owned by a participating unit");
      if (input.title.trim().length < 3) throw new DomainError("Invalid", "name the barrier");
      // Raising is open to the sponsor and any participant's manager (or above): whoever is held up says so.
      assertInside(actor, i, parts);
      const [row] = await tx
        .insert(barrier)
        .values({
          orgId: ctx.orgId,
          initiativeId: i.id,
          title: input.title.trim(),
          kind: input.kind,
          ownerUnitId: input.ownerUnitId,
          costIls: Math.max(0, input.costIls ?? 0),
          since: now.toISOString().slice(0, 10),
        })
        .returning();
      await audit({
        operation: "barrier.raised",
        entityType: "barrier",
        entityId: row.id,
        changes: { initiativeId: i.id, kind: row.kind, ownerUnitId: row.ownerUnitId, costIls: row.costIls },
      });
      return row.id;
    },
  );
}

export async function resolveBarrier(ctx: AppContext, actor: Actor, barrierId: string, resolution: string) {
  return runCommand(
    ctx,
    actor,
    "barrier.resolve",
    { entityType: "barrier", entityId: barrierId },
    async ({ tx, now, audit }) => {
      const [b] = await tx
        .select()
        .from(barrier)
        .where(and(eq(barrier.orgId, ctx.orgId), eq(barrier.id, barrierId)));
      if (!b) notFound("barrier");
      const { i } = await loadInitiative(tx, ctx.orgId, b.initiativeId);
      await assertMayUpdate(tx, ctx.orgId, actor, i, b.ownerUnitId);
      const day = now.toISOString().slice(0, 10);
      if (b.resolvedOn && b.resolvedOn <= day)
        throw new DomainError("IllegalTransition", "the barrier is already resolved");
      if (resolution.trim().length < 5) throw new DomainError("Invalid", "say how it was resolved");
      await tx.update(barrier).set({ resolvedOn: day, resolution: resolution.trim() }).where(eq(barrier.id, b.id));
      await audit({
        operation: "barrier.resolved",
        entityType: "barrier",
        entityId: b.id,
        changes: { initiativeId: i.id, since: b.since, resolvedOn: day },
        reason: resolution.trim(),
      });
    },
  );
}

/**
 * A reminder to the unit that owns a late or stuck item, inside VECTOR (demo: nothing leaves the system, FB-7). The
 * sponsor, an executive, or any manager in the initiative may send one.
 */
export async function sendInitiativeReminder(
  ctx: AppContext,
  actor: Actor,
  initiativeId: string,
  input: { toUnitId: string; subjectKind: "milestone" | "barrier" | "budget"; subjectId?: string; body: string },
) {
  return runCommand(
    ctx,
    actor,
    "initiative.remind",
    { entityType: "initiative", entityId: initiativeId },
    async ({ tx, now, audit }) => {
      const { i, parts } = await loadInitiative(tx, ctx.orgId, initiativeId);
      assertInside(actor, i, parts);
      if (!parts.some((u) => u.id === input.toUnitId))
        throw new DomainError("Invalid", "a reminder goes to a participating unit");
      if (input.body.trim().length < 5) throw new DomainError("Invalid", "write the reminder");
      const [row] = await tx
        .insert(initiativeReminder)
        .values({
          orgId: ctx.orgId,
          initiativeId: i.id,
          subjectKind: input.subjectKind,
          subjectId: input.subjectId ?? null,
          toUnitId: input.toUnitId,
          fromUserId: actor.kind === "user" ? actor.userId : "",
          body: input.body.trim(),
          createdAt: now,
        })
        .returning();
      await audit({
        operation: "initiative.reminder_sent",
        entityType: "initiative",
        entityId: i.id,
        changes: {
          reminderId: row.id,
          toUnitId: input.toUnitId,
          subject: input.subjectKind,
          subjectId: input.subjectId,
        },
      });
      return row.id;
    },
  );
}

/** The sponsor, or a manager (initiative.update) of a participating unit or a unit above it. */
function assertInside(actor: Actor, i: typeof initiative.$inferSelect, parts: Loaded["parts"]) {
  if (actor.kind !== "user") throw new DomainError("NotAuthorized", "AZ-4: initiative changes come from people");
  assertAuthorized(authorizeUser(actor, "initiative.update", { targetUnits: [], isWrite: true }));
  const inside =
    actor.userId === i.sponsorUserId ||
    actor.assignments.some(
      (a) => hasPermission(a.role, "initiative.update") && parts.some((u) => u.pathIds.includes(a.unit.id)),
    );
  if (!inside)
    throw new DomainError("NotAuthorized", "AZ-1: only the sponsor or a manager in the initiative may do this");
}

export const BARRIER_KINDS = ["dependency", "resource", "budget", "decision", "external"];
