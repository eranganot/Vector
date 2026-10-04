/**
 * Command context: the active org, the clock, the actor, and a runner that wraps every command in one
 * transaction with its audit rows (docs/architecture.md "Command pipeline").
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { DomainError } from "@/domain/errors";
import type { Clock } from "@/domain/clock";
import type { Actor, RoleAssignment, UnitRef } from "@/domain/types";
import { demoClock, organization, orgUnit, roleAssignment } from "@/infra/db/schema";
import { appendAudit, type AuditInput } from "./audit";
import type { Db, DbOrTx, Tx } from "./db";

export type AppContext = { db: Db; orgId: string; clock: Clock; requestId: string };

export async function activeOrgId(db: DbOrTx): Promise<string> {
  const [org] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.isActive, true))
    .limit(1);
  if (!org) throw new DomainError("NoActiveOrg", "no active organization; run the seed");
  return org.id;
}

/** The demo clock for an org (falls back to real time if none is set). */
export function dbClock(db: DbOrTx, orgId: string) {
  return {
    async now(): Promise<Date> {
      const [row] = await db.select().from(demoClock).where(eq(demoClock.orgId, orgId));
      return row?.now ?? new Date();
    },
  };
}

export async function createContext(db: Db, opts: { requestId?: string; orgId?: string } = {}): Promise<AppContext> {
  const orgId = opts.orgId ?? (await activeOrgId(db));
  const now = await dbClock(db, orgId).now();
  return { db, orgId, clock: { now: () => new Date(now) }, requestId: opts.requestId ?? randomUUID() };
}

export const toUnitRef = (u: { id: string; type: UnitRef["type"]; pathIds: string[] }): UnitRef => ({
  id: u.id,
  type: u.type,
  pathIds: u.pathIds,
});

export async function loadUnits(
  db: DbOrTx,
  orgId: string,
  ids?: string[],
): Promise<Map<string, UnitRef & { code: string; name: string }>> {
  const rows = await db
    .select()
    .from(orgUnit)
    .where(
      ids
        ? and(
            eq(orgUnit.orgId, orgId),
            inArray(orgUnit.id, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
          )
        : eq(orgUnit.orgId, orgId),
    );
  return new Map(rows.map((r) => [r.id, { ...toUnitRef(r), code: r.code, name: r.name }]));
}

export async function loadUserActor(
  db: DbOrTx,
  orgId: string,
  userId: string,
  session: { sessionId: string; viaDemoSwitcher: boolean; sessionAgeHours?: number },
): Promise<Actor> {
  const rows = await db
    .select({ role: roleAssignment.role, unit: orgUnit })
    .from(roleAssignment)
    .innerJoin(orgUnit, eq(roleAssignment.orgUnitId, orgUnit.id))
    .where(and(eq(roleAssignment.userId, userId), eq(roleAssignment.orgId, orgId)));
  const assignments: RoleAssignment[] = rows.map((r) => ({ role: r.role, unit: toUnitRef(r.unit) }));
  return {
    kind: "user",
    userId,
    assignments,
    sessionId: session.sessionId,
    viaDemoSwitcher: session.viaDemoSwitcher,
    ...(session.sessionAgeHours !== undefined ? { sessionAgeHours: session.sessionAgeHours } : {}),
  };
}

export type CommandScope = {
  tx: Tx;
  ctx: AppContext;
  actor: Actor;
  now: Date;
  audit: (input: AuditInput) => Promise<void>;
  /** Audit a step performed by a different (system) actor inside the same transaction, e.g. system:policy. */
  auditAs: (actor: Actor, input: AuditInput) => Promise<void>;
};

/**
 * Runs a command in one transaction. If it throws a DomainError for authorization or an illegal
 * transition, the attempt itself is audited (in its own transaction) and the error rethrown.
 */
export async function runCommand<T>(
  ctx: AppContext,
  actor: Actor,
  operation: string,
  target: { entityType: string; entityId: string },
  fn: (scope: CommandScope) => Promise<T>,
): Promise<T> {
  const now = ctx.clock.now();
  const meta = { orgId: ctx.orgId, actor, occurredAt: now, requestId: ctx.requestId };
  try {
    return await ctx.db.transaction(async (tx) =>
      fn({
        tx,
        ctx,
        actor,
        now,
        audit: (input) => appendAudit(tx, meta, input),
        auditAs: (other, input) => appendAudit(tx, { ...meta, actor: other }, input),
      }),
    );
  } catch (err) {
    // Every refused attempt is on the record, including invalid ones (e.g. an unknown action type).
    if (
      err instanceof DomainError &&
      ["PermissionDenied", "NotAuthorized", "IllegalTransition", "Invalid"].includes(err.code)
    ) {
      await ctx.db.transaction((tx) =>
        appendAudit(tx, meta, { operation: `${operation}.denied`, ...target, reason: `${err.code}: ${err.message}` }),
      );
    }
    throw err;
  }
}
