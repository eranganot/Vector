import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { HISTORY_DAYS } from "@/infra/seed/org";
import { seed } from "@/infra/seed/seed";
import { reseedReason } from "@/infra/seed/reseed";
import type { Db } from "@/application/db";
import { setupDb } from "./helpers";

let owner: Pool;
let app: Pool;
let ownerDb: Awaited<ReturnType<typeof setupDb>>["ownerDb"];

beforeAll(async () => {
  ({ owner, app, ownerDb } = await setupDb());
});
afterAll(async () => {
  await app.end();
  await owner.end();
});

describe("seed", () => {
  it("creates a new active epoch and deactivates previous ones without deleting them", async () => {
    const first = await seed(ownerDb, { password: "test-password" });
    const second = await seed(ownerDb, { password: "test-password" });
    const orgs = await owner.query("select id, is_active from organization where id = any($1)", [
      [first.orgId, second.orgId],
    ]);
    expect(orgs.rows.find((r) => r.id === first.orgId)?.is_active).toBe(false);
    expect(orgs.rows.find((r) => r.id === second.orgId)?.is_active).toBe(true);
    expect(second.userIds.dana).toBe(first.userIds.dana); // people persist across epochs
    const obs = await owner.query("select count(*)::int as n from kpi_observation where org_id = $1", [second.orgId]);
    // 60 branches × 6 branch KPIs + 10 department KPIs, every day of the history (52 weeks since E1c)
    expect(obs.rows[0].n).toBe((60 * 6 + 10) * HISTORY_DAYS);
  });
});

describe("audit_event integrity (ADR-004)", () => {
  async function insertAuditRow(orgId: string) {
    const id = randomUUID();
    await owner.query(
      `insert into audit_event (id, seq, org_id, occurred_at, actor_type, actor_id, operation, entity_type, entity_id, changes, request_id, prev_hash, hash)
       values ($1, (select coalesce(max(seq),0)+1 from audit_event where org_id=$2), $2, now(), 'system', 'system:test', 'test.row', 'test', $1, '{}', 'req', '\\x00', '\\x01')`,
      [id, orgId],
    );
    return id;
  }

  it("the app role cannot UPDATE, DELETE or TRUNCATE audit rows", async () => {
    const { orgId } = await seed(ownerDb, { password: "test-password" });
    const id = await insertAuditRow(orgId);
    await expect(app.query("update audit_event set reason = 'x' where id = $1", [id])).rejects.toThrow(
      /permission denied/,
    );
    await expect(app.query("delete from audit_event where id = $1", [id])).rejects.toThrow(/permission denied/);
    await expect(app.query("truncate audit_event")).rejects.toThrow(/permission denied/);
  });

  it("even the owner cannot UPDATE, DELETE or TRUNCATE audit rows", async () => {
    const { orgId } = await seed(ownerDb, { password: "test-password" });
    const id = await insertAuditRow(orgId);
    await expect(owner.query("update audit_event set reason = 'x' where id = $1", [id])).rejects.toThrow(/append-only/);
    await expect(owner.query("delete from audit_event where id = $1", [id])).rejects.toThrow(/append-only/);
    await expect(owner.query("truncate audit_event")).rejects.toThrow(/append-only/);
  });

  it("the app role can still read and write domain tables", async () => {
    const r = await app.query("select count(*)::int as n from organization");
    expect(r.rows[0].n).toBeGreaterThan(0);
  });
});

describe("boot-time reseed decision (regression: Prod persona sign-in failed after secrets were rotated)", () => {
  it("reseeds when SEED_USER_PASSWORD no longer matches the seeded people, and not otherwise", async () => {
    const { ownerDb, owner, app } = await setupDb();
    try {
      await seed(ownerDb as Db, { password: "first-password" });
      expect(await reseedReason(ownerDb as Db, "first-password")).toBeNull();
      expect(await reseedReason(ownerDb as Db, "rotated-password")).toMatch(/SEED_USER_PASSWORD changed/);
      await seed(ownerDb as Db, { password: "rotated-password" });
      expect(await reseedReason(ownerDb as Db, "rotated-password")).toBeNull();
    } finally {
      await app.end();
      await owner.end();
    }
  });
});
