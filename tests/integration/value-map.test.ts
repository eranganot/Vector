/**
 * E3a: the value map (cross-department.md §1–§2) — one point per live action item of the insights shown, with
 * economics-v1 execution risk; visibility re-checked.
 */
import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { listInsights } from "@/application/queries/insights";
import { valueMap } from "@/application/queries/value-map";
import { resetDemo } from "@/application/scenario";
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
  return loadUserActor(appDb, orgId, u.id, { sessionId: `vm-${key}`, viaDemoSwitcher: true });
};
const open = async (key: string, ws: string) =>
  (await listInsights(appDb, orgId, await as(key))).filter(
    (i) => i.workstream === ws && (i.status === "open" || i.status === "acknowledged"),
  );

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

describe("value map (E3a)", () => {
  it("has one point per live action item of the opportunities shown, sorted by net value", async () => {
    const opps = await open("dana", "opportunity");
    const pts = await valueMap(
      appDb,
      orgId,
      await as("dana"),
      opps.map((i) => i.id),
    );
    if (process.env.VM_DUMP) writeFileSync(process.env.VM_DUMP, JSON.stringify(pts, null, 1));
    expect(pts.length).toBeGreaterThanOrEqual(opps.length);
    const nets = pts.map((p) => p.net);
    expect([...nets].sort((a, b) => b - a)).toEqual(nets);
    for (const p of pts) {
      expect(p.net).toBe(p.impact - p.cost);
      expect(p.href).toBe(`/insights/${p.insightId}#action-${p.actionId}`);
      expect(p.risk.model).toBe("economics-v1");
      expect(p.risk.score).toBeGreaterThanOrEqual(0);
      expect(p.risk.score).toBeLessThanOrEqual(1);
    }
  });

  it("reads live risk: the North DC response is in a blocked dependency and scores higher than a clean one", async () => {
    const risks = await open("dana", "risk");
    const pts = await valueMap(
      appDb,
      orgId,
      await as("dana"),
      risks.map((i) => i.id),
    );
    expect(pts.some((p) => p.risk.factors.dependency > 0)).toBe(true);
    const scores = pts.map((p) => p.risk.score);
    expect(Math.max(...scores)).toBeGreaterThan(Math.min(...scores));
  });

  it("ignores insights the viewer may not read", async () => {
    const all = await open("dana", "risk");
    const hila = new Set((await open("hila", "risk")).map((i) => i.id));
    const hidden = all.filter((i) => !hila.has(i.id)).map((i) => i.id);
    expect(await valueMap(appDb, orgId, await as("hila"), hidden)).toEqual([]);
  });
});
