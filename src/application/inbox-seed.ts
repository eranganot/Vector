/**
 * Seeds inbox-v1 (plan v2, E7; mail-agent.md §2): each C-suite persona's synthetic email and Slack threads, linked to
 * the VECTOR stories they are about. Channel data, like KPI observations: written directly, never through a command
 * (nothing is decided or sent by seeding).
 */
import { eq } from "drizzle-orm";
import { INBOX_MODEL } from "@/domain/inbox";
import { inboxMessage, inboxThread, user } from "@/infra/db/schema";
import { KEY_THREADS, type Link, type Party, ROUTINE_THREADS, type ThreadSeed } from "@/infra/seed/inbox";
import { C_SUITE } from "@/infra/seed/org";
import type { AppContext } from "./context";

const fail = (m: string): never => {
  throw new Error(m);
};

export async function seedInbox(
  ctx: AppContext,
  ids: { catalog: Map<string, string>; commitments: Map<string, string>; initiatives: Map<string, string> },
) {
  const now = ctx.clock.now();
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000);
  const people = await ctx.db.select().from(user).where(eq(user.orgId, ctx.orgId));
  const person = (key: string) =>
    people.find((p) => p.email === `${key}@vector-retail.example`) ?? fail(`inbox: no seeded user ${key}`);
  const linkId = (l: Link | undefined) =>
    !l
      ? null
      : l.type === "insight"
        ? (ids.catalog.get(l.catalog) ?? fail(`inbox: no catalog insight ${l.catalog}`))
        : l.type === "commitment"
          ? (ids.commitments.get(l.key) ?? fail(`inbox: no commitment ${l.key}`))
          : (ids.initiatives.get(l.key) ?? fail(`inbox: no initiative ${l.key}`));
  const party = (p: Party) => {
    if ("user" in p) {
      const u = person(p.user);
      return { name: u.name, role: u.title ?? "", userId: u.id };
    }
    return { name: p.name, role: p.role, userId: null };
  };

  const threads: (ThreadSeed & { templateId: string })[] = [
    ...KEY_THREADS.map((t) => ({ ...t, templateId: `${INBOX_MODEL}:${t.id}` })),
    ...C_SUITE.flatMap((owner) => {
      const colleagues = C_SUITE.filter((k) => k !== owner);
      const start = C_SUITE.indexOf(owner);
      return ROUTINE_THREADS.map((r) => ({
        ...r,
        id: `${owner}-${r.key}`,
        owner,
        with: typeof r.with === "number" ? { user: colleagues[(start + r.with) % colleagues.length] } : r.with,
        followUps: [],
        templateId: `${INBOX_MODEL}:routine:${r.key}`,
      }));
    }),
  ];

  let messages = 0;
  for (const t of threads) {
    const owner = person(t.owner);
    const other = party(t.with);
    const [row] = await ctx.db
      .insert(inboxThread)
      .values({
        orgId: ctx.orgId,
        ownerUserId: owner.id,
        channel: t.channel,
        subject: t.subject,
        counterpartName: other.name,
        counterpartRole: other.role,
        counterpartUserId: other.userId,
        asks: t.asks ?? false,
        decisionTag: t.decision ?? false,
        urgent: t.urgent ?? false,
        linkType: t.link?.type ?? null,
        linkId: linkId(t.link),
        impactIls: t.impactIls ?? null,
        costIls: t.costIls ?? null,
        deadline: t.deadlineHours !== undefined ? new Date(now.getTime() + t.deadlineHours * 3_600_000) : null,
        benefit: t.benefit ?? null,
        recommendation: t.recommendation ?? null,
        suggestedReply: t.reply ?? null,
        followUps: t.followUps,
        templateId: t.templateId,
        createdAt: at(t.messages[0].hoursAgo),
      })
      .returning({ id: inboxThread.id });
    for (const m of t.messages) {
      const fromOwner = m.from === "owner";
      await ctx.db.insert(inboxMessage).values({
        orgId: ctx.orgId,
        threadId: row.id,
        fromName: fromOwner ? owner.name : m.from === "them" ? other.name : person(m.from).name,
        fromOwner,
        toOwner: !fromOwner && (m.toOwner ?? true),
        at: at(m.hoursAgo),
        body: m.body,
      });
      messages++;
    }
  }
  return { threads: threads.length, messages };
}
