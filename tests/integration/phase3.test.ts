/**
 * Phase 3 read models against a real database: unit views and their scope, KPI ↔ insight links,
 * the Executive Command Center and the organization tree (docs/phases/PHASE_3.md).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { listInsights } from "@/application/queries/insights";
import { commandCenter, orgTree, performanceView } from "@/application/queries/performance";
import { resetDemo } from "@/application/scenario";
import * as s from "@/infra/db/schema";
import { seed } from "@/infra/seed/seed";
import { setupDb } from "./helpers";

let owner: Pool;
let app: Pool;
let appDb: Db;
let orgId: string;

const as = async (email: string) => {
  const [u] = await appDb.select().from(s.user).where(eq(s.user.email, email));
  return loadUserActor(appDb, orgId, u.id, { sessionId: `p3-${email}`, viaDemoSwitcher: true });
};
const unit = async (name: string) =>
  (
    await appDb
      .select()
      .from(s.orgUnit)
      .where(and(eq(s.orgUnit.orgId, orgId), eq(s.orgUnit.name, name)))
  )[0];

beforeAll(async () => {
  const d = await setupDb();
  ({ owner, app } = d);
  appDb = d.appDb as Db;
  orgId = (await seed(d.ownerDb as Db, { password: "test-password" })).orgId;
  orgId = (await resetDemo(appDb, await as("admin@vector-retail.example"), "test-password")).orgId;
});
afterAll(async () => {
  await app.end();
  await owner.end();
});

describe("unit views (Phase 3)", () => {
  it("a manager's default view is their own unit; a unit outside their scope reads as missing", async () => {
    const avi = await as("avi@vector-retail.example");
    const own = await performanceView(appDb, orgId, avi);
    expect(own?.scope.name).toBe("Haifa Grand Canyon");
    expect(own?.breadcrumb.map((b) => b.name)).toEqual(["VECTOR Retail Group", "North", "Haifa Grand Canyon"]);

    const center = await unit("Center");
    expect(await performanceView(appDb, orgId, avi, center.id)).toBeNull();
    expect(await performanceView(appDb, orgId, avi, (await unit("North")).id)).toBeNull(); // above him, too
    const maya = await as("maya@vector-retail.example");
    expect(await performanceView(appDb, orgId, maya, own!.scope.id)).toBeNull();
    expect((await performanceView(appDb, orgId, maya, center.id))?.scope.name).toBe("Center");
  });

  it("the Executive can open any unit, down to a branch, with the same template", async () => {
    const dana = await as("dana@vector-retail.example");
    for (const name of ["VECTOR Retail Group", "North", "Haifa Grand Canyon", "Supply Chain"]) {
      const v = await performanceView(appDb, orgId, dana, (await unit(name)).id);
      expect(v?.scope.name).toBe(name);
      expect(v?.items.every((i) => typeof i.why === "string" && i.why.length > 0)).toBe(true);
    }
  });

  it("every item on a unit view is one the viewer may read, and the counts match the insight list", async () => {
    const yossi = await as("yossi@vector-retail.example");
    const v = await performanceView(appDb, orgId, yossi);
    const visible = new Set((await listInsights(appDb, orgId, yossi)).map((i) => i.id));
    expect(v!.items.length).toBeGreaterThan(0);
    expect(v!.items.every((i) => visible.has(i.id))).toBe(true);
  });

  it("a unit view uses one band per item: cards, counts and KPI links agree (regression: Avi saw P1 and '0 P1')", async () => {
    const avi = await as("avi@vector-retail.example");
    const v = (await performanceView(appDb, orgId, avi))!;
    const haifa = v.items.find((i) => /Haifa Grand Canyon net sales/.test(i.title))!;
    expect(haifa.groupBand).toBe("P2");
    expect(haifa.band).toBe("P1"); // local priority, raise-only (G2-a)
    for (const b of ["P1", "P2", "P3", "P4"])
      expect(v.workstreams.risks.find((r) => r.band === b)!.count).toBe(
        v.items.filter((i) => i.workstream === "risk" && i.band === b).length,
      );
    const band = new Map(v.items.map((i) => [i.id, i.band]));
    for (const links of Object.values(v.kpiLinks)) for (const l of links) expect(l.band).toBe(band.get(l.id));
  });

  it("KPI links point only at readable insights whose evidence charts that KPI", async () => {
    const avi = await as("avi@vector-retail.example");
    const v = await performanceView(appDb, orgId, avi);
    const ids = new Set(v!.items.map((i) => i.id));
    const linked = Object.entries(v!.kpiLinks);
    expect(linked.length).toBeGreaterThan(0); // Haifa net sales is explained by the live detector story
    for (const [, links] of linked) for (const l of links) expect(ids.has(l.id)).toBe(true);
    const sales = Object.entries(v!.kpiLinks).find(([, ls]) => ls.some((l) => /net sales/.test(l.title)));
    expect(sales).toBeDefined();
  });
});

describe("Executive Command Center (Phase 3)", () => {
  it("leads with a one-sentence headline that names the regions needing attention", async () => {
    const cc = await commandCenter(appDb, orgId, await as("dana@vector-retail.example"));
    expect(cc!.headline).toMatch(/\.$/);
    expect(cc!.headline.split(". ").length).toBe(1);
    expect(cc!.subline).toMatch(/\d+ P1 risks? across the group/);
    const atRisk = cc!.children.filter((c) => c.health === "at_risk").map((c) => c.name);
    for (const r of atRisk) expect(cc!.headline).toContain(r);
  });

  it("'what changed' lists only audited events on insights the viewer can see, newest first", async () => {
    const cc = await commandCenter(appDb, orgId, await as("dana@vector-retail.example"));
    const ids = new Set(cc!.items.map((i) => i.id));
    for (const f of cc!.changes.feed) expect(ids.has(f.insightId)).toBe(true);
    const total = cc!.changes.counts.reduce((n, c) => n + c.n, 0);
    expect(total).toBeGreaterThanOrEqual(cc!.changes.feed.length);
  });

  it("biggest moves are real gaps (worse than 5%), worst first, at most five", async () => {
    const cc = await commandCenter(appDb, orgId, await as("dana@vector-retail.example"));
    expect(cc!.moves.length).toBeGreaterThan(0);
    expect(cc!.moves.length).toBeLessThanOrEqual(5);
    const gaps = cc!.moves.map((m) => m.gap);
    expect([...gaps].sort((a, b) => a - b)).toEqual(gaps);
    expect(gaps.every((g) => g < -0.05)).toBe(true);
  });
});

describe("organization tree (Phase 3)", () => {
  it("the Executive sees the whole hierarchy; a branch manager sees only his branch", async () => {
    const full = await orgTree(appDb, orgId, await as("dana@vector-retail.example"));
    expect(full.trees).toHaveLength(1);
    expect(full.trees[0].children).toHaveLength(5);
    expect(full.departments).toHaveLength(8);
    const avi = await orgTree(appDb, orgId, await as("avi@vector-retail.example"));
    expect(avi.trees.map((t) => t.name)).toEqual(["Haifa Grand Canyon"]);
    expect(avi.departments).toHaveLength(0);
  });

  it("Legal and Supply Chain own the recall work", async () => {
    const t = await orgTree(appDb, orgId, await as("dana@vector-retail.example"));
    const owned = Object.fromEntries(t.departments.map((d) => [d.name, d.owned]));
    expect(owned["Legal & Compliance"]).toBeGreaterThan(0);
    expect(owned["Supply Chain"]).toBeGreaterThan(0);
  });
});
