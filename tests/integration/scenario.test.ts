/** The Phase 2 demo, driven like the UI will drive it: reset → detector → decide → approve → clock → outcome. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import { verifyAuditChain } from "@/application/audit";
import { acceptDecision, executeReadyActions, grantApproval } from "@/application/commands/lifecycle";
import { createContext, loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { getInsightTrace, listInsights, listMyApprovals } from "@/application/queries/insights";
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

  it("reset seeds a new epoch and the detector finds exactly the planted story", async () => {
    // Bootstrap an epoch so the Admin persona exists, then reset as that Admin.
    orgId = (await seed(ownerDb, { password: "test-password" })).orgId;
    const admin = await as("admin@vector-retail.example");
    const r = await resetDemo(appDb, admin, "test-password");
    orgId = r.orgId;
    expect(r.detections).toHaveLength(1);
    const list = await listInsights(appDb, orgId, await as("dana@vector-retail.example"));
    expect(list).toHaveLength(1);
    expect(list[0].title).toMatch(/Haifa Grand Canyon net sales −1\d\.\d% vs\. usual/);
    expect(list[0].priorityBand).toBe("P2");
  });

  it("the trace explains it: two signals' worth of evidence, a transfer for Noa, a note for Avi", async () => {
    const [ins] = await listInsights(appDb, orgId, await as("avi@vector-retail.example"));
    const t = (await getInsightTrace(appDb, orgId, await as("avi@vector-retail.example"), ins.id))!;
    expect(t.evidence.map((e) => e.title)).toEqual([
      expect.stringMatching(/Net sales/),
      expect.stringMatching(/availability/),
    ]);
    expect(t.insight.whyItMatters).toMatch(/stock problem/);
    expect(t.actions.map((a) => a.type).sort()).toEqual(["inventory_transfer", "notify_owner"]);
  });

  it("Avi accepts, Yossi approves, execution follows, and 8 days later the outcome is 'worked'", async () => {
    const ctx = await createContext(appDb, { orgId });
    const [ins] = await listInsights(appDb, orgId, await as("avi@vector-retail.example"));
    const t = (await getInsightTrace(appDb, orgId, await as("avi@vector-retail.example"), ins.id))!;
    await acceptDecision(ctx, await as("avi@vector-retail.example"), t.decisions[0].id, "Stock is the cause");
    await executeReadyActions(ctx); // the notification needs no approval
    const inbox = await listMyApprovals(appDb, orgId, await as("yossi@vector-retail.example"));
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
