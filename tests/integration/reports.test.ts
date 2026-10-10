/**
 * E5: reports — the weekly management layout resolves from the same read models as the screens, a snapshot is stored
 * with a version and a hash and audited, and nobody can report on a scope they may not read.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { createContext, loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { generateReport } from "@/application/commands/reports";
import { executiveHome } from "@/application/queries/executive";
import { getReport, listReports, reportScopes, resolveReport } from "@/application/queries/report-data";
import { resetDemo } from "@/application/scenario";
import { addBlock, templateLayout } from "@/domain/report";
import * as s from "@/infra/db/schema";
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
  return loadUserActor(appDb, orgId, u.id, { sessionId: `rep-${key}`, viaDemoSwitcher: true });
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

describe("reports (E5)", () => {
  it("offers the group and every department to the CEO, and only her department to a VP", async () => {
    const dana = await reportScopes(appDb, orgId, await as("dana"));
    expect(dana[0].kind).toBe("group");
    expect(dana.filter((x) => x.kind === "department").length).toBe(8);
    const noa = await reportScopes(appDb, orgId, await as("noa"));
    expect(noa.map((x) => x.name)).toEqual(["Supply Chain"]);
  });

  it("resolves every block of the weekly management template with numbers that match the home screen", async () => {
    const dana = await as("dana");
    const [group] = await reportScopes(appDb, orgId, dana);
    const r = (await resolveReport(appDb, orgId, dana, {
      scopeUnitId: group.unitId,
      layout: addBlock(templateLayout("weekly_management"), "opex_vs_budget"),
    }))!;
    for (const b of r.blocks) expect(b.data.type, b.metric).not.toBe("empty");
    const home = (await executiveHome(appDb, orgId, dana))!;
    const head = r.blocks.find((b) => b.metric === "headline")!.data;
    expect(head.type === "headline" && head.health).toBe(Math.round(home.tiles.health.score));
    const health = r.blocks.find((b) => b.metric === "health_by_department")!.data;
    expect(health.type === "bars" && health.rows.length).toBe(home.departments.length);
    const sales = r.blocks.find((b) => b.metric === "sales_vs_budget")!.data;
    expect(sales.type === "series" && sales.points.length).toBe(8);
    expect(sales.type === "series" && sales.points.every((p) => p.actual > 0 && p.budget > 0)).toBe(true);
    const decisions = r.blocks.find((b) => b.metric === "decisions_needed")!.data;
    expect(decisions.type === "table" && decisions.rows.length).toBeGreaterThan(0);
  });

  it("stores a versioned, hashed snapshot and audits it; a VP cannot report on the group", async () => {
    const dana = await as("dana");
    const [group] = await reportScopes(appDb, orgId, dana);
    const ctx = await createContext(appDb);
    const layout = templateLayout("weekly_management");
    const id1 = await generateReport(ctx, dana, { scopeUnitId: group.unitId, layout, language: "en" });
    const id2 = await generateReport(ctx, dana, { scopeUnitId: group.unitId, layout, language: "en" });
    const [r1] = await appDb.select().from(s.report).where(eq(s.report.id, id1));
    const [r2] = await appDb.select().from(s.report).where(eq(s.report.id, id2));
    expect([r1.version, r2.version]).toEqual([1, 2]);
    expect(r1.contentHash).toMatch(/^[0-9a-f]{64}$/);
    const ops = await appDb
      .select()
      .from(s.auditEvent)
      .where(and(eq(s.auditEvent.orgId, orgId), eq(s.auditEvent.entityId, id1)));
    expect(ops.map((o) => o.operation)).toEqual(["report.generated"]);

    const noa = await as("noa");
    await expect(generateReport(ctx, noa, { scopeUnitId: group.unitId, layout, language: "en" })).rejects.toThrow(
      /own scope/,
    );
    expect(await getReport(appDb, orgId, noa, id1)).toBeNull();
    const [sc] = await reportScopes(appDb, orgId, noa);
    const own = await generateReport(ctx, noa, { scopeUnitId: sc.unitId, layout, language: "he" });
    expect((await listReports(appDb, orgId, noa)).map((x) => x.id)).toEqual([own]);
    expect((await listReports(appDb, orgId, dana)).map((x) => x.id)).toContain(own);
    const opened = (await getReport(appDb, orgId, dana, own))!;
    expect(opened.content.scope.name).toBe("Supply Chain");
  });
});
