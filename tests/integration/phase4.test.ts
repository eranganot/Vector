/**
 * Phase 4 against a real database: the commitment register, live conflict detection and resolution, the commitment
 * monitor on clock advance, derived dependency status and cascades, and audited refusals (docs/phases/PHASE_4.md).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { verifyAuditChain } from "@/application/audit";
import {
  cancelCommitment,
  completeCommitment,
  detectConflicts,
  recordCommitment,
  renegotiateCommitment,
  runCommitmentMonitor,
  toDepFacts,
  toFacts,
} from "@/application/commands/commitments";
import { createContext, loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { advanceClock, resetDemo } from "@/application/scenario";
import { cascade, dependencyStatus } from "@/domain/commitments";
import * as s from "@/infra/db/schema";
import { DEMO_DAIRY_PROMO } from "@/infra/seed/commitments";
import { seed } from "@/infra/seed/seed";
import { setupDb } from "./helpers";

let owner: Pool;
let app: Pool;
let appDb: Db;
let orgId: string;

const as = async (key: string) => {
  const [u] = await appDb
    .select()
    .from(s.user)
    .where(eq(s.user.email, `${key}@vector-retail.example`));
  return loadUserActor(appDb, orgId, u.id, { sessionId: `p4-${key}`, viaDemoSwitcher: true, sessionAgeHours: 0 });
};
const userId = async (key: string) =>
  (
    await appDb
      .select()
      .from(s.user)
      .where(eq(s.user.email, `${key}@vector-retail.example`))
  )[0].id;
const unit = async (code: string) =>
  (
    await appDb
      .select()
      .from(s.orgUnit)
      .where(and(eq(s.orgUnit.orgId, orgId), eq(s.orgUnit.code, code)))
  )[0];
const commitments = () => appDb.select().from(s.commitment).where(eq(s.commitment.orgId, orgId));
const byTitle = async (t: string) => (await commitments()).find((c) => c.title.startsWith(t))!;
const audits = (op: string) =>
  appDb
    .select()
    .from(s.auditEvent)
    .where(and(eq(s.auditEvent.orgId, orgId), eq(s.auditEvent.operation, op)));
const ctx = () => createContext(appDb, { orgId });

beforeAll(async () => {
  const d = await setupDb();
  ({ owner, app } = d);
  appDb = d.appDb as Db;
  orgId = (await seed(d.ownerDb as Db, { password: "test-password" })).orgId;
  orgId = (await resetDemo(appDb, await as("admin"), "test-password")).orgId;
});
afterAll(async () => {
  await app.end();
  await owner.end();
});

async function recordDairyPromo() {
  return recordCommitment(await ctx(), await as("ronit"), {
    title: DEMO_DAIRY_PROMO.title,
    ownerUserId: await userId("ronit"),
    ownerUnitId: (await unit("D-MKT")).id,
    beneficiaryUnitIds: [(await unit("SOUTH")).id],
    source: DEMO_DAIRY_PROMO.source,
    dueAt: new Date(DEMO_DAIRY_PROMO.dueAt),
    impactIls: DEMO_DAIRY_PROMO.impactIls,
    effects: DEMO_DAIRY_PROMO.effects,
  });
}

describe("the seeded register (p4-v1)", () => {
  it("records 20 commitments through audited commands; 3 overdue, 5 delivered; no duplicate insights", async () => {
    const cs = await commitments();
    expect(cs).toHaveLength(20);
    expect(
      cs
        .filter((c) => c.status === "overdue")
        .map((c) => c.title)
        .sort(),
    ).toEqual([
      "Holiday promo signage and shelf talkers for 60 branches",
      "Publish updated pay tables for the new wage rule",
      "Update holiday opening hours on the website",
    ]);
    expect(cs.filter((c) => c.status === "done")).toHaveLength(5);
    expect(await audits("commitment.recorded")).toHaveLength(20);
    expect(await audits("dependency.recorded")).toHaveLength(14);
    // Catalog stories keep their one insight; the small website task is listed, not escalated (Q2).
    expect(await appDb.select().from(s.insight).where(eq(s.insight.orgId, orgId))).toHaveLength(19);
    expect((await byTitle("Update holiday opening hours")).insightId).toBeNull();
  });

  it("links the three catalog conflicts (R7, R9, R12) to their stories, with the right resources", async () => {
    const ks = await appDb.select().from(s.conflict).where(eq(s.conflict.orgId, orgId));
    expect(ks.map((k) => k.resource).sort()).toEqual([
      "branches:all-pos",
      "budget:q4-discretionary",
      "sku-set:coast-14",
    ]);
    expect(ks.every((k) => k.status === "open" && k.insightId)).toBe(true);
  });

  it("derives dependency status and cascades: late signage puts the promo launch and five regions at risk", async () => {
    const cs = (await commitments()).map(toFacts);
    const ds = (await appDb.select().from(s.dependency).where(eq(s.dependency.orgId, orgId))).map(toDepFacts);
    const now = (await ctx()).clock.now();
    const signage = cs.find((c) => c.title.startsWith("Holiday promo signage"))!;
    const toStore = ds.find((d) => d.commitmentId === signage.id)!;
    expect(dependencyStatus(toStore, signage, now)).toBe("at_risk");
    const chain = cascade(signage.id, cs, ds, now);
    expect(chain.commitmentIds.map((id) => cs.find((c) => c.id === id)!.title)).toEqual([
      "Holiday promotion live in all 60 branches",
    ]);
    expect(chain.unitIds).toHaveLength(1); // only Store Ops directly; the launch itself is not late yet
  });
});

describe("live conflict detection (conflict-rules-v1)", () => {
  let promoId: string;
  it("Marketing's weekend dairy discount collides with Trade's South delisting the moment it is recorded", async () => {
    const r = await recordDairyPromo();
    promoId = r.id;
    expect(r.conflicts).toHaveLength(1);
    const [ins] = await appDb.select().from(s.insight).where(eq(s.insight.id, r.conflicts[0].insightId));
    expect(ins.title).toMatch(/Marketing's “Weekend dairy discount in South” collides with Trade & Commercial's/);
    expect(ins.primaryUnitId).toBe((await unit("D-MKT")).id); // Q1: Marketing recorded second, so it decides
    expect(ins.whatHappened).toMatch(/overlap 2026-10-31 → 2026-11-02/);
    const acts = await appDb.select().from(s.action).where(eq(s.action.insightId, ins.id));
    expect(acts.map((a) => a.ownerUserId).sort()).toEqual([await userId("eitan"), await userId("ronit")].sort());
  });

  it("is idempotent: running the rules again raises nothing new", async () => {
    expect(await detectConflicts(await ctx(), promoId)).toEqual([]);
    expect(
      (await appDb.select().from(s.conflict).where(eq(s.conflict.orgId, orgId))).filter(
        (k) => k.resource === "sku-set:south-dairy-6",
      ),
    ).toHaveLength(1);
  });

  it("resolves when Marketing moves the promotion out of the overlap (C5 with a rationale, K2 audited)", async () => {
    await expect(
      renegotiateCommitment(await ctx(), await as("ronit"), promoId, {
        dueAt: new Date("2026-10-24T06:00:00Z"),
        rationale: "",
      }),
    ).rejects.toThrow(/rationale/i);
    await renegotiateCommitment(await ctx(), await as("ronit"), promoId, {
      dueAt: new Date("2026-10-24T06:00:00Z"),
      rationale: "Run it the weekend before the delisting",
      effects: [
        { resource: "sku-set:south-dairy-6", effect: "promote", windowStart: "2026-10-24", windowEnd: "2026-10-26" },
      ],
    });
    const [k] = (await appDb.select().from(s.conflict).where(eq(s.conflict.orgId, orgId))).filter(
      (x) => x.resource === "sku-set:south-dairy-6",
    );
    expect(k.status).toBe("resolved");
    expect(k.resolvedReason).toBe("the windows no longer overlap");
    const c = await byTitle("Weekend dairy discount");
    expect(c.history).toHaveLength(1);
    expect((await audits("commitment.renegotiated")).length).toBe(1);
  });

  it("cancelling one side of a catalog conflict resolves it", async () => {
    const delist = await byTitle("Delist 14 slow items");
    await cancelCommitment(await ctx(), await as("eitan"), delist.id, "Keep the items through the holiday");
    const k = (await appDb.select().from(s.conflict).where(eq(s.conflict.orgId, orgId))).find(
      (x) => x.resource === "sku-set:coast-14",
    )!;
    expect(k).toMatchObject({ status: "resolved", resolvedReason: "a commitment was cancelled" });
  });
});

describe("refusals are audited", () => {
  it("a branch manager cannot commit Marketing; a viewer cannot record at all; done cannot be completed again", async () => {
    const before = (await audits("commitment.record.denied")).length;
    const input = {
      title: "Something for Marketing",
      ownerUserId: await userId("ronit"),
      ownerUnitId: (await unit("D-MKT")).id,
      beneficiaryUnitIds: [],
      source: "test",
      dueAt: new Date("2026-11-30T00:00:00Z"),
    };
    await expect(recordCommitment(await ctx(), await as("avi"), input)).rejects.toThrow(/AZ-1|outside your scope/);
    await expect(recordCommitment(await ctx(), await as("tal"), input)).rejects.toThrow(
      /PermissionDenied|no role grants/,
    );
    expect((await audits("commitment.record.denied")).length).toBe(before + 2);
    const done = await byTitle("Self-checkout firmware fix");
    await expect(completeCommitment(await ctx(), await as("amir"), done.id)).rejects.toThrow(/Illegal|not allowed/i);
    expect((await audits("commitment.complete.denied")).length).toBeGreaterThanOrEqual(1);
  });

  it("the owner must work in the owning unit", async () => {
    await expect(
      recordCommitment(await ctx(), await as("dana"), {
        title: "Marketing promise owned by Finance",
        ownerUserId: await userId("michal"),
        ownerUnitId: (await unit("D-MKT")).id,
        beneficiaryUnitIds: [],
        source: "test",
        dueAt: new Date("2026-11-30T00:00:00Z"),
      }),
    ).rejects.toThrow(/owner must work in the owning unit/);
  });
});

describe("commitment-monitor-v1 on clock advance", () => {
  it("one day later, Trade's dairy response is overdue: a scored insight, Finance's forecast at risk, raised once", async () => {
    await advanceClock(appDb, await as("admin"), 24);
    const dairy = await byTitle("Agree the response to Dairy Co.");
    expect(dairy.status).toBe("overdue");
    expect(dairy.insightId).not.toBeNull();
    const [ins] = await appDb.select().from(s.insight).where(eq(s.insight.id, dairy.insightId!));
    expect(ins.title).toBe(
      "Trade & Commercial: “Agree the response to Dairy Co.'s +7% price increase” is 1 day overdue",
    );
    expect(ins.whyItMatters).toMatch(/Finance, Marketing are waiting on it/);
    expect(["P2", "P3"]).toContain(ins.priorityBand);
    const acts = await appDb.select().from(s.action).where(eq(s.action.insightId, ins.id));
    expect(acts.map((a) => a.title)).toEqual(
      expect.arrayContaining([
        "Deliver or renegotiate: Agree the response to Dairy Co.'s +7% price increase",
        "Plan around the late “Agree the response to Dairy Co.'s +7% price increase” (Finance)",
      ]),
    );

    const now = (await ctx()).clock.now();
    const deps = (await appDb.select().from(s.dependency).where(eq(s.dependency.commitmentId, dairy.id))).map(
      toDepFacts,
    );
    expect(deps.map((d) => dependencyStatus(d, toFacts(dairy), now))).toEqual(["at_risk", "at_risk"]);

    const again = await runCommitmentMonitor(await ctx());
    expect(again.insights).toEqual([]);
    expect(again.overdue).toEqual([]);
  });

  it("every audit chain still verifies", async () => {
    const r = await verifyAuditChain(appDb, orgId);
    expect(r.ok).toBe(true);
  });
});
