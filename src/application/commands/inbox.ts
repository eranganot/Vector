/**
 * Reply from the Inbox (plan v2, E7; mail-agent.md §2). The person approves VECTOR's suggested reply, edited or not,
 * and it becomes an OutboundMessage sent through the channel seam: in-app only in the demo (FB-8). A colleague reads it
 * in VECTOR; an outside party (a supplier, an agency) is named and never contacted. Drafted, edited, approved and sent
 * are audited, and the reply joins the thread.
 */
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { DomainError } from "@/domain/errors";
import type { Actor } from "@/domain/types";
import { channelAdapter } from "@/infra/channels";
import { inboxMessage, inboxThread, outboundMessage, user } from "@/infra/db/schema";
import { type AppContext, runCommand } from "../context";
import { notFound } from "./shared";

export type InboxReplyInput = {
  body: string;
  /** The reply as VECTOR suggested it (in the language shown), to record whether the sender edited it. */
  suggestedBody: string;
  language: "en" | "he";
};

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

export async function replyToThread(ctx: AppContext, actor: Actor, threadId: string, input: InboxReplyInput) {
  if (actor.kind !== "user") throw new DomainError("NotAuthorized", "AZ-4: replies come from people");
  return runCommand(
    ctx,
    actor,
    "inbox.reply",
    { entityType: "inbox_thread", entityId: threadId },
    async ({ tx, now, audit }) => {
      const [t] = await tx
        .select()
        .from(inboxThread)
        .where(and(eq(inboxThread.orgId, ctx.orgId), eq(inboxThread.id, threadId)));
      // Someone else's thread looks missing (an inbox is personal).
      if (!t || t.ownerUserId !== actor.userId) notFound("thread");
      const body = input.body.trim();
      if (body.length < 10) throw new DomainError("Invalid", "write the reply");
      const [me] = await tx.select({ name: user.name }).from(user).where(eq(user.id, actor.userId));
      const edited = body !== input.suggestedBody.trim();
      const receipt = await channelAdapter("in_app").send(
        { channel: "in_app", toUserIds: t.counterpartUserId ? [t.counterpartUserId] : [], subject: t.subject, body },
        now,
      );
      const [m] = await tx
        .insert(outboundMessage)
        .values({
          orgId: ctx.orgId,
          inboxThreadId: t.id,
          channel: "in_app",
          fromUserId: actor.userId,
          toUserIds: t.counterpartUserId ? [t.counterpartUserId] : [],
          ccUserIds: [],
          toExternal: t.counterpartUserId ? null : `${t.counterpartName} (${t.counterpartRole})`,
          subject: `Re: ${t.subject}`,
          body,
          language: input.language,
          templateId: t.templateId,
          edited,
          status: "sent",
          approvedBy: actor.userId,
          approvedAt: now,
          sentAt: receipt.deliveredAt,
          adapter: receipt.adapter,
          simulated: receipt.simulated,
          visibleUnitIds: actor.assignments.map((a) => a.unit.id),
          createdAt: now,
        })
        .returning();
      await tx.insert(inboxMessage).values({
        orgId: ctx.orgId,
        threadId: t.id,
        fromName: me?.name ?? "",
        fromOwner: true,
        toOwner: false,
        at: now,
        body,
        outboundMessageId: m.id,
      });
      await audit({
        operation: "message.drafted",
        entityType: "outbound_message",
        entityId: m.id,
        changes: {
          source: "inbox",
          threadId: t.id,
          templateId: t.templateId,
          suggestedHash: hash(input.suggestedBody),
        },
      });
      if (edited)
        await audit({
          operation: "message.edited",
          entityType: "outbound_message",
          entityId: m.id,
          changes: { from: hash(input.suggestedBody), to: hash(body) },
        });
      await audit({
        operation: "message.approved",
        entityType: "outbound_message",
        entityId: m.id,
        toState: "approved",
        changes: { to: m.toUserIds, external: m.toExternal },
      });
      await audit({
        operation: "message.sent",
        entityType: "outbound_message",
        entityId: m.id,
        fromState: "approved",
        toState: "sent",
        changes: {
          adapter: receipt.adapter,
          simulated: receipt.simulated,
          to: m.toUserIds,
          // An outside party is never contacted in the demo (FB-8): the reply is recorded, not delivered.
          external: m.toExternal ? "not contacted (demo)" : null,
        },
      });
      return m.id;
    },
  );
}
