import { describe, expect, it } from "vitest";
import { answer, classify, inboxOrder, type ThreadFacts } from "./inbox";

const now = new Date("2026-10-22T05:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000);
const base: ThreadFacts = {
  lastFromOwner: false,
  lastAt: ago(30),
  addressedToOwner: true,
  asks: true,
  decisionTag: false,
  urgent: false,
  linkedDecisionWaiting: false,
};

describe("inbox-v1 classification", () => {
  it("a question to you unanswered for over 24 h waits for your reply; younger is recent", () => {
    expect(classify(base, now)).toMatchObject({ cls: "reply", waitingHours: 30, overdue: true });
    expect(classify({ ...base, lastAt: ago(9) }, now)).toMatchObject({ cls: "recent", overdue: false });
  });
  it("urgent threads wait 4 h, not 24", () => {
    expect(classify({ ...base, lastAt: ago(5), urgent: true }, now).cls).toBe("reply");
  });
  it("a decision tag or a waiting VECTOR decision makes it a decision, whatever its age", () => {
    expect(classify({ ...base, lastAt: ago(2), decisionTag: true }, now)).toMatchObject({
      cls: "decision",
      overdue: false,
    });
    expect(classify({ ...base, asks: false, linkedDecisionWaiting: true }, now).reasons).toEqual([
      "a VECTOR decision is waiting for you",
    ]);
  });
  it("your own last word closes it; a broadcast without a question is for information", () => {
    expect(classify({ ...base, lastFromOwner: true, decisionTag: true }, now).cls).toBe("done");
    expect(classify({ ...base, asks: false }, now).cls).toBe("fyi");
    expect(classify({ ...base, addressedToOwner: false }, now).cls).toBe("fyi");
  });
  it("orders decisions first, then by ₪ at stake, then the oldest", () => {
    const xs = [
      { id: "fyi", cls: "fyi" as const, impactIls: 9e6, waitingHours: 99 },
      { id: "r-old", cls: "reply" as const, impactIls: null, waitingHours: 50 },
      { id: "d-small", cls: "decision" as const, impactIls: 10_000, waitingHours: 3 },
      { id: "d-big", cls: "decision" as const, impactIls: 900_000, waitingHours: 1 },
      { id: "r-new", cls: "reply" as const, impactIls: null, waitingHours: 26 },
    ];
    expect(xs.sort(inboxOrder).map((x) => x.id)).toEqual(["d-big", "d-small", "r-old", "r-new", "fyi"]);
  });
});

describe("prepared follow-up answers", () => {
  const facts = {
    impactIls: 1_100_000,
    costIls: 180_000,
    deadline: new Date(now.getTime() + 2 * 86_400_000),
    now,
    affected: ["North", "Supply Chain"],
    lessons: [{ title: "Reroute via the Center DC", verdict: "worked", lesson: "Book trucks a day ahead." }],
    decider: { you: true, name: "Michal Golan", reason: "Finance owns the spend freeze" },
  };
  it("waiting a week names the loss and whether the deadline passes", () => {
    expect(answer("wait_week", facts)).toEqual({
      q: "What if we wait a week?",
      a: "About {m} is lost, and the deadline passes in {d} days, so the option closes.",
      params: { m: "₪1,100k", d: 2 },
    });
    expect(answer("wait_week", { ...facts, deadline: null }).a).toBe("About {m} is lost in that week.");
    expect(answer("wait_week", { ...facts, deadline: new Date(now.getTime() + 10 * 3_600_000) }).a).toBe(
      "About {m} is lost, and the deadline passes tomorrow, so the option closes.",
    );
    expect(answer("wait_week", { ...facts, impactIls: null }).params).toEqual({});
  });
  it("cost pays back in days against the weekly impact", () => {
    expect(answer("cost", facts).params).toEqual({ cost: "₪180k", m: "₪1,100k", d: 2 });
  });
  it("last time, who is affected, who decides", () => {
    expect(answer("last_time", facts).params).toMatchObject({ verdict: "worked" });
    expect(answer("last_time", { ...facts, lessons: [] }).a).toBe("No similar decision is on record in VECTOR yet.");
    expect(answer("who_affected", facts).params).toEqual({ list: "North · Supply Chain" });
    expect(answer("who_decides", facts).a).toBe("You do: {reason}.");
    expect(answer("who_decides", { ...facts, decider: { ...facts.decider, you: false } }).a).toBe("{name}: {reason}.");
  });
});
