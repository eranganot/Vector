/**
 * The ₪ header on every list page (plan v2, FB-5; executive-home.md §6). Pure sums over what the page shows, for
 * the viewer's scope and current filters. Every figure says what it adds up, so a reader can check it.
 */

export type RiskMoneyItem = {
  band: string;
  /** ₪ a week at stake. */
  impactIls: number;
  /** Statuses of the actions answering it. */
  actionStatuses: string[];
};

export type RiskHeader = {
  /** ₪ a week at stake across the risks shown. */
  atStake: number;
  /** Of which P1. */
  p1: number;
  /** Covered by an action that is executing or done. */
  mitigated: number;
  /** No action proposed yet: nobody is acting on it. */
  unanswered: number;
};

const ACTING = new Set(["executing", "executed"]);
const LIVE_ACTION = (s: string) => s !== "cancelled" && s !== "rejected";

export function riskHeader(items: RiskMoneyItem[]): RiskHeader {
  const sum = (xs: RiskMoneyItem[]) => xs.reduce((a, x) => a + x.impactIls, 0);
  return {
    atStake: sum(items),
    p1: sum(items.filter((i) => i.band === "P1")),
    mitigated: sum(items.filter((i) => i.actionStatuses.some((s) => ACTING.has(s)))),
    unanswered: sum(items.filter((i) => !i.actionStatuses.some(LIVE_ACTION))),
  };
}

export type OpportunityMoneyItem = {
  /** ₪ a week of upside. */
  valueIls: number;
  /** One-off cost to capture. */
  costIls: number;
  confidence: number;
  actionStatuses: string[];
  /** Outcome verdicts of its actions. */
  verdicts: string[];
};

export type OpportunityHeader = {
  upside: number;
  cost: number;
  /** Upside × weeks to quarter end × confidence − cost to capture. */
  netEoq: number;
  /** Upside a week of opportunities whose action worked (half when it partly worked). */
  captured: number;
};

export function opportunityHeader(items: OpportunityMoneyItem[], weeksToEoq: number): OpportunityHeader {
  const captureShare = (i: OpportunityMoneyItem) =>
    i.verdicts.includes("worked") ? 1 : i.verdicts.includes("partially_worked") ? 0.5 : 0;
  return {
    upside: items.reduce((a, i) => a + i.valueIls, 0),
    cost: items.reduce((a, i) => a + i.costIls, 0),
    netEoq: Math.round(items.reduce((a, i) => a + i.valueIls * weeksToEoq * i.confidence - i.costIls, 0)),
    captured: items.reduce((a, i) => a + i.valueIls * captureShare(i), 0),
  };
}

export type CommitmentMoneyItem = {
  status: "open" | "overdue" | "done" | "cancelled";
  /** ₪ a week at stake if it is late. */
  impactIls: number;
  completedAt: Date | null;
};

export type CommitmentHeader = {
  /** ₪ a week riding on open and overdue commitments. */
  open: number;
  /** Of which overdue. */
  overdue: number;
  /** ₪ a week secured by commitments delivered since the start of the month. */
  deliveredThisMonth: number;
};

export function commitmentHeader(items: CommitmentMoneyItem[], monthStart: Date): CommitmentHeader {
  const sum = (xs: CommitmentMoneyItem[]) => xs.reduce((a, x) => a + x.impactIls, 0);
  return {
    open: sum(items.filter((c) => c.status === "open" || c.status === "overdue")),
    overdue: sum(items.filter((c) => c.status === "overdue")),
    deliveredThisMonth: sum(
      items.filter((c) => c.status === "done" && c.completedAt && c.completedAt.getTime() >= monthStart.getTime()),
    ),
  };
}

export type ActionMoneyItem = {
  status: string;
  cost: number;
  /** Expected ₪ by end of quarter (economics). */
  impact: number;
  verdict: string | null;
};

export type ActionHeader = {
  /** Estimated cost of the actions shown, cancelled and rejected ones left out. */
  committedCost: number;
  /** Their expected impact by end of quarter. */
  expectedImpact: number;
  /** Expected impact of actions whose outcome worked (half when it partly worked). */
  confirmedImpact: number;
  /** Worked ÷ judged (worked, partly worked, did not work); null before any verdict. */
  hitRate: number | null;
};

export function actionHeader(items: ActionMoneyItem[]): ActionHeader {
  const live = items.filter((a) => LIVE_ACTION(a.status));
  const judged = items.filter((a) => a.verdict && a.verdict !== "inconclusive");
  const worked = judged.filter((a) => a.verdict === "worked").length;
  return {
    committedCost: live.reduce((s, a) => s + a.cost, 0),
    expectedImpact: live.reduce((s, a) => s + a.impact, 0),
    confirmedImpact: items.reduce(
      (s, a) => s + a.impact * (a.verdict === "worked" ? 1 : a.verdict === "partially_worked" ? 0.5 : 0),
      0,
    ),
    hitRate: judged.length ? worked / judged.length : null,
  };
}
