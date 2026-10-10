/**
 * E6: market & competitors — the numbers on the tab come from the committed snapshot (CBS as published, the basket
 * index recomputed from the price files), competitor figures carry their source, estimates are labelled, and our
 * planted North dairy gap is 4% above Shufersal.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { marketView } from "@/application/queries/market";
import { getInsightTrace } from "@/application/queries/insights";
import { resolveReport } from "@/application/queries/report-data";
import { templateLayout } from "@/domain/report";
import { resetDemo } from "@/application/scenario";
import { basketIndex, type BasketItem } from "@/domain/market";
import { readSnapshots } from "@/infra/market/load";
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
  return loadUserActor(appDb, orgId, u.id, { sessionId: `mk-${key}`, viaDemoSwitcher: true });
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

describe("market & competitors (E6)", () => {
  it("shows CBS as published and a basket index that recomputes from the price files", async () => {
    const v = (await marketView(appDb, await as("dana"), { region: "NORTH" }))!;
    const { snapshots } = readSnapshots();
    const snap = snapshots.at(-1)!;
    const food = snap.cbs.find((c) => c.code === "110050")!;
    expect(v.tiles.foodYoy).toBe(food.points.at(-1)!.yoy);
    const prices = Object.fromEntries(
      snap.chains.filter((c) => snap.prices[c].NORTH).map((c) => [c, snap.prices[c].NORTH]),
    );
    const idx = basketIndex(snap.basket as BasketItem[], prices);
    expect(v.basket.find((b) => b.chain === "shufersal")!.index).toBe(idx.overall.shufersal);
    expect(v.basket.find((b) => b.chain === "vector")!.synthetic).toBe(true);
    // Planted: our North dairy is 4% above Shufersal's.
    const ours = v.heatmap.find((r) => r.chain === "vector")!.cells.find((c) => c.category === "dairy")!.index!;
    expect(ours).toBeCloseTo(idx.byCategory.shufersal.dairy! * 1.04, 0);
    expect(v.sources.priceFiles.files).toBe(snap.stores.filter((f) => f.region === "NORTH").length);
  });

  it("lists competitors with their sources; store counts are labelled estimates", async () => {
    const v = (await marketView(appDb, await as("dana")))!;
    const shufersal = v.competitors.find((c) => c.key === "shufersal")!;
    expect(shufersal.revenue).toMatchObject({
      value: 3_400_000_000,
      kind: "reported",
      url: "https://en.globes.co.il/en/article-1001553761",
    });
    expect(shufersal.sameStore!.value).toBe(-8.6);
    expect(shufersal.stores).toMatchObject({ kind: "estimate" });
    expect(shufersal.stores!.method).toMatch(/stores file/);
    expect(v.competitors.find((c) => c.key === "rami_levy")!.growth!.value).toBe(3);
  });

  it("is shown only to people with a scope", async () => {
    expect(await marketView(appDb, { kind: "system", id: "system:executor" } as never)).toBeNull();
  });

  it("market-v1: MK2 (our prices rose while CBS food fell) and MK3 (Shufersal shrinking) become insights with sources", async () => {
    const dana = await as("dana");
    const v = (await marketView(appDb, dana, { orgId }))!;
    const mk2 = v.changed.find((c) => c.title.startsWith("Our prices rose"))!;
    const mk3 = v.changed.find((c) => c.workstream === "opportunity")!;
    expect(v.changed).toHaveLength(3); // MK2, MK3 and MK6 (North dairy)
    expect(mk2.title).toBe("Our prices rose while food prices fell (July and August)");
    expect(mk2.priorityBand).toMatch(/^P[23]$/);
    expect(mk2.impactIls).toBeGreaterThan(0);
    expect(mk3.title).toBe("Shufersal is shrinking (same-store −8.6%); we are growing");
    const trace = (await getInsightTrace(appDb, orgId, dana, mk3.id))!;
    expect(trace.insight.generatedBy).toBe("rule:market-v1@1.0.0");
    const filing = trace.evidence.find((e) => e.kind === "market_record")!.payload as { url: string; real: boolean };
    expect(filing).toMatchObject({ real: true, url: expect.stringMatching(/globes\.co\.il/) });
    expect(trace.actions.map((a) => a.type)).toEqual(["campaign_change"]);
  });

  it("re-running the detector attaches to the same market insights (no duplicates)", async () => {
    const { runMarketRules } = await import("@/application/market-rules");
    const { createContext } = await import("@/application/context");
    const r = await runMarketRules(await createContext(appDb, { orgId }));
    expect(r.map((x) => x.outcome)).toEqual(["attached", "attached", "attached"]);
  });

  it("the board pack carries the market block: basket vs market by chain, ours included", async () => {
    const dana = await as("dana");
    const [g] = await appDb
      .select()
      .from(s.orgUnit)
      .where(and(eq(s.orgUnit.orgId, orgId), eq(s.orgUnit.code, "GROUP")));
    const rep = await resolveReport(appDb, orgId, dana, { scopeUnitId: g.id, layout: templateLayout("board_pack") });
    const block = rep!.blocks.find((b) => b.metric === "market_position")!;
    expect(block.data.type).toBe("bars");
    const rows = (block.data as { rows: { label: string; value: number }[] }).rows;
    expect(rows.map((r) => r.label)).toContain("Shufersal");
    expect(rows.find((r) => r.label === "VECTOR Retail Group")).toBeDefined();
  });

  it("growth & expansion: 8 quarters of reported results, estimates labelled, ours computed from our data", async () => {
    const v = (await marketView(appDb, await as("dana"), { orgId }))!;
    const g = v.growth;
    expect(g.quarters).toHaveLength(8);
    const shufersal = g.chains.find((c) => c.key === "shufersal")!;
    expect(shufersal.growthByQuarter.at(-1)).toBe(-7.5); // Globes' rounded figure wins over the source's −7.53
    expect(shufersal.marketShare).toBeCloseTo((14_489_000_000 / 52e9) * 100, 0);
    expect(g.chains.find((c) => c.key === "osher_ad")!.revenueLatest).toBeNull(); // private: not reported
    expect(g.ours!.synthetic).toBe(true);
    expect(g.ours!.avgBasket).toBeGreaterThan(100);
    expect(g.ours!.stores!.value).toBe(60);
  });

  it("MK6 price gap: North dairy, compared with every chain, owned by Trade", async () => {
    const dana = await as("dana");
    const v = (await marketView(appDb, dana, { orgId }))!;
    const gap = v.changed.find((c) => c.title === "Dairy in North is +13.2% above the market")!;
    expect(gap.priorityBand).toBe("P2");
    const trace = (await getInsightTrace(appDb, orgId, dana, gap.id))!;
    const rows = (trace.evidence[0].payload as { rows: { label: string }[] }).rows.map((r) => r.label);
    expect(rows).toEqual(expect.arrayContaining(["Shufersal", "Rami Levy", "Osher Ad", "Yohananof", "Tiv Taam"]));
    expect(trace.actions.map((a) => a.type)).toEqual(["price_change", "notify_owner"]);
  });
});
