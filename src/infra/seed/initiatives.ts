/**
 * Cross-department initiatives of the synthetic organization (plan v2, E1c; cross-department.md §5). Each one ties
 * existing stories together: catalog insights (scenarios.md) and Phase 4 commitments are linked, never copied.
 * The story day is 2026-10-22. At that day North DC recovery is blocked (M1) and in conflict (M3), the POS upgrade is
 * over budget (M5) and holiday readiness has a late milestone (M2); the other five are on track.
 */
export type InitiativeSeed = {
  key: string;
  title: string;
  kind: "project" | "process";
  sponsor: string; // user key (org.ts)
  owner: string; // owning unit code
  participants: string[]; // unit codes
  budgetIls: number;
  spentIls: number;
  valueIls: number;
  startsOn: string;
  endsOn?: string;
  commitments: string[]; // commitment keys (commitments.ts)
  catalog: string[]; // scenario ids (catalog.ts)
  milestones: { title: string; owner: string; startsOn: string; dueOn: string; doneOn?: string; progress: number }[];
  barriers: { title: string; kind: string; owner: string; costIls?: number; since: string; resolvedOn?: string }[];
};

export const INITIATIVES: InitiativeSeed[] = [
  {
    key: "I-NORTH-DC",
    title: "North DC recovery",
    kind: "project",
    sponsor: "oren",
    owner: "D-SUPPLY",
    participants: ["D-SUPPLY", "D-STORE", "D-FIN", "D-HR", "D-MKT"],
    budgetIls: 1_200_000,
    spentIls: 520_000,
    valueIls: 4_400_000,
    startsOn: "2026-10-06",
    endsOn: "2026-11-15",
    commitments: ["SC-RECOVERY", "F-FREEZE"],
    catalog: ["R2", "R3"],
    milestones: [
      {
        title: "Second shift live at the North DC",
        owner: "D-SUPPLY",
        startsOn: "2026-10-06",
        dueOn: "2026-10-24",
        progress: 60,
      },
      {
        title: "Overtime exception to the spend freeze",
        owner: "D-FIN",
        startsOn: "2026-10-12",
        dueOn: "2026-10-22",
        progress: 30,
      },
      {
        title: "Branch-to-branch transfers, 9 North branches",
        owner: "D-STORE",
        startsOn: "2026-10-06",
        dueOn: "2026-10-16",
        doneOn: "2026-10-17",
        progress: 100,
      },
      { title: "Temporary DC staff hired", owner: "D-HR", startsOn: "2026-10-10", dueOn: "2026-10-18", progress: 45 },
      {
        title: "Customer communication in the North",
        owner: "D-MKT",
        startsOn: "2026-10-14",
        dueOn: "2026-10-20",
        doneOn: "2026-10-19",
        progress: 100,
      },
    ],
    barriers: [
      {
        title: "Overtime budget waits for an exception to the spend freeze",
        kind: "decision",
        owner: "D-FIN",
        costIls: 180_000,
        since: "2026-10-15",
      },
      { title: "Temporary staff 4 days late", kind: "resource", owner: "D-HR", since: "2026-10-18" },
    ],
  },
  {
    key: "I-POS",
    title: "POS upgrade",
    kind: "project",
    sponsor: "amir",
    owner: "D-IT",
    participants: ["D-IT", "D-STORE", "D-FIN"],
    budgetIls: 2_800_000,
    spentIls: 3_200_000,
    valueIls: 1_500_000,
    startsOn: "2026-09-01",
    endsOn: "2026-12-15",
    commitments: ["IT-POS"],
    catalog: ["R9"],
    milestones: [
      {
        title: "Wave 1: 20 branches",
        owner: "D-IT",
        startsOn: "2026-09-01",
        dueOn: "2026-09-30",
        doneOn: "2026-10-02",
        progress: 100,
      },
      { title: "Wave 2: 20 branches", owner: "D-IT", startsOn: "2026-10-01", dueOn: "2026-10-25", progress: 70 },
      { title: "Wave 3: 20 branches", owner: "D-IT", startsOn: "2026-10-26", dueOn: "2026-11-03", progress: 0 },
      {
        title: "Store staff trained on the new tills",
        owner: "D-STORE",
        startsOn: "2026-09-15",
        dueOn: "2026-11-10",
        progress: 55,
      },
    ],
    barriers: [
      {
        title: "Vendor install crews cost more than planned",
        kind: "budget",
        owner: "D-FIN",
        costIls: 400_000,
        since: "2026-10-10",
      },
    ],
  },
  {
    key: "I-HOLIDAY",
    title: "Holiday-season readiness",
    kind: "project",
    sponsor: "oren",
    owner: "D-STORE",
    participants: ["D-STORE", "D-SUPPLY", "D-MKT", "D-HR"],
    budgetIls: 900_000,
    spentIls: 430_000,
    valueIls: 2_600_000,
    startsOn: "2026-09-20",
    endsOn: "2026-12-31",
    commitments: ["S-PEAK", "M-SIGNAGE", "S-ROSTERS"],
    catalog: ["R4"],
    milestones: [
      {
        title: "Peak rosters for 60 branches",
        owner: "D-STORE",
        startsOn: "2026-09-20",
        dueOn: "2026-10-30",
        progress: 65,
      },
      { title: "Seasonal hiring at 80%", owner: "D-HR", startsOn: "2026-09-25", dueOn: "2026-10-18", progress: 62 },
      {
        title: "Promo signage in 60 branches",
        owner: "D-MKT",
        startsOn: "2026-10-01",
        dueOn: "2026-10-25",
        progress: 50,
      },
      { title: "Holiday stock build", owner: "D-SUPPLY", startsOn: "2026-10-10", dueOn: "2026-11-15", progress: 40 },
    ],
    barriers: [{ title: "Depends on North DC recovery", kind: "dependency", owner: "D-SUPPLY", since: "2026-10-20" }],
  },
  {
    key: "I-CLICK",
    title: "Click-and-collect scale-up in Center",
    kind: "project",
    sponsor: "shira",
    owner: "D-STORE",
    participants: ["D-STORE", "D-IT", "D-MKT"],
    budgetIls: 600_000,
    spentIls: 380_000,
    valueIls: 1_900_000,
    startsOn: "2026-09-15",
    endsOn: "2026-11-30",
    commitments: ["S-LAUNCH"],
    catalog: ["O4"],
    milestones: [
      {
        title: "Ordering app release 4.2",
        owner: "D-IT",
        startsOn: "2026-09-15",
        dueOn: "2026-10-20",
        doneOn: "2026-10-20",
        progress: 100,
      },
      {
        title: "Pickup lockers in 6 branches",
        owner: "D-STORE",
        startsOn: "2026-10-05",
        dueOn: "2026-10-31",
        progress: 70,
      },
      { title: "Launch campaign in Center", owner: "D-MKT", startsOn: "2026-10-25", dueOn: "2026-11-05", progress: 10 },
    ],
    barriers: [],
  },
  {
    key: "I-RECALL",
    title: "Recall readiness",
    kind: "process",
    sponsor: "yael",
    owner: "D-LEGAL",
    participants: ["D-LEGAL", "D-SUPPLY", "D-STORE"],
    budgetIls: 150_000,
    spentIls: 90_000,
    valueIls: 600_000,
    startsOn: "2026-06-01",
    commitments: ["L-RECALL-TEMPLATES"],
    catalog: ["R1"],
    milestones: [
      {
        title: "Recall templates for every category",
        owner: "D-LEGAL",
        startsOn: "2026-06-01",
        dueOn: "2026-09-30",
        doneOn: "2026-09-28",
        progress: 100,
      },
      { title: "Post-recall review", owner: "D-SUPPLY", startsOn: "2026-10-22", dueOn: "2026-10-29", progress: 20 },
    ],
    barriers: [],
  },
  {
    key: "I-WAGE",
    title: "Wage-rule compliance",
    kind: "project",
    sponsor: "hila",
    owner: "D-HR",
    participants: ["D-HR", "D-LEGAL", "D-FIN"],
    budgetIls: 120_000,
    spentIls: 40_000,
    valueIls: 300_000,
    startsOn: "2026-10-01",
    endsOn: "2026-11-21",
    commitments: ["H-PAY"],
    catalog: ["R5"],
    milestones: [
      { title: "Updated pay tables", owner: "D-HR", startsOn: "2026-10-01", dueOn: "2026-10-30", progress: 60 },
      {
        title: "Legal sign-off on the new rule",
        owner: "D-LEGAL",
        startsOn: "2026-10-10",
        dueOn: "2026-11-05",
        progress: 40,
      },
      { title: "Payroll change live", owner: "D-FIN", startsOn: "2026-11-05", dueOn: "2026-11-21", progress: 0 },
    ],
    barriers: [],
  },
  {
    key: "I-PRIVATE-LABEL",
    title: "Private-label margin programme",
    kind: "project",
    sponsor: "eitan",
    owner: "D-TRADE",
    participants: ["D-TRADE", "D-SUPPLY", "D-MKT"],
    budgetIls: 700_000,
    spentIls: 240_000,
    valueIls: 3_100_000,
    startsOn: "2026-08-01",
    endsOn: "2027-03-31",
    commitments: ["F-MARGIN"],
    catalog: [],
    milestones: [
      {
        title: "12 private-label SKUs on shelf",
        owner: "D-TRADE",
        startsOn: "2026-08-01",
        dueOn: "2026-11-15",
        progress: 48,
      },
      {
        title: "Supplier contracts signed",
        owner: "D-SUPPLY",
        startsOn: "2026-08-15",
        dueOn: "2026-10-31",
        progress: 75,
      },
      { title: "Shelf launch campaign", owner: "D-MKT", startsOn: "2026-11-10", dueOn: "2026-12-01", progress: 0 },
    ],
    barriers: [],
  },
  {
    key: "I-BUDGET-REVIEW",
    title: "Monthly budget review",
    kind: "process",
    sponsor: "michal",
    owner: "D-FIN",
    participants: ["D-FIN", "D-STORE", "D-SUPPLY", "D-TRADE", "D-MKT", "D-HR", "D-LEGAL", "D-IT"],
    budgetIls: 0,
    spentIls: 0,
    valueIls: 0,
    startsOn: "2026-01-01",
    commitments: ["F-LABOR"],
    catalog: ["R7", "R11"],
    milestones: [
      {
        title: "September close",
        owner: "D-FIN",
        startsOn: "2026-10-01",
        dueOn: "2026-10-05",
        doneOn: "2026-10-05",
        progress: 100,
      },
      { title: "October close", owner: "D-FIN", startsOn: "2026-11-01", dueOn: "2026-11-05", progress: 0 },
    ],
    barriers: [],
  },
];
