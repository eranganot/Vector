/**
 * Demo scenario engine (demo.control only). Advances the demo clock, generates the KPI data for the
 * days that elapse (so outcomes depend on what was actually decided and executed), runs the clock
 * jobs, the outcome evaluator and the detector, and resets the demo into a fresh organization epoch.
 */
import { CATALOG } from "@/infra/seed/catalog";
import { runCommitmentMonitor } from "./commands/commitments";
import { seedCommitments } from "./commitments-seed";
import { seedInitiatives } from "./initiatives-seed";
import { and, eq, inArray } from "drizzle-orm";
import { addDays } from "@/domain/calendar";
import { DomainError } from "@/domain/errors";
import { assertAuthorized, authorizeUser } from "@/domain/policy/authorize";
import type { Actor } from "@/domain/types";
import { action, demoClock, finActual, kpi, kpiObservation, orgUnit } from "@/infra/db/schema";
import { financeHistory } from "@/infra/seed/finance";
import { generateDay, generateDepartmentDay, P2S1, type Interventions } from "@/infra/seed/generator";
import { SEED_VERSION, UNITS } from "@/infra/seed/org";
import { seed } from "@/infra/seed/seed";
import { appendAudit } from "./audit";
import { evaluateDueOutcomes } from "./commands/outcomes";
import { executeReadyActions, runClockJobs } from "./commands/lifecycle";
import { createContext, type AppContext } from "./context";
import type { Db } from "./db";
import { seedCatalog } from "./catalog";
import { runDetector } from "./detector";

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/** What the organization actually did that the synthetic world reacts to. */
async function interventions(ctx: AppContext): Promise<Interventions> {
  const [gc] = await ctx.db
    .select()
    .from(orgUnit)
    .where(and(eq(orgUnit.orgId, ctx.orgId), eq(orgUnit.code, P2S1.branch)));
  const executed = await ctx.db
    .select()
    .from(action)
    .where(
      and(eq(action.orgId, ctx.orgId), eq(action.type, "inventory_transfer"), inArray(action.status, ["executed"])),
    );
  const transfer = executed.find((a) => gc && a.targetUnitIds.includes(gc.id));
  return transfer ? { p2s1TransferDay: dayOf(transfer.updatedAt) } : {};
}

/** Writes observations for every branch for each day in [fromDay, toDay). Idempotent. */
async function generateDays(ctx: AppContext, fromDay: string, toDay: string) {
  const iv = await interventions(ctx);
  const units = await ctx.db
    .select()
    .from(orgUnit)
    .where(and(eq(orgUnit.orgId, ctx.orgId), eq(orgUnit.type, "branch")));
  const allKpis = await ctx.db.select().from(kpi).where(eq(kpi.orgId, ctx.orgId));
  const kpis = allKpis.filter((k) => k.level === "branch");
  const rows: (typeof kpiObservation.$inferInsert)[] = [];
  for (let d = fromDay; d < toDay; d = addDays(d, 1)) {
    for (const k of allKpis.filter((x) => x.level === "department" && x.ownerDepartmentId)) {
      rows.push({
        orgId: ctx.orgId,
        kpiId: k.id,
        orgUnitId: k.ownerDepartmentId!,
        day: d,
        value: generateDepartmentDay(k.code, d),
        source: "synthetic:department-feed",
      });
    }
    for (const u of units) {
      const seedUnit = UNITS.find((x) => x.code === u.code);
      if (!seedUnit) continue;
      const v = generateDay(seedUnit, d, iv);
      for (const k of kpis) {
        rows.push({
          orgId: ctx.orgId,
          kpiId: k.id,
          orgUnitId: u.id,
          day: d,
          value: v[k.code as keyof typeof v],
          source: "synthetic:store-feed",
        });
      }
    }
  }
  if (rows.length) await ctx.db.insert(kpiObservation).values(rows).onConflictDoNothing();
  // Money lines for the same days (plan v2, E2): the finance feed keeps pace with the store feed.
  if (fromDay < toDay) {
    const all = await ctx.db.select().from(orgUnit).where(eq(orgUnit.orgId, ctx.orgId));
    const idOf = new Map(all.map((u) => [u.code, u.id]));
    const fin = financeHistory(fromDay, addDays(toDay, -1), iv)
      .filter((r) => idOf.has(r.unit))
      .map((r) => ({
        orgId: ctx.orgId,
        accountCode: r.account,
        orgUnitId: idOf.get(r.unit)!,
        day: r.day,
        amount: r.amount,
        source: "synthetic:finance-feed",
      }));
    if (fin.length) await ctx.db.insert(finActual).values(fin).onConflictDoNothing();
  }
  return rows.length;
}

