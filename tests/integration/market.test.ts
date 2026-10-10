/**
 * E6: market & competitors — the numbers on the tab come from the committed snapshot (CBS as published, the basket
 * index recomputed from the price files), competitor figures carry their source, estimates are labelled, and our
 * planted North dairy gap is 4% above Shufersal.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { marketView } from "@/application/queries/market";
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
});
