/**
 * E2a: the C-suite home read model (executive-home.md §3–§7) on the seeded story day: health-v2 per department,
 * projection-v1 against the budgets, scope per ADR-008.
 */
import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { Pool } from "pg";
import { loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { actionsView } from "@/application/queries/actions";
import { commitmentsView } from "@/application/queries/commitments";
import { executiveHome, type ExecutiveHome } from "@/application/queries/executive";
import { listInsights } from "@/application/queries/insights";
import { workstreamMoney } from "@/application/queries/money";
import { advanceClock, resetDemo } from "@/application/scenario";
import * as s from "@/infra/db/schema";
import { seed } from "@/infra/seed/seed";
import { setupDb } from "./helpers";

let owner: Pool;
let app: Pool;
let appDb: Db;
let orgId: string;
let dana: ExecutiveHome;

const as = async (key: string) => {
  const [u] = await appDb
    .select()
    .from(s.user)
    .where(eq(s.user.email, `${key}@vector-retail.example`));
  return loadUserActor(appDb, orgId, u.id, { sessionId: `ex-${key}`, viaDemoSwitcher: true });
};

beforeAll(async () => {
  const d = await setupDb();
  ({ owner, app } = d);
  appDb = d.appDb as Db;
  orgId = (await seed(d.ownerDb as Db, { password: "test-password" })).orgId;
  orgId = (await resetDemo(appDb, await as("admin"), "test-password")).orgId;
  dana = (await executiveHome(appDb, orgId, await as("dana")))!;
});
afterAll(async () => {
  await app.end();
  await owner.end();
});

describe("C-suite home read model (E2a)", () => {
  it("gives the CEO the group: eight departments, five regions, company health = their mean", () => {
    if (process.env.EXEC_DUMP) writeFileSync(process.env.EXEC_DUMP, JSON.stringify(dana, null, 1));
    expect(dana.scope.kind).toBe("group");
    expect(dana.departments).toHaveLength(8);
    expect(dana.regions).toHaveLength(5);
    const mean = dana.departments.reduce((a, d) => a + d.score, 0) / 8;
    expect(dana.tiles.health.score).toBeCloseTo(mean, 0);
    for (const d of dana.departments) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  it("shows the planted October stories: Supply Chain is not healthy and is worse than a week ago", () => {
    const supply = dana.departments.find((d) => d.code === "D-SUPPLY")!;
    expect(supply.status).not.toBe("healthy");
    expect(supply.change).toBeLessThan(0);
    expect(supply.cause).not.toBeNull();
  });

  it("the bridge walks from last week's group health to today's", () => {
    const sum = dana.bridge.steps.reduce((a, x) => a + x.points, 0);
    expect(dana.bridge.before + sum).toBeCloseTo(dana.bridge.now, 0);
  });

  it("revenue month to date matches the money tables, and the month chart ends at the month budget", async () => {
    const m = dana.period.monthStart;
    const [row] = await appDb
      .select({ total: sql<number>`sum(${s.finActual.amount})` })
      .from(s.finActual)
      .where(
        and(
          eq(s.finActual.orgId, orgId),
          eq(s.finActual.accountCode, "rev_net_sales"),
          gte(s.finActual.day, m),
          lt(s.finActual.day, dana.asOf),
        ),
      );
    expect(dana.tiles.headline!.code).toBe("rev_net_sales");
    expect(dana.tiles.headline!.actual).toBeCloseTo(Number(row.total), -2);
    const [b] = await appDb
      .select({ total: sql<number>`sum(${s.finBudget.amount})` })
      .from(s.finBudget)
      .where(
        and(
          eq(s.finBudget.orgId, orgId),
          eq(s.finBudget.accountCode, "rev_net_sales"),
          eq(s.finBudget.month, dana.period.month),
        ),
      );
    expect(dana.monthChart.budgetTotal).toBeCloseTo(Number(b.total), -3);
    expect(dana.monthChart.projection).not.toBeNull();
    const p = dana.monthChart.projection!;
    expect(p.low).toBeLessThanOrEqual(p.mid);
    expect(p.high).toBeGreaterThanOrEqual(p.mid);
  });

  it("lists operating profit for the group and money lines for every department", () => {
    expect(dana.groupLines.map((l) => l.code)).toEqual(["rev_net_sales", "gm_amount", "op_profit"]);
    expect(dana.financials).toHaveLength(8);
    for (const f of dana.financials) expect(f.lines.length, f.name).toBeGreaterThan(0);
    const op = dana.groupLines.find((l) => l.code === "op_profit")!;
    // About 3.5% of sales (financials.md §1).
    expect(op.actual / dana.groupLines[0].actual).toBeGreaterThan(0.01);
    expect(op.actual / dana.groupLines[0].actual).toBeLessThan(0.06);
  });

  it("ranks at most five focus items by ₪ × urgency × level", () => {
    expect(dana.focus.length).toBeGreaterThan(0);
    expect(dana.focus.length).toBeLessThanOrEqual(5);
    const scores = dana.focus.map((f) => f.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("gives the CFO and the COO the same group as the CEO (ADR-008)", async () => {
    for (const k of ["michal", "oren"]) {
      const v = (await executiveHome(appDb, orgId, await as(k)))!;
      expect(v.scope.kind, k).toBe("group");
      expect(v.tiles.health.score, k).toBe(dana.tiles.health.score);
    }
  });

  it("gives Hila (VP HR) HR only, with HR's own money lines", async () => {
    const v = (await executiveHome(appDb, orgId, await as("hila")))!;
    expect(v.scope.readsGroup).toBe(false);
    expect(v.departments.map((d) => d.code)).toEqual(["D-HR"]);
    expect(v.tiles.headline!.code).toBe("headcount_cost");
    expect(v.groupLines).toEqual([]);
    expect(v.regions).toEqual([]);
  });

  it("drills a department down by region, and refuses a unit outside the viewer's scope", async () => {
    const store = dana.departments.find((d) => d.code === "D-STORE")!;
    const v = (await executiveHome(appDb, orgId, await as("dana"), { unitId: store.unitId }))!;
    expect(v.scope.kind).toBe("department");
    expect(v.regions).toHaveLength(5);
    expect(v.regions[0].parts.length).toBeGreaterThan(0);
    const hila = await as("hila");
    expect(await executiveHome(appDb, orgId, hila, { unitId: store.unitId })).toBeNull();
  });

  it("a VP who reads one department lands on its own view, with its regions", async () => {
    const v = (await executiveHome(appDb, orgId, await as("noa")))!;
    expect(v.scope.kind).toBe("department");
    expect(v.departments.map((d) => d.code)).toEqual(["D-SUPPLY"]);
    expect(v.regions).toHaveLength(5);
    expect(v.departments[0].measures.length).toBeGreaterThan(3);
  });

  it("draws the organization pulse from dependencies and conflicts between departments", () => {
    expect(dana.links.length).toBeGreaterThan(0);
    expect(dana.links.some((l) => l.state === "blocked")).toBe(true);
    const ids = new Set(dana.departments.map((d) => d.unitId));
    for (const l of dana.links) expect(ids.has(l.from) && ids.has(l.to)).toBe(true);
  });

  it("₪ headers (E2c): the Risks header's P1 money matches the home tile; every list page has its figures", async () => {
    const a = await as("dana");
    const items = await listInsights(appDb, orgId, a);
    const open = items.filter((i) => i.status === "open" || i.status === "acknowledged");
    const m = (await workstreamMoney(
      appDb,
      orgId,
      a,
      open.map((i) => i.id),
    ))!;
    expect(m.risk!.p1).toBe(dana.tiles.p1.ils);
    expect(m.risk!.atStake).toBeGreaterThanOrEqual(m.risk!.p1);
    expect(m.opportunity!.upside).toBeGreaterThan(0);
    expect(m.opportunity!.netEoq).toBeGreaterThan(0);
    const acts = await actionsView(appDb, orgId, a, "all");
    expect(acts.money.expectedImpact).toBeGreaterThan(0);
    const cs = (await commitmentsView(appDb, orgId, a))!;
    expect(cs.money.open).toBeGreaterThan(0);
    // Ids the viewer may not read are ignored.
    const hila = await as("hila");
    const hilaIds = new Set((await listInsights(appDb, orgId, hila)).map((i) => i.id));
    const hidden = open.filter((i) => !hilaIds.has(i.id)).map((i) => i.id);
    expect(await workstreamMoney(appDb, orgId, hila, hidden)).toBeNull();
  });

  it("is deterministic: the same seed and clock give the same scores", async () => {
    const again = (await executiveHome(appDb, orgId, await as("dana")))!;
    expect(again.departments.map((d) => [d.code, d.score, d.change, d.projectedEoq])).toEqual(
      dana.departments.map((d) => [d.code, d.score, d.change, d.projectedEoq]),
    );
  });

  // Mutates the demo: keep last.
  it("advancing the clock extends the money lines, so month to date keeps moving", async () => {
    await advanceClock(appDb, await as("admin"), 24);
    const v = (await executiveHome(appDb, orgId, await as("dana")))!;
    expect(v.asOf).toBe("2026-10-23");
    expect(v.tiles.headline!.actual).toBeGreaterThan(dana.tiles.headline!.actual);
    expect(v.monthChart.series.find((p) => p.day === "2026-10-22")!.actual).not.toBeNull();
  });
});
