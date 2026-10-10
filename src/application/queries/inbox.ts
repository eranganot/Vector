/**
 * Inbox read model (plan v2, E7; mail-agent.md §1–§2). A person reads only their own threads. Classification is
 * inbox-v1 (pure, from thread fields); impact, deadline and who is affected come from the linked VECTOR entity when
 * the thread does not carry its own, so they agree with every other screen. Follow-up answers are prepared from data
 * (FB-10: no free-form questions in the demo).
 */
import { and, eq, inArray } from "drizzle-orm";
import { answer, classify, inboxOrder, type AnswerFacts, type FollowUp } from "@/domain/inbox";
import type { Actor } from "@/domain/types";
import {
  commitment,
  demoClock,
  inboxMessage,
  inboxThread,
  initiative,
  insight,
  orgUnit,
  outboundMessage,
} from "@/infra/db/schema";
import type { DbOrTx } from "../db";
import { lessonsForInsight } from "./actions";
import { listMyDecisions } from "./insights";

type Breakdown = { input?: { impactIls?: number; valueIls?: number } } | null;

export async function inboxView(db: DbOrTx, orgId: string, actor: Actor, opts: { threadId?: string } = {}) {
  if (actor.kind !== "user") return null;
  const [clock] = await db.select().from(demoClock).where(eq(demoClock.orgId, orgId));
  const now = clock?.now ?? new Date();
  const threads = await db
    .select()
    .from(inboxThread)
    .where(and(eq(inboxThread.orgId, orgId), eq(inboxThread.ownerUserId, actor.userId)));
  if (!threads.length)
    return { now, threads: [], counts: { decision: 0, reply: 0, recent: 0, total: 0 }, selected: null };
  const messages = await db
    .select()
    .from(inboxMessage)
    .where(
      inArray(
        inboxMessage.threadId,
        threads.map((t) => t.id),
      ),
    );
  const ofType = (type: string) => threads.filter((t) => t.linkType === type && t.linkId).map((t) => t.linkId!);
  const [insights, commitments, initiatives, units, waiting] = await Promise.all([
    ofType("insight").length
      ? db
          .select()
          .from(insight)
          .where(inArray(insight.id, ofType("insight")))
      : [],
    ofType("commitment").length
      ? db
          .select()
          .from(commitment)
          .where(inArray(commitment.id, ofType("commitment")))
      : [],
    ofType("initiative").length
      ? db
          .select()
          .from(initiative)
          .where(inArray(initiative.id, ofType("initiative")))
      : [],
    db.select({ id: orgUnit.id, name: orgUnit.name }).from(orgUnit).where(eq(orgUnit.orgId, orgId)),
    listMyDecisions(db, orgId, actor),
  ]);
  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "";
  const waitingInsights = new Set(waiting.map((d) => d.insightId));

  const link = (t: (typeof threads)[number]) => {
    if (t.linkType === "insight") {
      const i = insights.find((x) => x.id === t.linkId);
      if (!i) return null;
      const b = i.priorityBreakdown as Breakdown;
      return {
        type: "insight" as const,
        title: i.title,
        href: `/insights/${i.id}`,
        band: i.priorityBand,
        workstream: i.workstream,
        impactIls: b?.input?.impactIls ?? b?.input?.valueIls ?? null,
        affected: [...new Set([i.primaryUnitId, ...i.affectedUnitIds])].map(unitName).filter(Boolean),
        deadline: null as Date | null,
      };
    }
    if (t.linkType === "commitment") {
      const c = commitments.find((x) => x.id === t.linkId);
      if (!c) return null;
      return {
        type: "commitment" as const,
        title: c.title,
        href: `/commitments`,
        band: null,
        workstream: null,
        impactIls: c.impactIls > 0 ? c.impactIls : null,
        affected: [c.ownerUnitId, ...c.beneficiaryUnitIds].map(unitName).filter(Boolean),
        deadline: c.dueAt,
      };
    }
    if (t.linkType === "initiative") {
      const i = initiatives.find((x) => x.id === t.linkId);
      if (!i) return null;
      return {
        type: "initiative" as const,
        title: i.title,
        href: `/initiatives?i=${i.key}`,
        band: null,
        workstream: null,
        impactIls: null,
        affected: i.participatingUnitIds.map(unitName).filter(Boolean),
        deadline: null,
      };
    }
    return null;
  };

  const rows = threads.map((t) => {
    const msgs = messages.filter((m) => m.threadId === t.id).sort((a, b) => a.at.getTime() - b.at.getTime());
    const last = msgs.at(-1)!;
    const l = link(t);
    const c = classify(
      {
        lastFromOwner: last.fromOwner,
        lastAt: last.at,
        addressedToOwner: last.toOwner,
        asks: t.asks,
        decisionTag: t.decisionTag,
        urgent: t.urgent,
        linkedDecisionWaiting: t.linkType === "insight" && !!t.linkId && waitingInsights.has(t.linkId),
      },
      now,
    );
    return {
      id: t.id,
      channel: t.channel,
      subject: t.subject,
      counterpartName: t.counterpartName,
      counterpartRole: t.counterpartRole,
      internal: t.counterpartUserId !== null,
      snippet: last.body,
      lastAt: last.at,
      lastFromName: last.fromName,
      cls: c.cls,
      overdue: c.overdue,
      waitingHours: c.waitingHours,
      reasons: c.reasons,
      urgent: t.urgent,
      impactIls: t.impactIls ?? l?.impactIls ?? null,
      costIls: t.costIls,
      deadline: t.deadline ?? l?.deadline ?? null,
      recommendation: t.recommendation,
      link: l,
    };
  });
  rows.sort(inboxOrder);
  const counts = {
    decision: rows.filter((r) => r.cls === "decision").length,
    reply: rows.filter((r) => r.cls === "reply").length,
    recent: rows.filter((r) => r.cls === "recent").length,
    total: rows.length,
  };

  // ── The open thread ──
  const sel = opts.threadId ? threads.find((t) => t.id === opts.threadId) : undefined;
  let selected = null;
  if (sel) {
    const row = rows.find((r) => r.id === sel.id)!;
    const lessons =
      sel.linkType === "insight" && sel.linkId ? await lessonsForInsight(db, orgId, actor, sel.linkId) : [];
    const decides = row.cls === "decision";
    const facts: AnswerFacts = {
      impactIls: row.impactIls,
      costIls: row.costIls,
      deadline: row.deadline,
      now,
      affected: row.link?.affected ?? [sel.counterpartName],
      lessons: lessons.map((x) => ({ title: x.actionTitle, verdict: x.verdict, lesson: x.lesson ?? "" })),
      decider: decides
        ? {
            you: true,
            name: "",
            reason: sel.decisionTag
              ? `${sel.counterpartName} asks for your approval`
              : "the VECTOR decision on this sits with you",
          }
        : { you: false, name: sel.counterpartName, reason: "needs an answer from you, not a decision" },
    };
    const replies = await db
      .select({ id: outboundMessage.id, status: outboundMessage.status, edited: outboundMessage.edited })
      .from(outboundMessage)
      .where(and(eq(outboundMessage.orgId, orgId), eq(outboundMessage.inboxThreadId, sel.id)));
    selected = {
      ...row,
      benefit: sel.benefit,
      suggestedReply: sel.suggestedReply,
      templateId: sel.templateId,
      counterpartUserId: sel.counterpartUserId,
      messages: messages
        .filter((m) => m.threadId === sel.id)
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .map((m) => ({
          id: m.id,
          fromName: m.fromName,
          fromOwner: m.fromOwner,
          at: m.at,
          body: m.body,
          sent: !!m.outboundMessageId,
        })),
      followUps: (sel.followUps as FollowUp[]).map((q) => ({ key: q, ...answer(q, facts) })),
      replies,
    };
  }
  return { now, threads: rows, counts, selected };
}

export type InboxView = NonNullable<Awaited<ReturnType<typeof inboxView>>>;
