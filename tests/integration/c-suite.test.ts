/**
 * ADR-008 (plan v2, E1b): C-suite read scope. The CEO, CFO and COO read the whole group; every other C-suite member
 * reads their own department; reading never widens acting (AZ-1 is unchanged).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { createContext, loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { grantApproval } from "@/application/commands/lifecycle";
import { listInsights, listMyApprovals } from "@/application/queries/insights";
import { performanceView } from "@/application/queries/performance";
import { resetDemo } from "@/application/scenario";
import { DomainError } from "@/domain/errors";
import * as s from "@/infra/db/schema";
import { C_SUITE } from "@/infra/seed/org";
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
  return loadUserActor(appDb, orgId, u.id, { sessionId: `cs-${key}`, viaDemoSwitcher: true });
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

describe("C-suite read scope (ADR-008)", () => {
  it("flags exactly the ten C-suite people", async () => {
    const rows = await appDb.select({ email: s.user.email, c: s.user.isCSuite }).from(s.user);
    const flagged = rows.filter((r) => r.c).map((r) => r.email.split("@")[0]);
    expect(flagged.sort()).toEqual([...C_SUITE].sort());
  });

  it("the CEO, CFO and COO read the same whole group, and land on the group view", async () => {
    const counts = [];
    for (const k of ["dana", "michal", "oren"]) {
      const a = await as(k);
      counts.push((await listInsights(appDb, orgId, a)).length);
      expect((await performanceView(appDb, orgId, a))?.scope.name, k).toBe("VECTOR Retail Group");
    }
    expect(counts[0]).toBeGreaterThan(10);
    expect(counts).toEqual([counts[0], counts[0], counts[0]]);
  });

  it("another C-suite member reads only what touches their department", async () => {
    const all = (await listInsights(appDb, orgId, await as("dana"))).length;
    const hila = await as("hila");
    const hers = await listInsights(appDb, orgId, hila);
    expect(hers.length).toBeGreaterThan(0);
    expect(hers.length).toBeLessThan(all);
    expect((await performanceView(appDb, orgId, hila))?.scope.name).toBe("HR");
  });

  it("reading the group never lets the CFO approve outside Finance (AZ-1)", async () => {
    const pending = await listMyApprovals(appDb, orgId, await as("dana"));
    const [fin] = await appDb
      .select()
      .from(s.orgUnit)
      .where(eq(s.orgUnit.orgId, orgId))
      .then((u) => u.filter((x) => x.code === "D-FIN"));
    const outside = pending.find((p) => !p.action.targetUnitIds.includes(fin.id));
    expect(outside, "a pending approval outside Finance exists in the demo").toBeDefined();
    const michal = await as("michal");
    const p = grantApproval(await createContext(appDb), michal, outside!.action.id, "CFO tries");
    await expect(p).rejects.toBeInstanceOf(DomainError);
    expect((await listMyApprovals(appDb, orgId, michal)).map((x) => x.action.id)).not.toContain(outside!.action.id);
  });

  it("the COO acts as a manager of Store Operations and Supply Chain, never as an Executive", async () => {
    const oren = await as("oren");
    if (oren.kind !== "user") throw new Error("expected a user");
    expect(oren.assignments.some((a) => a.role === "executive")).toBe(false);
    expect(oren.assignments.filter((a) => a.role === "department_manager").map((a) => a.unit.id).length).toBe(2);
  });
});
