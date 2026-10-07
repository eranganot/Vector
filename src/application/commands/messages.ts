/**
 * Approve and send (plan v2, E4; action-center.md §3–§4). Built on the existing lifecycle — decide → submit actions
 * (approval policy) → approvals → execution — so it opens no second path around governance. The message is stored
 * as approved and sent only once no action of the decision still waits for an approval. Sending goes through the
 * channel seam; in the demo that is in-app only (FB-8). Every step is audited.
 */
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { DomainError } from "@/domain/errors";
import { assertAuthorized, authorizeSystem } from "@/domain/policy/authorize";
import type { Actor } from "@/domain/types";
import { channelAdapter } from "@/infra/channels";
import { action, decision, insight, outboundMessage, user } from "@/infra/db/schema";
import { type AppContext, runCommand } from "../context";
import { acceptDecision, declineDecision, grantApproval } from "./lifecycle";
import { notFound, SYSTEM } from "./shared";

export type ApproveAndSendInput = {
  toUserId: string;
  ccUserIds: string[];
  subject: string;
  body: string;
  language: "en" | "he";
  templateId: string;
  /** The message as VECTOR suggested it, to record whether the sender edited it. */
  suggestedBody: string;
  /** Actions whose approval is routed to the sender, granted on the same click. */
  grantActionIds?: string[];
};

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

/** Decides the insight's recommendation (when still open), then approves the message for sending. */
export async function approveAndSend(ctx: AppContext, actor: Actor, insightId: string, input: ApproveAndSendInput) {
  if (actor.kind !== "user") throw new DomainError("NotAuthorized", "AZ-4: messages come from people");
  if (input.body.trim().length < 10) throw new DomainError("Invalid", "write the message");
  const [dec] = await ctx.db
    .select()
    .from(decision)
    .where(and(eq(decision.orgId, ctx.orgId), eq(decision.insightId, insightId)));
  if (!dec) notFound("decision");
  // Deciding is the existing, authorized and audited command (decision.decide on the insight's unit).
  if (dec.status === "recommended") await acceptDecision(ctx, actor, dec.id, "Approved in the Action Center");
  else if (dec.status !== "decided") throw new DomainError("IllegalTransition", "this recommendation was declined");
  // Approvals routed to the sender are granted with the same click (each one the existing, audited approval command;
  // AZ-2 still applies: nobody approves their own action).
  // The ids are the steps the sender saw as theirs to approve; deciding has just submitted them for approval.
  const grant = input.grantActionIds ?? [];
  if (grant.length) {
    const waiting = await ctx.db
      .select({ id: action.id })
      .from(action)
      .where(and(eq(action.orgId, ctx.orgId), inArray(action.id, grant), eq(action.status, "pending_approval")));
    for (const a of waiting) await grantApproval(ctx, actor, a.id, "Approved in the Action Center");
  }

  const id = await runCommand(
    ctx,
    actor,
    "message.approve",
    { entityType: "decision", entityId: dec.id },
    async ({ tx, now, audit }) => {
      const [ins] = await tx.select().from(insight).where(eq(insight.id, insightId));
      const people = await tx
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.orgId, ctx.orgId), inArray(user.id, [input.toUserId, ...input.ccUserIds])));
      if (!people.some((p) => p.id === input.toUserId)) throw new DomainError("Invalid", "choose who it goes to");
      const edited = input.body.trim() !== input.suggestedBody.trim();
      const [m] = await tx
        .insert(outboundMessage)
        .values({
          orgId: ctx.orgId,
          insightId,
          decisionId: dec.id,
          channel: "in_app",
          fromUserId: actor.userId,
          toUserIds: [input.toUserId],
          ccUserIds: input.ccUserIds.filter((c) => c !== input.toUserId && people.some((p) => p.id === c)),
          subject: input.subject.trim(),
          body: input.body.trim(),
          language: input.language,
          templateId: input.templateId,
          edited,
          status: "approved",
          approvedBy: actor.userId,
          approvedAt: now,
          visibleUnitIds: ins.visibleUnitIds,
          createdAt: now,
        })
        .returning();
      await audit({
        operation: "message.drafted",
        entityType: "outbound_message",
        entityId: m.id,
        changes: { templateId: input.templateId, language: input.language, suggestedHash: hash(input.suggestedBody) },
      });
      if (edited)
        await audit({
          operation: "message.edited",
          entityType: "outbound_message",
          entityId: m.id,
          changes: { from: hash(input.suggestedBody), to: hash(m.body) },
        });
      await audit({
        operation: "message.approved",
        entityType: "outbound_message",
        entityId: m.id,
        toState: "approved",
        changes: { to: m.toUserIds, cc: m.ccUserIds, channel: m.channel },
      });
      return m.id;
    },
  );
  await releaseMessages(ctx, dec.id);
  return id;
}

