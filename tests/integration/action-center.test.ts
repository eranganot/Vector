/**
 * E4: the Action Center (action-center.md §3–§5): suggestions, approve & send through the lifecycle, messages held
 * until policy approvals are granted, in-app delivery only, and the audit trail of every step.
 */
import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { createContext, loadUserActor } from "@/application/context";
import type { Db } from "@/application/db";
import { grantApproval } from "@/application/commands/lifecycle";
import { approveAndSend, declineInCenter, releaseMessages } from "@/application/commands/messages";
import { actionCenter, messagesForMe } from "@/application/queries/action-center";
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
  return loadUserActor(appDb, orgId, u.id, { sessionId: `ac-${key}`, viaDemoSwitcher: true });
};
const keyOf = async (name: string) =>
  (await appDb.select().from(s.user).where(eq(s.user.name, name)))[0].email.split("@")[0];

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

describe("Action Center (E4)", () => {
  it("ranks a queue with one button each and suggests whom to send to, with reasons and a message", async () => {
    const v = (await actionCenter(appDb, orgId, await as("dana"), { locale: "en" }))!;
    if (process.env.AC_DUMP)
      writeFileSync(
        process.env.AC_DUMP,
        JSON.stringify({ queue: v.queue, selected: v.selected, event: v.event }, null, 1),
      );
    expect(v.queue.length).toBeGreaterThan(2);
    const scores = v.queue.map((q) => q.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(v.queue.some((q) => q.button === "approve_send")).toBe(true);
    const sel = v.selected!;
    expect(sel.to).not.toBeNull();
    expect(sel.to!.reason).toMatchObject({ kind: "owns" });
    expect(sel.message!.body).toContain(sel.to!.name.split(" ")[0]);
    expect(sel.chain.length).toBeGreaterThan(0);
    expect(sel.history.length).toBeGreaterThan(0);
  });

  it("approve & send holds the message until the policy approval is granted, then delivers it in-app", async () => {
    const dana = await as("dana");
    const v = (await actionCenter(appDb, orgId, dana, { locale: "en" }))!;
    const item = v.queue.find((q) => q.button === "approve_send");
    let target: NonNullable<typeof v.selected> | null = null;
    for (const q of v.queue.filter((x) => x.button === "approve_send")) {
      const d = (await actionCenter(appDb, orgId, dana, { insightId: q.insightId, locale: "en" }))!.selected!;
      if (d.steps.some((x) => x.approval)) {
        target = d;
        break;
      }
    }
    expect(item).toBeTruthy();
    expect(target, "an item whose action needs approval").not.toBeNull();
    const ctx = await createContext(appDb);
    const msgId = await approveAndSend(ctx, dana, target!.id, {
      toUserId: target!.to!.id,
      ccUserIds: target!.cc.map((c) => c.id),
      subject: target!.message!.subject,
      body: `${target!.message!.body}\nPlease confirm today.`,
      language: "en",
      templateId: target!.message!.templateId,
      suggestedBody: target!.message!.body,
    });
    const [m] = await appDb.select().from(s.outboundMessage).where(eq(s.outboundMessage.id, msgId));
    expect(m.status).toBe("approved");
    expect(m.edited).toBe(true);
    const toKey = await keyOf(target!.to!.name);
    expect((await messagesForMe(appDb, orgId, await as(toKey))).some((x) => x.id === msgId)).toBe(false);

    // The routed approver grants; the message goes out.
    const pending = await appDb
      .select()
      .from(s.action)
      .where(and(eq(s.action.insightId, target!.id), eq(s.action.status, "pending_approval")));
    for (const a of pending) {
      const step = target!.steps.find((x) => x.id === a.id)!;
      const approverKey = await keyOf(step.approval!.approvers[0]);
      await grantApproval(ctx, await as(approverKey), a.id, "ok");
    }
    await releaseMessages(ctx);
    const [after] = await appDb.select().from(s.outboundMessage).where(eq(s.outboundMessage.id, msgId));
    expect(after.status).toBe("sent");
    expect(after.adapter).toBe("in_app");
    expect(after.simulated).toBe(true);
    expect((await messagesForMe(appDb, orgId, await as(toKey))).some((x) => x.id === msgId)).toBe(true);

    const ops = (
      await appDb
        .select()
        .from(s.auditEvent)
        .where(and(eq(s.auditEvent.orgId, orgId), eq(s.auditEvent.entityId, msgId)))
    ).map((e) => e.operation);
    expect(ops).toEqual(["message.drafted", "message.edited", "message.approved", "message.sent"]);
  });

  it("declines with a reason through the existing decline; someone without the right is refused", async () => {
    const dana = await as("dana");
    const v = (await actionCenter(appDb, orgId, dana, { locale: "en" }))!;
    const q = v.queue.find((x) => x.button === "approve_send")!;
    const ctx = await createContext(appDb);
    await expect(declineInCenter(ctx, await as("hila"), q.insightId, "not mine")).rejects.toThrow();
    await declineInCenter(ctx, dana, q.insightId, "We handle it in the weekly review");
    const [d] = await appDb.select().from(s.decision).where(eq(s.decision.insightId, q.insightId));
    expect(d.status).toBe("declined");
  });

  it("an approver approves and sends in one click: the routed approval is granted and the message goes out", async () => {
    const dana = await as("dana");
    const ctx = await createContext(appDb);
    const v = (await actionCenter(appDb, orgId, dana, { locale: "en" }))!;
    let target: NonNullable<typeof v.selected> | null = null;
    for (const q of v.queue.filter((x) => x.button === "approve_send")) {
      const d = (await actionCenter(appDb, orgId, dana, { insightId: q.insightId, locale: "en" }))!.selected!;
      if (d.steps.some((x) => x.approval?.youMay) && d.steps.every((x) => !x.approval || x.approval.youMay)) {
        target = d;
        break;
      }
    }
    expect(target, "an item whose only approvals are routed to Dana").not.toBeNull();
    const msgId = await approveAndSend(ctx, dana, target!.id, {
      toUserId: target!.to!.id,
      ccUserIds: [],
      subject: target!.message!.subject,
      body: target!.message!.body,
      language: "en",
      templateId: target!.message!.templateId,
      suggestedBody: target!.message!.body,
      grantActionIds: target!.steps.filter((x) => x.approval?.youMay).map((x) => x.id),
    });
    const [m] = await appDb.select().from(s.outboundMessage).where(eq(s.outboundMessage.id, msgId));
    expect(m.status).toBe("sent");
    expect(m.edited).toBe(false);
    const grants = await appDb
      .select()
      .from(s.approval)
      .where(
        and(
          eq(s.approval.orgId, orgId),
          eq(s.approval.status, "granted"),
          eq(s.approval.approverUserId, (dana as { userId: string }).userId),
        ),
      );
    expect(grants.length).toBeGreaterThan(0);
  });

  it("writes the suggestion in Hebrew for a Hebrew reader", async () => {
    const v = (await actionCenter(appDb, orgId, await as("dana"), { locale: "he" }))!;
    expect(v.selected!.message!.templateId).toMatch(/:he$/);
    expect(v.selected!.message!.body).toMatch(/[֐-׿]/);
  });
});
