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
import { listMyDecisions } from "@/application/queries/insights";
import { commitmentsForInsight, commitmentsView } from "@/application/queries/commitments";
import { actionsView, outcomesView } from "@/application/queries/actions";
import { auditExplorer } from "@/application/queries/audit";
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

describe("commitments read model (scope, both directions, bottlenecks)", () => {
  it("the CEO sees every commitment; the top bottleneck is the unit others wait on most (₪)", async () => {
    const v = (await commitmentsView(appDb, orgId, await as("dana")))!;
    expect(v.scope.name).toBe("VECTOR Retail Group");
    expect(v.owe.length + v.overdue.length).toBeGreaterThan(10);
    // One day in: Marketing's overdue signage holds ₪300k/week (Store Ops); HR's pay tables ₪120k. The North DC
    // recovery is due in an hour but not late yet, so Supply Chain is not a bottleneck.
    expect(v.bottlenecks.map((b) => b.unitName).slice(0, 2)).toEqual(["Marketing", "HR"]);
    expect(v.summary.onTimeRate).not.toBeNull();
    // The CEO is not offered the owners' buttons (cosmetic; the command allows her).
    expect([...v.owe, ...v.overdue].every((c) => !c.canUpdate)).toBe(true);
    // Q3: the level above may move a department's due date (the CEO is the level above every department).
    const mkt = [...v.owe, ...v.overdue].filter((c) => c.ownerUnitName === "Marketing" && c.status !== "done");
    expect(mkt.length).toBeGreaterThan(0);
    expect(mkt.every((c) => c.canRenegotiate)).toBe(true);
  });

  it("Finance waits on HR and Trade; Marketing's own promises are not shown to Finance as 'owed'", async () => {
    // ADR-008: the CFO's default scope is the whole group; Finance's own view is one click away (?unit).
    const michal = await as("michal");
    expect((await commitmentsView(appDb, orgId, michal))!.scope.name).toBe("VECTOR Retail Group");
    const v = (await commitmentsView(appDb, orgId, michal, (await unit("D-FIN")).id))!;
    expect(v.waitingOn.map((d) => d.ownerUnitName).sort()).toEqual(["HR", "Trade & Commercial"]);
    expect(v.owed.map((c) => c.title)).not.toContain("Holiday promo signage and shelf talkers for 60 branches");
    const dairy = v.waitingOn.find((d) => d.ownerUnitName === "Trade & Commercial")!;
    expect(dairy.status).toBe("at_risk");
  });

  it("owners get their buttons; a branch manager does not see other units' promises", async () => {
    const ronit = (await commitmentsView(appDb, orgId, await as("ronit")))!;
    expect(
      [...ronit.owe, ...ronit.overdue].filter((c) => c.ownerUnitName === "Marketing").every((c) => c.canUpdate),
    ).toBe(true);
    const avi = (await commitmentsView(appDb, orgId, await as("avi")))!;
    const titles = [...avi.owe, ...avi.owed, ...avi.overdue, ...avi.delivered].map((c) => c.title);
    expect(titles).not.toContain("Holiday promo signage and shelf talkers for 60 branches");
    expect(titles).toContain("Replenishment request to the North DC (Haifa Grand Canyon)");
    // A unit outside your scope looks missing.
    expect(await commitmentsView(appDb, orgId, await as("avi"), (await unit("D-MKT")).id)).toBeNull();
  });

  it("an insight's trace shows the plans behind it, only to those who may read them", async () => {
    const r7 = (await appDb.select().from(s.insight).where(eq(s.insight.orgId, orgId))).find((i) =>
      i.title.startsWith("Finance spend freeze"),
    )!;
    const forMichal = (await commitmentsForInsight(appDb, orgId, await as("michal"), r7.id))!;
    expect(forMichal.commitments.map((c) => c.title).sort()).toEqual([
      "Freeze Q4 discretionary spend",
      "Q4 campaign: ₪350k media and in-store",
    ]);
    expect(forMichal.conflicts).toHaveLength(1);
    const forAvi = (await commitmentsForInsight(appDb, orgId, await as("avi"), r7.id))!;
    expect(forAvi.commitments).toHaveLength(0);
  });
});