/** Declines the recommendation from the Action Center (the existing decline, with its reason). */
export async function declineInCenter(ctx: AppContext, actor: Actor, insightId: string, rationale: string) {
  const [dec] = await ctx.db
    .select()
    .from(decision)
    .where(and(eq(decision.orgId, ctx.orgId), eq(decision.insightId, insightId)));
  if (!dec) notFound("decision");
  await declineDecision(ctx, actor, dec.id, rationale);
}

/**
 * Sends the approved messages of a decision once none of its actions waits for an approval (system:executor). Safe to
 * call any time: after a decision, after an approval, on the clock.
 */
export async function releaseMessages(ctx: AppContext, decisionId?: string) {
  const actor = SYSTEM.executor;
  const waiting = await ctx.db
    .select()
    .from(outboundMessage)
    .where(
      and(
        eq(outboundMessage.orgId, ctx.orgId),
        eq(outboundMessage.status, "approved"),
        ...(decisionId ? [eq(outboundMessage.decisionId, decisionId)] : []),
      ),
    );
  let sent = 0;
  for (const m of waiting) {
    const acts = await ctx.db.select().from(action).where(eq(action.decisionId, m.decisionId));
    const live = acts.filter((a) => a.status !== "cancelled" && a.status !== "rejected");
    if (live.length === 0) {
      await runCommand(
        ctx,
        actor,
        "message.cancel",
        { entityType: "outbound_message", entityId: m.id },
        async ({ tx, audit }) => {
          assertAuthorized(authorizeSystem(actor, "message.send"));
          await tx.update(outboundMessage).set({ status: "cancelled" }).where(eq(outboundMessage.id, m.id));
          await audit({
            operation: "message.cancelled",
            entityType: "outbound_message",
            entityId: m.id,
            fromState: "approved",
            toState: "cancelled",
            reason: "every action was cancelled or rejected",
          });
        },
      );
      continue;
    }
    if (live.some((a) => a.status === "pending_approval" || a.status === "proposed")) continue;
    await runCommand(
      ctx,
      actor,
      "message.send",
      { entityType: "outbound_message", entityId: m.id },
      async ({ tx, now, audit }) => {
        assertAuthorized(authorizeSystem(actor, "message.send"));
        const receipt = await channelAdapter(m.channel as "in_app").send(
          { channel: "in_app", toUserIds: [...m.toUserIds, ...m.ccUserIds], subject: m.subject, body: m.body },
          now,
        );
        await tx
          .update(outboundMessage)
          .set({ status: "sent", sentAt: receipt.deliveredAt, adapter: receipt.adapter, simulated: receipt.simulated })
          .where(eq(outboundMessage.id, m.id));
        await audit({
          operation: "message.sent",
          entityType: "outbound_message",
          entityId: m.id,
          fromState: "approved",
          toState: "sent",
          changes: { adapter: receipt.adapter, simulated: receipt.simulated, to: m.toUserIds, cc: m.ccUserIds },
        });
      },
    );
    sent++;
  }
  return sent;
}
