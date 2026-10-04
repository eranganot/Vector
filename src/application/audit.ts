/**
 * Audit writer (ADR-004). Appends one hash-chained row per state change, inside the caller's
 * transaction, serialized per org with a transaction-scoped advisory lock.
 */
import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { auditEvent } from "@/infra/db/schema";
import type { Actor } from "@/domain/types";
import type { DbOrTx, Tx } from "./db";

export type AuditInput = {
  operation: string;
  entityType: string;
  entityId: string;
  fromState?: string | null;
  toState?: string | null;
  reason?: string | null;
  changes?: Record<string, unknown>;
  policy?: unknown;
  evidenceIds?: string[];
};

export type AuditMeta = { orgId: string; actor: Actor; occurredAt: Date; requestId: string };

/** Deterministic JSON: object keys sorted recursively. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

export const GENESIS_HASH: Buffer = Buffer.alloc(32, 0);

/** The fields covered by the hash, in a fixed shape. recorded_at is excluded (set by the DB). */
export function hashedFields(row: {
  seq: number;
  orgId: string;
  occurredAt: Date;
  actorType: string;
  actorId: string;
  sessionId: string | null;
  viaDemoSwitcher: boolean;
  operation: string;
  entityType: string;
  entityId: string;
  fromState: string | null;
  toState: string | null;
  reason: string | null;
  changes: unknown;
  policy: unknown;
  evidenceIds: string[];
  aiGenerationId: string | null;
  requestId: string;
}) {
  // Pick fields explicitly: a full DB row also carries id, hash, prev_hash and recorded_at, which are not hashed.
  return canonicalJson({
    seq: Number(row.seq),
    orgId: row.orgId,
    occurredAt: row.occurredAt.toISOString(),
    actorType: row.actorType,
    actorId: row.actorId,
    sessionId: row.sessionId,
    viaDemoSwitcher: row.viaDemoSwitcher,
    operation: row.operation,
    entityType: row.entityType,
    entityId: row.entityId,
    fromState: row.fromState,
    toState: row.toState,
    reason: row.reason,
    changes: row.changes,
    policy: row.policy,
    evidenceIds: row.evidenceIds,
    aiGenerationId: row.aiGenerationId,
    requestId: row.requestId,
  });
}

export function chainHash(prevHash: Buffer, fields: string): Buffer {
  return createHash("sha256").update(prevHash).update(fields).digest();
}

export async function appendAudit(tx: Tx, meta: AuditMeta, input: AuditInput): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${meta.orgId}))`);
  const [last] = await tx
    .select({ seq: auditEvent.seq, hash: auditEvent.hash })
    .from(auditEvent)
    .where(eq(auditEvent.orgId, meta.orgId))
    .orderBy(desc(auditEvent.seq))
    .limit(1);
  const actor = meta.actor;
  const row = {
    seq: (last?.seq ?? 0) + 1,
    orgId: meta.orgId,
    occurredAt: meta.occurredAt,
    actorType: actor.kind,
    actorId: actor.kind === "user" ? actor.userId : actor.id,
    sessionId: actor.kind === "user" ? actor.sessionId : null,
    viaDemoSwitcher: actor.kind === "user" ? actor.viaDemoSwitcher : false,
    operation: input.operation,
    entityType: input.entityType,
    entityId: input.entityId,
    fromState: input.fromState ?? null,
    toState: input.toState ?? null,
    reason: input.reason ?? null,
    changes: input.changes ?? {},
    policy: input.policy ?? null,
    evidenceIds: input.evidenceIds ?? [],
    aiGenerationId: null,
    requestId: meta.requestId,
  };
  const prevHash = last?.hash ?? GENESIS_HASH;
  const hash = chainHash(prevHash, hashedFields(row));
  await tx.insert(auditEvent).values({ ...row, prevHash, hash });
}

/** Verifies an org's whole chain. Returns the first broken seq, if any. */
export async function verifyAuditChain(
  db: DbOrTx,
  orgId: string,
): Promise<{ ok: boolean; count: number; brokenAt?: number }> {
  const rows = await db
    .select()
    .from(auditEvent)
    .where(and(eq(auditEvent.orgId, orgId)))
    .orderBy(auditEvent.seq);
  let prev: Buffer = GENESIS_HASH;
  for (const [i, r] of rows.entries()) {
    const expected = chainHash(prev, hashedFields({ ...r, policy: r.policy ?? null, changes: r.changes }));
    if (r.seq !== i + 1 || !r.prevHash.equals(prev) || !r.hash.equals(expected))
      return { ok: false, count: rows.length, brokenAt: r.seq };
    prev = r.hash;
  }
  return { ok: true, count: rows.length };
}
