/**
 * Cross-department initiatives (plan v2, E1c; cross-department.md §3). Recording one is a named, authorized and
 * audited command, like every other state change. E3 adds milestone and barrier commands and the M1–M5 rules.
 */
import { initiative, milestone, barrier } from "@/infra/db/schema";
import { DomainError } from "@/domain/errors";
import { assertAuthorized, authorizeUser } from "@/domain/policy/authorize";
import type { Actor } from "@/domain/types";
import { type AppContext, runCommand } from "../context";
import { unitsByIds, visibleIds } from "./shared";

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
