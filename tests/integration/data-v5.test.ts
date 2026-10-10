/**
 * Synthetic data v5 (plan v2, E1c; financials.md, cross-department.md §5): 52 weeks of history, money lines and
 * budgets, action economics on every proposed action, and initiatives visible per ADR-008 §3.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Pool } from "pg";
import { loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { listInitiatives } from "@/application/queries/initiatives";
import { resetDemo } from "@/application/scenario";
import * as s from "@/infra/db/schema";
import { HISTORY_DAYS } from "@/infra/seed/org";
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
  return loadUserActor(appDb, orgId, u.id, { sessionId: `v5-${key}`, viaDemoSwitcher: true });
};

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

describe("synthetic data v5", () => {
  it("has 52 weeks of KPI and money history", async () => {
    const [k] = await appDb
      .select({ n: sql<number>`count(distinct ${s.kpiObservation.day})::int` })
      .from(s.kpiObservation)
      .where(eq(s.kpiObservation.orgId, orgId));
    const [f] = await appDb
      .select({ n: sql<number>`count(distinct ${s.finActual.day})::int`, rows: sql<number>`count(*)::int` })
      .from(s.finActual)
      .where(eq(s.finActual.orgId, orgId));
    expect(k.n).toBe(HISTORY_DAYS);
    expect(f.n).toBe(HISTORY_DAYS);
    expect(f.rows).toBeGreaterThan(15_000);
  });

  it("budgets every account, unit and month that has actuals", async () => {
    const gaps = await appDb.execute(sql`
      select account_code, org_unit_id, to_char(day, 'YYYY-MM') as month from fin_actual where org_id = ${orgId}
      group by 1, 2, 3
      except select account_code, org_unit_id, month from fin_budget where org_id = ${orgId}`);
    expect(gaps.rows).toEqual([]);
  });

  it("every proposed action carries its economics (economics-v0)", async () => {
    const all = await appDb.select().from(s.action).where(eq(s.action.orgId, orgId));
    expect(all.length).toBeGreaterThan(10);
    const missing = await appDb
      .select()
      .from(s.action)
      .where(and(eq(s.action.orgId, orgId), isNull(s.action.executionRisk)));
    expect(missing).toEqual([]);
    expect(all.every((a) => typeof a.impactBasis === "string" && a.impactBasis.includes("weeks to quarter end"))).toBe(
      true,
    );
  });

  it("initiatives follow the read rule: group readers see all eight, a VP sees those her department joins", async () => {
    for (const k of ["dana", "michal", "oren"])
      expect((await listInitiatives(appDb, orgId, await as(k))).length, k).toBe(8);
    const hila = (await listInitiatives(appDb, orgId, await as("hila"))).map((i) => i.title).sort();
    expect(hila).toEqual([
      "Holiday-season readiness",
      "Monthly budget review",
      "North DC recovery",
      "Wage-rule compliance",
    ]);
    const avi = await listInitiatives(appDb, orgId, await as("avi"));
    expect(avi).toEqual([]); // a branch manager joins no department initiative
  });

  it("an initiative links its stories and carries milestones and barriers", async () => {
    const [dc] = (await listInitiatives(appDb, orgId, await as("dana"))).filter((i) => i.key === "I-NORTH-DC");
    expect(dc.insightIds).toHaveLength(2);
    expect(dc.commitmentIds).toHaveLength(2);
    expect(dc.milestones).toHaveLength(5);
    expect(dc.barriers.filter((b) => !b.resolvedOn)).toHaveLength(2);
    const audit = await appDb
      .select()
      .from(s.auditEvent)
      .where(and(eq(s.auditEvent.orgId, orgId), eq(s.auditEvent.operation, "initiative.recorded")));
    expect(audit).toHaveLength(8);
  });
});