describe("action and outcome tracking (P4f)", () => {
  it("lists only actions the viewer may read; filters agree with the counts", async () => {
    const dana = await actionsView(appDb, orgId, await as("dana"), "all");
    const avi = await actionsView(appDb, orgId, await as("avi"), "all");
    expect(dana.actions.length).toBeGreaterThan(avi.actions.length);
    expect(avi.actions.every((a) => !/promo signage|Q4 campaign/i.test(a.insightTitle))).toBe(true);
    const approval = await actionsView(appDb, orgId, await as("dana"), "approval");
    expect(approval.actions.every((a) => a.status === "pending_approval")).toBe(true);
    expect(approval.actions).toHaveLength(dana.counts.approval);
    const overdue = await actionsView(appDb, orgId, await as("dana"), "overdue");
    expect(overdue.actions.every((a) => a.overdue)).toBe(true);
  });

  it("outcomes are empty until something has executed and been measured", async () => {
    const o = await outcomesView(appDb, orgId, await as("dana"));
    expect(o.toReview.length + o.reviewed.length).toBe(0);
  });
});

describe("scoped audit explorer (P4g)", () => {
  it("the Executive sees organization events; a branch manager sees his branch's story, his own refusals, not Marketing's", async () => {
    const dana = (await auditExplorer(appDb, orgId, await as("dana")))!;
    expect(dana.groupWide).toBe(true);
    expect(dana.events.some((e) => e.operation === "demo.clock_advanced")).toBe(true);

    const avi = (await auditExplorer(appDb, orgId, await as("avi"), { limit: 10_000 }))!;
    expect(avi.groupWide).toBe(false);
    expect(avi.events.some((e) => /Haifa Grand Canyon net sales/.test(e.subject))).toBe(true);
    expect(avi.events.some((e) => e.operation === "demo.clock_advanced")).toBe(false);
    expect(avi.events.some((e) => /promo signage/i.test(e.subject))).toBe(false);
    // His refused attempt to commit Marketing (earlier in this file) is his own: he sees it.
    expect(avi.events.some((e) => e.operation === "commitment.record.denied" && e.actor === "Avi Mizrahi")).toBe(true);
    expect(avi.total).toBeLessThan(dana.total);
  });

  it("filters: refusals only, by operation, by actor; viewers have no audit access", async () => {
    const denied = (await auditExplorer(appDb, orgId, await as("dana"), { denied: true }))!;
    expect(denied.events.length).toBeGreaterThan(0);
    expect(denied.events.every((e) => e.operation.endsWith(".denied"))).toBe(true);
    const conflicts = (await auditExplorer(appDb, orgId, await as("dana"), { op: "conflict." }))!;
    expect(conflicts.events.every((e) => e.operation.startsWith("conflict."))).toBe(true);
    const ronitId = await userId("ronit");
    const byRonit = (await auditExplorer(appDb, orgId, await as("dana"), { actor: ronitId }))!;
    expect(byRonit.events.every((e) => e.actor === "Ronit Shapiro")).toBe(true);
    expect(await auditExplorer(appDb, orgId, await as("tal"))).toBeNull();
  });
});

describe("Q1 escalation of undecided conflicts (Eran, 2026-10-05)", () => {
  it("48 h after detection, undecided conflicts move to the common manager (the CEO for two departments), once", async () => {
    const r7 = (await appDb.select().from(s.insight).where(eq(s.insight.orgId, orgId))).find((i) =>
      i.title.startsWith("Finance spend freeze"),
    )!;
    expect((await listMyDecisions(appDb, orgId, await as("michal"))).map((d) => d.insightId)).toContain(r7.id);
    await advanceClock(appDb, await as("admin"), 24); // 48 h since the seed detected it
    const ks = await appDb.select().from(s.conflict).where(eq(s.conflict.orgId, orgId));
    const escalated = ks.filter((k) => k.escalatedAt);
    // R7 and R9 are still undecided; R12 and the dairy conflict were resolved earlier in this file.
    expect(escalated.map((k) => k.resource).sort()).toEqual(["branches:all-pos", "budget:q4-discretionary"]);
    const group = await unit("GROUP");
    expect(escalated.every((k) => k.escalatedToUnitId === group.id)).toBe(true);
    const [after] = await appDb.select().from(s.insight).where(eq(s.insight.id, r7.id));
    expect(after.primaryUnitId).toBe(group.id);
    expect((await listMyDecisions(appDb, orgId, await as("dana"))).map((d) => d.insightId)).toContain(r7.id);
    expect((await listMyDecisions(appDb, orgId, await as("michal"))).map((d) => d.insightId)).not.toContain(r7.id);
    expect(await audits("conflict.escalated")).toHaveLength(2);
    // Idempotent: the next run escalates nothing.
    expect((await runCommitmentMonitor(await ctx())).escalated).toEqual([]);
  });
});
