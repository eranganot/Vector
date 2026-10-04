/**
 * The Phase 2 demo, driven like the UI drives it: reset → detector + catalog → local priority →
 * decide → approve → clock → outcome.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { verifyAuditChain } from "@/application/audit";
import { acceptDecision, executeReadyActions, grantApproval } from "@/application/commands/lifecycle";
import { createContext, loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { getInsightTrace, listInsights, listMyApprovals, listMyDecisions } from "@/application/queries/insights";
import { performanceView } from "@/application/queries/performance";
import { CATALOG } from "@/infra/seed/catalog";
import { advanceClock, resetDemo } from "@/application/scenario";
import * as s from "@/infra/db/schema";
import { seed } from "@/infra/seed/seed";
import { setupDb } from "./helpers";

let owner: Pool;
let app: Pool;
let appDb: Db;
let ownerDb: Db;
beforeAll(async () => {
  const d = await setupDb();
  ({ owner, app } = d);
  appDb = d.appDb as Db;
  ownerDb = d.ownerDb as Db;
});
afterAll(async () => {
  await app.end();
  await owner.end();
});

describe("Phase 2 demo scenario", () => {
  let orgId: string;
  const as = async (email: string) => {
    const [u] = await appDb.select().from(s.user).where(eq(s.user.email, email));
    return loadUserActor(appDb, orgId, u.id, { sessionId: `s-${email}`, viaDemoSwitcher: true });
  };

  const haifa = async (email: string) =>
    (await listInsights(appDb, orgId, await as(email))).find((i) => /Haifa Grand Canyon net sales/.test(i.title))!;

  it("reset seeds a new epoch: the detector finds exactly the planted story, and the catalog loads", async () => {
    // Bootstrap an epoch so the Admin persona exists, then reset as that Admin.
    orgId = (await seed(ownerDb, { password: "test-password" })).orgId;
    const admin = await as("admin@vector-retail.example");
    const r = await resetDemo(appDb, admin, "test-password");
    orgId = r.orgId;
    expect(r.detections).toHaveLength(1);
    expect(r.catalog).toHaveLength(CATALOG.length);
    const list = await listInsights(appDb, orgId, await as("dana@vector-retail.example"));
    expect(list).toHaveLength(19); // 14 risks (13 catalog + the live Haifa story) and 5 opportunities
    expect(
      list
        .filter((i) => i.workstream === "risk")
        .map((i) => i.priorityBand)
        .sort()
        .join(""),
    ).toBe("P1P1P1P1P2P2P2P2P2P3P3P3P4P4");
    expect(
      list
        .filter((i) => i.workstream === "opportunity")
        .map((i) => i.priorityBand)
        .sort()
        .join(""),
    ).toBe("O1O2O2O2O3");
    const h = await haifa("dana@vector-retail.example");
    expect(h.title).toMatch(/Haifa Grand Canyon net sales −1\d\.\d% vs\. usual/);
    expect(h.priorityBand).toBe("P2");
    expect((await verifyAuditChain(appDb, orgId)).ok).toBe(true);
  });

  it("local priority: P2 for the Center region manager (R11) and the Dizengoff branch manager (R10); P1 for Avi", async () => {
    const maya = await listInsights(appDb, orgId, await as("maya@vector-retail.example"));
    const labor = maya.find((i) => /Labor cost 6% over plan/.test(i.title))!;
    expect([labor.priorityBand, labor.local?.band]).toEqual(["P3", "P2"]);
    // Never lowered: a group-wide P1 stays P1 for her.
    expect(maya.find((i) => /Food-safety recall/.test(i.title))!.local).toBeNull();
    const lior = await listInsights(appDb, orgId, await as("lior@vector-retail.example"));
    const shrink = lior.find((i) => /Shrinkage spike/.test(i.title))!;
    expect([shrink.priorityBand, shrink.local?.band]).toEqual(["P3", "P2"]);
    expect(lior[0].id).toBe(shrink.id); // ranked by local priority
    const avi = await haifa("avi@vector-retail.example");
    expect([avi.priorityBand, avi.local?.band]).toEqual(["P2", "P1"]);
  });

  it("the catalog opens mid-flight: approvals wait on the right people", async () => {
    const titles = async (email: string) =>
      (await listMyApprovals(appDb, orgId, await as(email))).map((a) => a.action.title).sort();
    expect(await titles("omer@vector-retail.example")).toEqual([
      "Afternoon staff uplift during the heatwave",
      "Extra beverage and ice-cream deliveries to 8 South branches",
    ]);
    expect(await titles("yossi@vector-retail.example")).toEqual([
      "Transfer top-50 SKU stock from the Center DC to 9 North branches",
    ]);
    // G3: the recall is approved inside Legal; the CEO is asked only when nobody else may approve (≥ ₪50k).
    expect(await titles("yael@vector-retail.example")).toEqual([
      "Block the SKU at every POS (IT executes for Supply Chain)",
      "Notify the food-safety regulator of the recall",
      "Quarantine batch 4471 at the DCs and pull it from 60 branches",
      "Recall notice to loyalty customers who bought batch 4471",
    ]);
    expect(await titles("dana@vector-retail.example")).toEqual(["Weekend staffing uplift, 9 North branches"]);
    expect(await titles("noa@vector-retail.example")).toEqual([]); // she owns her actions (AZ-2); not Legal (AP-7)
  });

  it("the CEO is notified of the recall, not asked: the briefing executed as a task for her", async () => {
    const dana = await as("dana@vector-retail.example");
    const recall = (await listInsights(appDb, orgId, dana)).find((i) => /Food-safety recall/.test(i.title))!;
    const t = (await getInsightTrace(appDb, orgId, dana, recall.id))!;
    const brief = t.actions.find((a) => a.type === "notify_owner")!;
    expect(brief.status).toBe("executed");
    expect(t.tasks.map((x) => x.assigneeUserId)).toContain(dana.kind === "user" ? dana.userId : "");
    const owners = new Set(t.actions.filter((a) => a.type !== "notify_owner").map((a) => a.ownerUserId));
    const ben = await as("ben@vector-retail.example");
    const dafna = await as("dafna@vector-retail.example");
    expect([...owners].sort()).toEqual([ben, dafna].map((a) => (a.kind === "user" ? a.userId : "")).sort()); // the work sits with Supply Chain and Legal
  });

  it("decisions wait on the accountable manager (the Approvals inbox lists them)", async () => {
    const decide = async (email: string) => (await listMyDecisions(appDb, orgId, await as(email))).map((d) => d.title);
    expect(await decide("avi@vector-retail.example")).toEqual([expect.stringMatching(/Haifa Grand Canyon net sales/)]);
    expect(await decide("maya@vector-retail.example")).toEqual(["Labor cost 6% over plan across the Center region"]);
    expect(await decide("eitan@vector-retail.example")).toHaveLength(3);
    expect(await decide("dana@vector-retail.example")).toEqual([]); // nothing is group-level: the CEO isn't flooded
    expect(await decide("tal@vector-retail.example")).toEqual([]); // viewers never decide
  });

  it("performance views follow the viewer's position", async () => {
    const pos = async (email: string) => (await performanceView(appDb, orgId, await as(email)))!;
    const dana = await pos("dana@vector-retail.example");
    expect(dana.position).toBe("group");
    expect("children" in dana && dana.children.map((c) => c.name).sort()).toEqual([
      "Center",
      "Coast",
      "Jerusalem",
      "North",
      "South",
    ]);
    expect("departmentPulse" in dana && dana.departmentPulse).toHaveLength(8);
    const maya = await pos("maya@vector-retail.example");
    expect(maya.position).toBe("region");
    expect("children" in maya && maya.children).toHaveLength(12);
    const labor = maya.kpis.find((k) => k.code === "labor_pct")!;
    expect(labor.status).toBe("bad"); // R11 is visible in the data, not only in the insight
    const lior = await pos("lior@vector-retail.example");
    expect(lior.position).toBe("branch");
    expect(lior.kpis.find((k) => k.code === "shrink_pct")!.status).toBe("bad");
    const noa = await pos("noa@vector-retail.example");
    expect(noa.position).toBe("department");
    expect("owned" in noa && noa.owned.map((i) => i.band).sort()).toEqual(["P1", "P1"]);
    expect("weDependOn" in noa && noa.weDependOn.length).toBeGreaterThan(0);
  });

  it("the trace explains it: two signals' worth of evidence, a transfer for Noa, a note for Avi", async () => {
    const ins = await haifa("avi@vector-retail.example");
    const t = (await getInsightTrace(appDb, orgId, await as("avi@vector-retail.example"), ins.id))!;
    expect(t.evidence.map((e) => e.title)).toEqual([
      expect.stringMatching(/Net sales/),
      expect.stringMatching(/availability/),
    ]);
    expect(t.insight.whyItMatters).toMatch(/stock problem/);
    expect(t.actions.map((a) => a.type).sort()).toEqual(["inventory_transfer", "notify_owner"]);
    // Assigned to the head of Supply Chain, deterministically, although the department has two managers.
    const noa = await as("noa@vector-retail.example");
    expect(t.actions.find((a) => a.type === "inventory_transfer")!.ownerUserId).toBe(
      noa.kind === "user" ? noa.userId : "",
    );
  });

  it("Avi accepts, Yossi approves, execution follows, and 8 days later the outcome is 'worked'", async () => {
    const ctx = await createContext(appDb, { orgId });
    const ins = await haifa("avi@vector-retail.example");
    const t = (await getInsightTrace(appDb, orgId, await as("avi@vector-retail.example"), ins.id))!;
    await acceptDecision(ctx, await as("avi@vector-retail.example"), t.decisions[0].id, "Stock is the cause");
    await executeReadyActions(ctx); // the notification needs no approval
    const inbox = (await listMyApprovals(appDb, orgId, await as("yossi@vector-retail.example"))).filter(
      (a) => a.insightId === ins.id,
    );
    expect(inbox).toHaveLength(1);
    await grantApproval(ctx, await as("yossi@vector-retail.example"), inbox[0].action.id, "Approved");
    expect(await executeReadyActions(ctx)).toHaveLength(1);

    const admin = await as("admin@vector-retail.example");
    await advanceClock(appDb, admin, 24 * 8 + 1);
    const after = (await getInsightTrace(appDb, orgId, await as("dana@vector-retail.example"), ins.id))!;
    expect(after.outcomes[0].verdict).toBe("worked");
    expect(after.insight.status).toBe("resolved");
    expect((await verifyAuditChain(appDb, orgId)).ok).toBe(true);
  });

  it("only Admin may drive the demo", async () => {
    await expect(advanceClock(appDb, await as("dana@vector-retail.example"), 1)).rejects.toThrow(/demo.control/);
  });
});
