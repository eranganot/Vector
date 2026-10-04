/**
 * The Phase 2 story end to end through application commands, against a real database and the
 * restricted app role, plus the "approval is never inferred" cases (authorization.md §5).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { verifyAuditChain } from "@/application/audit";
import { type AppContext, createContext, loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { recordDetection, type DetectionInput } from "@/application/commands/detection";
import {
  acceptDecision,
  amendAction,
  denyApproval,
  executeAction,
  grantApproval,
  runClockJobs,
} from "@/application/commands/lifecycle";
import { evaluateDueOutcomes, reviewOutcome } from "@/application/commands/outcomes";
import { getInsightTrace, listMyApprovals } from "@/application/queries/insights";
import { DomainError } from "@/domain/errors";
import { addDays } from "@/domain/calendar";
import type { Actor } from "@/domain/types";
import * as s from "@/infra/db/schema";
import { generateDay } from "@/infra/seed/generator";
import { UNITS } from "@/infra/seed/org";
import { seed, type SeedResult } from "@/infra/seed/seed";
import { setupDb } from "./helpers";

let owner: Pool;
let app: Pool;
let ownerDb: Db;
let appDb: Db;

beforeAll(async () => {
  const d = await setupDb();
  ({ owner, app } = d);
  ownerDb = d.ownerDb as Db;
  appDb = d.appDb as Db;
});
afterAll(async () => {
  await app.end();
  await owner.end();
});

async function at(orgId: string, iso: string): Promise<AppContext> {
  await ownerDb
    .update(s.demoClock)
    .set({ now: new Date(iso) })
    .where(eq(s.demoClock.orgId, orgId));
  return createContext(appDb, { orgId });
}
const person = (seedRes: SeedResult, key: string) =>
  loadUserActor(appDb, seedRes.orgId, seedRes.userIds[key], { sessionId: `sess-${key}`, viaDemoSwitcher: true });

function haifaDetection(r: SeedResult): DetectionInput {
  const u = r.unitIds;
  return {
    signal: {
      type: "kpi_deviation",
      source: "kpi_observation",
      detector: "kpi-deviation",
      detectorVersion: "1",
      observedAt: new Date("2026-10-22T05:00:00Z"),
      primaryUnitId: u["HFA-GC"],
      measurements: { kpi: "net_sales", change: -0.18, z: 2.8 },
      dedupeKey: `kpi_deviation:net_sales:${u["HFA-GC"]}`,
    },
    evidence: [
      {
        kind: "kpi_series",
        title: "Net sales, last 14 days",
        sourceRef: "kpi_observation",
        payload: { points: [1, 2, 3] },
      },
    ],
    insight: {
      title: "Haifa Grand Canyon net sales −18% week on week",
      whatHappened: "Net sales fell 18% versus the previous week.",
      whyItMatters: "About ₪220k of weekly sales at stake.",
      primaryUnitId: u["HFA-GC"],
      affectedUnitIds: [u["D-SUPPLY"]],
      confidence: 0.9,
      priority: {
        compliance: 0,
        z: 2.8,
        impactIls: 220_000,
        breadth: "isolated",
        hoursToImpact: null,
        strategicWeight: 0.8,
        confidence: 0.9,
      },
      generatedBy: "rule:kpi-deviation@1",
    },
    recommendation: {
      statement: "Transfer stock from Haifa Downtown to Haifa Grand Canyon",
      rationale: "OSA fell before sales did",
      actions: [
        {
          type: "inventory_transfer",
          title: "Transfer top-category stock Haifa Downtown → Grand Canyon",
          ownerUserId: r.userIds.noa,
          targetUnitIds: [u["HFA-GC"]],
          estimatedCost: 6000,
          params: { sourceUnitId: u["HFA-DT"] },
        },
        {
          type: "notify_owner",
          title: "Tell Avi stock is on the way",
          ownerUserId: r.userIds.avi,
          targetUnitIds: [u["HFA-GC"]],
          estimatedCost: 0,
          params: {},
        },
      ],
    },
  };
}

async function expectDenied(p: Promise<unknown>, code: RegExp) {
  await expect(p).rejects.toBeInstanceOf(DomainError);
  await expect(p).rejects.toThrow(code);
}

describe("Phase 2 story: Haifa sales drop, Signal → Outcome", () => {
  let r: SeedResult;
  let ctx: AppContext;
  let transferId: string;
  let notifyId: string;
  let insightId: string;

  beforeAll(async () => {
    r = await seed(ownerDb, { password: "test-password" });
    ctx = await at(r.orgId, "2026-10-22T05:00:00Z");
    const det = await recordDetection(ctx, haifaDetection(r));
    expect(det.outcome).toBe("created");
    insightId = det.insightId;
    [transferId, notifyId] = det.actionIds!;
  });

  it("creates an explained, prioritized insight with a VECTOR recommendation", async () => {
    const [ins] = await appDb.select().from(s.insight).where(eq(s.insight.id, insightId));
    expect(ins.status).toBe("open");
    expect(ins.priorityBand).toBe("P2");
    expect(ins.priorityModelVersion).toBe("priority-v2");
    const [dec] = await appDb.select().from(s.decision).where(eq(s.decision.insightId, insightId));
    expect(dec).toMatchObject({ status: "recommended", origin: "vector_recommended" });
  });

  it("read scope: Noa (affected department) and Tal (viewer) see it; Maya (Center) does not", async () => {
    expect(await getInsightTrace(appDb, r.orgId, await person(r, "noa"), insightId)).not.toBeNull();
    expect(await getInsightTrace(appDb, r.orgId, await person(r, "tal"), insightId)).not.toBeNull();
    expect(await getInsightTrace(appDb, r.orgId, await person(r, "maya"), insightId)).toBeNull();
  });

  it("Avi accepts; the transfer needs approval under AP-4, the notification does not", async () => {
    const dec = (await appDb.select().from(s.decision).where(eq(s.decision.insightId, insightId)))[0];
    await acceptDecision(ctx, await person(r, "avi"), dec.id, "Agree, stock is the cause");
    const acts = await appDb.select().from(s.action).where(eq(s.action.insightId, insightId));
    const transfer = acts.find((a) => a.id === transferId)!;
    expect(transfer.status).toBe("pending_approval");
    const req = transfer.approvalRequirement as { rules: { rule: string; matched: boolean }[] };
    expect(req.rules.filter((x) => x.matched).map((x) => x.rule)).toEqual(["AP-4"]);
    expect(acts.find((a) => a.id === notifyId)!.status).toBe("ready");
  });

  it("only Yossi's (and Dana's) inboxes show the request; Noa owns it so hers does not", async () => {
    expect((await listMyApprovals(appDb, r.orgId, await person(r, "yossi"))).map((x) => x.action.id)).toEqual([
      transferId,
    ]);
    expect(await listMyApprovals(appDb, r.orgId, await person(r, "noa"))).toHaveLength(0);
    expect(await listMyApprovals(appDb, r.orgId, await person(r, "avi"))).toHaveLength(0);
  });

  describe("approval is never inferred (authorization.md §5)", () => {
    it("§5.1 time passing alone (71 h) leaves it pending", async () => {
      const later = await at(r.orgId, "2026-10-25T04:00:00Z");
      await runClockJobs(later);
      const [a] = await appDb.select().from(s.action).where(eq(s.action.id, transferId));
      expect(a.status).toBe("pending_approval");
    });
    it("§5.2 viewing the trace and the inbox does not approve", async () => {
      await getInsightTrace(appDb, r.orgId, await person(r, "yossi"), insightId);
      await listMyApprovals(appDb, r.orgId, await person(r, "yossi"));
      const [a] = await appDb.select().from(s.action).where(eq(s.action.id, transferId));
      expect(a.status).toBe("pending_approval");
    });
    it("§5.4 the owner cannot approve their own action (AZ-2)", async () =>
      expectDenied(grantApproval(ctx, await person(r, "noa"), transferId), /AZ-2/));
    it("an ineligible manager cannot approve (Avi: branch scope; Maya: other region)", async () => {
      await expectDenied(grantApproval(ctx, await person(r, "avi"), transferId), /not eligible/);
      await expectDenied(grantApproval(ctx, await person(r, "maya"), transferId), /not eligible/);
    });
    it("admins and viewers cannot approve", async () => {
      await expectDenied(grantApproval(ctx, await person(r, "admin"), transferId), /no role grants action.approve/);
      await expectDenied(grantApproval(ctx, await person(r, "tal"), transferId), /no role grants action.approve/);
    });
    it("§5.8 a system actor cannot approve", async () =>
      expectDenied(grantApproval(ctx, { kind: "system", id: "system:policy" } as Actor, transferId), /only a person/));
    it("execution without an approval is refused", async () =>
      expectDenied(executeAction(ctx, transferId), /IllegalTransition|cannot execute/));
    it("every denied attempt is on the audit record", async () => {
      const denied = await appDb
        .select()
        .from(s.auditEvent)
        .where(and(eq(s.auditEvent.orgId, r.orgId), eq(s.auditEvent.entityId, transferId)));
      expect(denied.filter((e) => e.operation.endsWith(".denied")).length).toBeGreaterThanOrEqual(6);
    });
  });

  it("Yossi approves explicitly; it executes (simulated); the outcome watch starts", async () => {
    await grantApproval(ctx, await person(r, "yossi"), transferId, "Go ahead");
    const result = await executeAction(ctx, transferId);
    expect(result).toMatchObject({ executor: "internal_task", simulated: true });
    await executeAction(ctx, notifyId);
    const [o] = await appDb.select().from(s.outcome).where(eq(s.outcome.actionId, transferId));
    expect(o.status).toBe("observing");
    expect((o.baseline as { mean: number }).mean).toBeLessThan(92); // OSA was depressed before the transfer
  });

  it("after 7 days the evaluator finds it worked and the insight resolves itself", async () => {
    const branch = UNITS.find((x) => x.code === "HFA-GC")!;
    const [osa] = await appDb
      .select()
      .from(s.kpi)
      .where(and(eq(s.kpi.orgId, r.orgId), eq(s.kpi.code, "osa")));
    for (let i = 0; i < 7; i++) {
      const d = addDays("2026-10-23", i);
      await ownerDb.insert(s.kpiObservation).values({
        orgId: r.orgId,
        kpiId: osa.id,
        orgUnitId: r.unitIds["HFA-GC"],
        day: d,
        value: generateDay(branch, d, { p2s1TransferDay: "2026-10-22" }).osa,
        source: "synthetic:store-feed",
      });
    }
    const later = await at(r.orgId, "2026-10-30T06:00:00Z");
    const results = await evaluateDueOutcomes(later);
    expect(results).toEqual([expect.objectContaining({ verdict: "worked" })]);
    const [ins] = await appDb.select().from(s.insight).where(eq(s.insight.id, insightId));
    expect(ins.status).toBe("resolved");
    const [o] = await appDb.select().from(s.outcome).where(eq(s.outcome.actionId, transferId));
    await reviewOutcome(later, await person(r, "yossi"), o.id, {
      lesson: "Check DC routing changes against top categories",
    });
  });

  it("the audit chain verifies, and the story is reconstructable from it", async () => {
    const chain = await verifyAuditChain(appDb, r.orgId);
    expect(chain.ok).toBe(true);
    const trace = await getInsightTrace(appDb, r.orgId, await person(r, "dana"), insightId);
    const ops = trace!.audit.map((e) => e.operation);
    for (const op of [
      "insight.created",
      "decision.recommended",
      "action.proposed",
      "decision.decided",
      "action.submitted",
      "approval.requested",
      "approval.granted",
      "action.approved",
      "action.executed",
      "outcome.watch_started",
      "outcome.evaluated",
      "insight.resolved",
      "outcome.reviewed",
    ]) {
      expect(ops).toContain(op);
    }
    const granted = trace!.audit.find((e) => e.operation === "approval.granted")!;
    expect(granted).toMatchObject({ actorId: r.userIds.yossi, viaDemoSwitcher: true, sessionId: "sess-yossi" });
  });

  it("a forged audit row breaks chain verification", async () => {
    const { rows } = await owner.query("select max(seq)::int as m from audit_event where org_id = $1", [r.orgId]);
    await owner.query(
      `insert into audit_event (seq, org_id, occurred_at, actor_type, actor_id, operation, entity_type, entity_id, changes, request_id, prev_hash, hash)
       values ($1, $2, now(), 'user', 'mallory', 'approval.granted', 'approval', gen_random_uuid(), '{}', 'forged', '\\x00', '\\x00')`,
      [rows[0].m + 1, r.orgId],
    );
    expect((await verifyAuditChain(appDb, r.orgId)).ok).toBe(false);
  });
});

describe("approval lifecycle edge cases", () => {
  async function pending() {
    const r = await seed(ownerDb, { password: "test-password" });
    const ctx = await at(r.orgId, "2026-10-22T05:00:00Z");
    const det = await recordDetection(ctx, haifaDetection(r));
    const [dec] = await appDb.select().from(s.decision).where(eq(s.decision.insightId, det.insightId));
    await acceptDecision(ctx, await person(r, "avi"), dec.id);
    return { r, ctx, transferId: det.actionIds![0] };
  }

  it("§5.1 after 72 h the request expires and the action returns to proposed; it cannot be granted any more", async () => {
    const { r, transferId } = await pending();
    const later = await at(r.orgId, "2026-10-25T06:00:00Z");
    expect(await runClockJobs(later)).toEqual({ expired: 1, lapsed: 0 });
    const [a] = await appDb.select().from(s.action).where(eq(s.action.id, transferId));
    expect(a.status).toBe("proposed");
    await expectDenied(grantApproval(later, await person(r, "yossi"), transferId), /no open approval/);
  });

  it("§5.7 changing the action withdraws the approval and requests a new one", async () => {
    const { r, ctx, transferId } = await pending();
    await grantApproval(ctx, await person(r, "yossi"), transferId);
    await amendAction(ctx, await person(r, "yossi"), transferId, { estimatedCost: 12_000 });
    const aps = await appDb.select().from(s.approval).where(eq(s.approval.actionId, transferId));
    expect(aps.map((x) => x.status).sort()).toEqual(["requested", "withdrawn"]);
    const [a] = await appDb.select().from(s.action).where(eq(s.action.id, transferId));
    expect(a).toMatchObject({ status: "pending_approval", revision: 2 });
    const rules = (a.approvalRequirement as { rules: { rule: string; matched: boolean }[] }).rules
      .filter((x) => x.matched)
      .map((x) => x.rule);
    expect(rules).toEqual(["AP-3", "AP-4"]); // ₪12k now also needs AP-3
  });

  it("a granted approval lapses after 7 days unused and must be requested again", async () => {
    const { r, ctx, transferId } = await pending();
    await grantApproval(ctx, await person(r, "yossi"), transferId);
    const later = await at(r.orgId, "2026-10-29T06:00:00Z");
    expect(await runClockJobs(later)).toEqual({ expired: 0, lapsed: 1 });
    await expectDenied(executeAction(later, transferId), /IllegalTransition|cannot execute/);
  });

  it("denying requires a rationale and rejects the action", async () => {
    const { r, ctx, transferId } = await pending();
    await expectDenied(denyApproval(ctx, await person(r, "yossi"), transferId, ""), /rationale/);
    await denyApproval(ctx, await person(r, "yossi"), transferId, "Downtown can't spare it this week");
    const [a] = await appDb.select().from(s.action).where(eq(s.action.id, transferId));
    expect(a.status).toBe("rejected");
  });

  it("a repeated detection attaches to the open insight instead of duplicating it", async () => {
    const { r, ctx } = await pending();
    const again = await recordDetection(ctx, haifaDetection(r));
    expect(again.outcome).toBe("attached");
    const all = await appDb.select().from(s.insight).where(eq(s.insight.orgId, r.orgId));
    expect(all).toHaveLength(1);
  });
});
