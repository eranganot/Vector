/**
 * Inbox model (plan v2, E7; mail-agent.md §1–§2). Pure.
 *
 * inbox-v1 classifies a thread from its fields, never from free text:
 * - **done**: the owner wrote the last message (answered).
 * - **decision**: the thread asks the owner to choose, approve or commit (a decision tag, or a linked VECTOR decision
 *   waiting for the owner).
 * - **reply**: the last message is addressed to the owner, asks something, and has waited more than 24 h (4 h when
 *   urgent).
 * - **recent**: asks the owner something but is younger than that.
 * - **fyi**: everything else (for information).
 */
export const INBOX_MODEL = "inbox-v1";
export const REPLY_AFTER_HOURS = 24;
export const URGENT_REPLY_AFTER_HOURS = 4;

export type InboxClass = "decision" | "reply" | "recent" | "fyi" | "done";

export type ThreadFacts = {
  lastFromOwner: boolean;
  lastAt: Date;
  /** The last message is addressed to the owner (To, or a direct message / mention on Slack). */
  addressedToOwner: boolean;
  asks: boolean;
  decisionTag: boolean;
  urgent: boolean;
  /** A linked VECTOR decision is still waiting for this person. */
  linkedDecisionWaiting: boolean;
};

export type Classification = { cls: InboxClass; waitingHours: number; overdue: boolean; reasons: string[] };

export function classify(f: ThreadFacts, now: Date): Classification {
  const waitingHours = Math.max(0, Math.floor((now.getTime() - f.lastAt.getTime()) / 3_600_000));
  const limit = f.urgent ? URGENT_REPLY_AFTER_HOURS : REPLY_AFTER_HOURS;
  if (f.lastFromOwner) return { cls: "done", waitingHours, overdue: false, reasons: ["you answered last"] };
  if (f.decisionTag || f.linkedDecisionWaiting) {
    const reasons = [
      ...(f.decisionTag ? ["asks you to choose, approve or commit"] : []),
      ...(f.linkedDecisionWaiting ? ["a VECTOR decision is waiting for you"] : []),
    ];
    return { cls: "decision", waitingHours, overdue: waitingHours > limit, reasons };
  }
  if (f.asks && f.addressedToOwner) {
    return waitingHours > limit
      ? {
          cls: "reply",
          waitingHours,
          overdue: true,
          reasons: [f.urgent ? "urgent, no answer for over 4 h" : "no answer for over 24 h"],
        }
      : { cls: "recent", waitingHours, overdue: false, reasons: ["asks you something"] };
  }
  return { cls: "fyi", waitingHours, overdue: false, reasons: ["for your information"] };
}

/** Order inside the Inbox: decisions, then replies, recent, fyi, done; within a class ₪ at stake, then the oldest. */
const RANK: Record<InboxClass, number> = { decision: 0, reply: 1, recent: 2, fyi: 3, done: 4 };
export function inboxOrder(
  a: { cls: InboxClass; impactIls: number | null; waitingHours: number },
  b: { cls: InboxClass; impactIls: number | null; waitingHours: number },
) {
  return RANK[a.cls] - RANK[b.cls] || (b.impactIls ?? 0) - (a.impactIls ?? 0) || b.waitingHours - a.waitingHours;
}

export const FOLLOW_UPS = ["wait_week", "who_affected", "last_time", "cost", "who_decides"] as const;
export type FollowUp = (typeof FOLLOW_UPS)[number];

/** A prepared answer: an English template with parameters, translated by the screen (FB-10: no free-form questions). */
export type Answer = { q: string; a: string; params: Record<string, string | number> };

export type AnswerFacts = {
  impactIls: number | null;
  costIls: number | null;
  deadline: Date | null;
  now: Date;
  /** Units or people the matter touches (names). */
  affected: string[];
  /** Reviewed lessons of the same kind of action ("last time"). */
  lessons: { title: string; verdict: string | null; lesson: string }[];
  decider: { you: boolean; name: string; reason: string };
};

const k = (n: number) => `₪${Math.round(n / 1000).toLocaleString("en-US")}k`;

/** The prepared answer to one follow-up question, from the thread's facts and VECTOR's data. */
export function answer(q: FollowUp, f: AnswerFacts): Answer {
  switch (q) {
    case "wait_week": {
      const days = f.deadline ? Math.ceil((f.deadline.getTime() - f.now.getTime()) / 86_400_000) : null;
      if (f.impactIls === null)
        return {
          q: "What if we wait a week?",
          a: "Nothing measurable is at stake; the thread only waits longer.",
          params: {},
        };
      if (days !== null && days <= 1)
        return {
          q: "What if we wait a week?",
          a: "About {m} is lost, and the deadline passes tomorrow, so the option closes.",
          params: { m: k(f.impactIls) },
        };
      return days !== null && days <= 7
        ? {
            q: "What if we wait a week?",
            a: "About {m} is lost, and the deadline passes in {d} days, so the option closes.",
            params: { m: k(f.impactIls), d: Math.max(0, days) },
          }
        : { q: "What if we wait a week?", a: "About {m} is lost in that week.", params: { m: k(f.impactIls) } };
    }
    case "who_affected":
      return f.affected.length
        ? { q: "Who else is affected?", a: "{list}.", params: { list: f.affected.join(" · ") } }
        : { q: "Who else is affected?", a: "Only the sender and you.", params: {} };
    case "last_time": {
      const l = f.lessons[0];
      return l
        ? {
            q: "What did we do last time?",
            a: "{title}: {verdict}. Lesson: {lesson}",
            params: { title: l.title, verdict: l.verdict ?? "not judged", lesson: l.lesson },
          }
        : { q: "What did we do last time?", a: "No similar decision is on record in VECTOR yet.", params: {} };
    }
    case "cost": {
      if (f.costIls === null || f.impactIls === null)
        return { q: "What does it cost?", a: "No cost is attached to this thread.", params: {} };
      const days = f.impactIls > 0 ? Math.ceil((f.costIls / f.impactIls) * 7) : null;
      return {
        q: "What does it cost?",
        a: days !== null ? "{cost}, against {m} a week at stake: it pays back in about {d} days." : "{cost}.",
        params: { cost: k(f.costIls), m: k(f.impactIls), d: days ?? 0 },
      };
    }
    case "who_decides":
      return f.decider.you
        ? { q: "Who decides?", a: "You do: {reason}.", params: { reason: f.decider.reason } }
        : { q: "Who decides?", a: "{name}: {reason}.", params: { name: f.decider.name, reason: f.decider.reason } };
  }
}
