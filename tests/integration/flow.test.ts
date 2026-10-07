/**
 * E4d: knock-on-v1 on the seeded organization — the event → action plan and the cross-department dependency flow,
 * today and under a what-if delay; and visibility (only commitments the viewer may see are drawn).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { dependencyFlow, eventPlan } from "@/application/queries/flow";
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
  return loadUserActor(appDb, orgId, u.id, { sessionId: `flow-${key}`, viaDemoSwitcher: true });
};
const initiativeCommitments = async (key: string) =>
  (
    await appDb
      .select()
      .from(s.initiative)
      .where(and(eq(s.initiative.orgId, orgId), eq(s.initiative.key, key)))
  )[0].commitmentIds;

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

describe("event → action plan (E4d)", () => {
  it("lists the meeting's tasks late first, with who waits on each and the ₪ of doing it late", async () => {
    const e = (await eventPlan(appDb, orgId, await as("dana")))!;
    expect(e.source).toBe("Weekly ops meeting · 15 Oct");
    expect(e.tasks.length).toBe(4);
    expect(e.tasks[0].flowStatus).toBe("late");
    expect(e.counts.late).toBeGreaterThan(0);
    const signage = e.tasks.find((x) => x.title.startsWith("Holiday promo signage"))!;
    expect(signage.waiting.map((w) => w.unitName)).toContain("Store Operations");
    // Late, but Store Operations needs it only later: nothing lost yet, a week more costs money down the line.
    expect(signage.lostIls).toBe(0);
    expect(signage.slackDays).toBeGreaterThanOrEqual(0);
    expect(signage.weekLate!.extraIls).toBeGreaterThan(0);
    expect(signage.weekLate!.units).toContain("Store Operations");
    expect(e.departments).toBeGreaterThan(4);
  });
});

describe("dependency flow (E4d)", () => {
  it("draws the holiday chain and groups the regions at the end of the line", async () => {
    const f = (await dependencyFlow(appDb, orgId, await as("dana"), await initiativeCommitments("I-HOLIDAY")))!;
    const titles = f.nodes.map((n) => n.title);
    expect(titles).toContain("Holiday promo signage and shelf talkers for 60 branches");
    expect(titles).toContain("Holiday promotion live in all 60 branches");
    const regions = f.ends.find((x) => x.unitNames.length === 5)!;
    expect(regions.unitNames.sort()).toEqual(["Center", "Coast", "Jerusalem", "North", "South"]);
    const launch = f.nodes.find((n) => n.title.startsWith("Holiday promotion live"))!;
    expect(launch.depth).toBeGreaterThan(f.nodes.find((n) => n.title.startsWith("Holiday promo signage"))!.depth);
  });

  it("a what-if delay at Marketing reaches Store Operations and the regions, in days and ₪", async () => {
    const dana = await as("dana");
    const ids = await initiativeCommitments("I-HOLIDAY");
    const today = (await dependencyFlow(appDb, orgId, dana, ids))!;
    const signage = today.nodes.find((n) => n.title.startsWith("Holiday promo signage"))!;
    const f = (await dependencyFlow(appDb, orgId, dana, ids, { nodeId: signage.id, days: 7 }))!;
    expect(f.whatIf).toMatchObject({ days: 7 });
    expect(f.summary.lateUnits).toEqual(expect.arrayContaining(["Store Operations", "North", "South"]));
    expect(f.summary.totalIls).toBeGreaterThan(f.summary.baselineIls);
    expect(f.nodes.find((n) => n.title.startsWith("Holiday promotion live"))!.flowStatus).toBe("at_risk");
    // An id outside the flow is ignored.
    const none = (await dependencyFlow(appDb, orgId, dana, ids, { nodeId: orgId, days: 7 }))!;
    expect(none.whatIf).toBeNull();
  });

  it("draws only commitments the viewer may see", async () => {
    const ids = await initiativeCommitments("I-HOLIDAY");
    const hila = (await dependencyFlow(appDb, orgId, await as("hila"), ids))!;
    expect(hila.nodes.map((n) => n.title).sort()).toEqual([
      "Compliant holiday rosters for 60 branches",
      "Publish updated pay tables for the new wage rule",
    ]);
    expect(await dependencyFlow(appDb, orgId, await as("avi"), ids)).toBeNull();
  });
});