function assertDemoControl(actor: Actor) {
  if (process.env.DEMO_CONTROLS === "off")
    throw new DomainError("NotAuthorized", "demo controls are disabled in this environment");
  assertAuthorized(authorizeUser(actor, "demo.control", { targetUnits: [] }));
}

export async function advanceClock(db: Db, actor: Actor, hours: number) {
  assertDemoControl(actor);
  if (!(hours > 0 && hours <= 24 * 14)) throw new DomainError("Invalid", "advance between 1 hour and 14 days");
  const ctx = await createContext(db);
  const from = ctx.clock.now();
  const to = new Date(from.getTime() + hours * 3_600_000);
  // Days that have fully elapsed get their data: a day is complete once the clock passes its end.
  const generated = await generateDays(ctx, dayOf(from), dayOf(to));
  await db.transaction(async (tx) => {
    await tx.update(demoClock).set({ now: to, updatedAt: new Date() }).where(eq(demoClock.orgId, ctx.orgId));
    await appendAudit(
      tx,
      { orgId: ctx.orgId, actor, occurredAt: to, requestId: ctx.requestId },
      {
        operation: "demo.clock_advanced",
        entityType: "organization",
        entityId: ctx.orgId,
        changes: { from: from.toISOString(), to: to.toISOString(), observationsGenerated: generated },
      },
    );
  });
  const after = await createContext(db, { orgId: ctx.orgId, requestId: ctx.requestId });
  const clock = await runClockJobs(after);
  await executeReadyActions(after);
  const outcomes = await evaluateDueOutcomes(after);
  const detections = dayOf(from) !== dayOf(to) ? await runDetector(after) : [];
  const commitments = await runCommitmentMonitor(after);
  return { from, to, generated, clock, outcomes, detections, commitments };
}

/**
 * Seeds a new epoch, runs the live detector (the Haifa story) and loads the scenario catalog. Used by
 * the demo reset control and by `pnpm demo:reset` (deploy bootstrap).
 */
export async function bootstrapEpoch(db: Db, password: string) {
  const r = await seed(db, { password });
  const ctx = await createContext(db, { orgId: r.orgId });
  const detections = await runDetector(ctx);
  const catalog = await seedCatalog(await createContext(db, { orgId: r.orgId }));
  // Phase 4: the commitment register and dependency graph; catalog stories link to their commitments.
  const catalogIds = new Map(CATALOG.map((c, i) => [c.id, catalog[i].insightId]));
  const commitments = await seedCommitments(await createContext(db, { orgId: r.orgId }), catalogIds);
  // Plan v2 (E1c): cross-department initiatives, linked to the catalog stories and commitments above.
  const initiatives = await seedInitiatives(
    await createContext(db, { orgId: r.orgId }),
    catalogIds,
    commitments.commitments,
  );
  return { orgId: r.orgId, detections, catalog, commitments: commitments.monitor, initiatives };
}

/** Starts a fresh demo epoch (new organization; history of the old one stays intact). */
export async function resetDemo(db: Db, actor: Actor, password: string) {
  assertDemoControl(actor);
  const r = await bootstrapEpoch(db, password);
  const ctx = await createContext(db, { orgId: r.orgId });
  await db.transaction((tx) =>
    appendAudit(
      tx,
      { orgId: r.orgId, actor, occurredAt: ctx.clock.now(), requestId: ctx.requestId },
      {
        operation: "demo.reset",
        entityType: "organization",
        entityId: r.orgId,
        changes: { seedVersion: SEED_VERSION },
      },
    ),
  );
  return r;
}
