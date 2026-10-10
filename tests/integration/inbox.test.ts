/**
 * E7: the Inbox — a person reads only their own threads; inbox-v1 classifies them; impact comes from the linked
 * VECTOR story; follow-up answers are prepared from data; a reply becomes an audited OutboundMessage delivered in
 * VECTOR only (outside parties are named, never contacted).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { replyToThread } from "@/application/commands/inbox";
import { createContext, loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { messagesForMe } from "@/application/queries/action-center";
import { inboxView } from "@/application/queries/inbox";
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
    .where(and(eq(s.user.orgId, orgId), eq(s.user.email, `${key}@vector-retail.example`)));
  return loadUserActor(appDb, orgId, u.id, { sessionId: `ib-${key}`, viaDemoSwitcher: true });
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

describe("Inbox (E7)", () => {
  it("each C-suite persona has 15 threads; decisions first, with ₪ from the linked story", async () => {
    const v = (await inboxView(appDb, orgId, await as("dana")))!;
    expect(v.counts).toEqual({ decision: 1, reply: 2, recent: 2, total: 15 });
    const first = v.threads[0];
    expect(first.subject).toBe("Overtime for the North DC second shift: exception to the freeze?");
    expect(first.cls).toBe("decision");
    expect(first.link?.type).toBe("insight");
    expect(first.impactIls).toBeGreaterThan(0); // from the North DC story's priority (R2)
    const avi = (await inboxView(appDb, orgId, await as("avi")))!;
    expect(avi.threads).toHaveLength(0); // not C-suite: no inbox in the demo
  });

  it("an inbox is personal: another person's thread is not visible, not even by id", async () => {
    const dana = (await inboxView(appDb, orgId, await as("dana")))!;
    const peek = (await inboxView(appDb, orgId, await as("michal"), { threadId: dana.threads[0].id }))!;
    expect(peek.selected).toBeNull();
    await expect(
      replyToThread(await createContext(appDb, { orgId }), await as("michal"), dana.threads[0].id, {
        body: "Approved, go ahead with it.",
        suggestedBody: "",
        language: "en",
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("prepared follow-up answers come from the data", async () => {
    const dana = await as("dana");
    const id = (await inboxView(appDb, orgId, dana))!.threads[0].id;
    const sel = (await inboxView(appDb, orgId, dana, { threadId: id }))!.selected!;
    expect(sel.followUps.map((f) => f.key)).toEqual(["wait_week", "cost", "who_affected"]);
    expect(sel.followUps[0].params.m).toMatch(/^₪[\d,]+k$/);
    expect(String(sel.followUps[2].params.list)).toContain("North");
    expect(sel.suggestedReply).toMatch(/approved as an exception/);
  });

  it("approve and send: an audited in-app message to a colleague, the thread is answered, she reads it", async () => {
    const dana = await as("dana");
    const v = (await inboxView(appDb, orgId, dana))!;
    const id = v.threads[0].id;
    const sel = (await inboxView(appDb, orgId, dana, { threadId: id }))!.selected!;
    const msgId = await replyToThread(await createContext(appDb, { orgId }), dana, id, {
      body: `${sel.suggestedReply} Thanks.`,
      suggestedBody: sel.suggestedReply!,
      language: "en",
    });
    const [m] = await appDb.select().from(s.outboundMessage).where(eq(s.outboundMessage.id, msgId));
    expect(m).toMatchObject({ status: "sent", channel: "in_app", simulated: true, edited: true, insightId: null });
    const ops = (
      await appDb
        .select({ op: s.auditEvent.operation })
        .from(s.auditEvent)
        .where(and(eq(s.auditEvent.orgId, orgId), eq(s.auditEvent.entityId, msgId)))
        .orderBy(s.auditEvent.seq)
    ).map((r) => r.op);
    expect(ops).toEqual(["message.drafted", "message.edited", "message.approved", "message.sent"]);
    const after = (await inboxView(appDb, orgId, dana, { threadId: id }))!;
    expect(after.selected!.cls).toBe("done");
    expect(after.counts.decision).toBe(0);
    const michal = await messagesForMe(appDb, orgId, await as("michal"));
    expect(michal.some((x) => x.id === msgId && x.insightId === null)).toBe(true);
  });

  it("a reply to an outside party is recorded, never delivered (FB-8)", async () => {
    const eitan = await as("eitan");
    const v = (await inboxView(appDb, orgId, eitan))!;
    const t = v.threads.find((x) => x.subject.startsWith("Price increase of 7%"))!;
    expect(t.internal).toBe(false);
    const msgId = await replyToThread(await createContext(appDb, { orgId }), eitan, t.id, {
      body: "Gadi, we are invoking the 30-day price-protection clause.",
      suggestedBody: "Gadi, we are invoking the 30-day price-protection clause.",
      language: "en",
    });
    const [m] = await appDb.select().from(s.outboundMessage).where(eq(s.outboundMessage.id, msgId));
    expect(m.toUserIds).toEqual([]);
    expect(m.toExternal).toBe("Gadi Levin (Sales director, Dairy Co.)");
    expect(m.edited).toBe(false);
  });

  it("refuses an empty reply", async () => {
    const yael = await as("yael");
    const t = (await inboxView(appDb, orgId, yael))!.threads.find((x) => x.cls !== "done")!;
    await expect(
      replyToThread(await createContext(appDb, { orgId }), yael, t.id, {
        body: "ok",
        suggestedBody: "",
        language: "en",
      }),
    ).rejects.toThrow(/write the reply/);
  });
});
