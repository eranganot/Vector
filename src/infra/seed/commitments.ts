/**
 * The commitment register and dependency graph of the synthetic organization (Phase 4, docs/phases/PHASE_4.md).
 * Times are UTC; the story day starts 2026-10-22 05:00. Commitments marked `catalog` underlie a scenario-catalog
 * story (scenarios.md) and link to its insight instead of raising a second one. The rest are new:
 * - T-DAIRY is due this afternoon: one clock day later it is overdue and Finance's forecast turns at risk (live).
 * - T-DELIST-SOUTH waits for Marketing's weekend dairy promotion, which conflicts with it when recorded (live).
 * - Several commitments were delivered, on time or late, so the on-time rate is real.
 */
import type { CommitmentEffect } from "@/domain/commitments";

export type CommitmentSeed = {
  key: string;
  title: string;
  owner: string; // user key (org.ts)
  unit: string; // owning unit code
  beneficiaries: string[]; // unit codes
  source: string;
  madeAt: string;
  dueAt: string;
  impactIls?: number;
  compliance?: number;
  effects?: CommitmentEffect[];
  catalog?: string; // scenario id whose insight tells this commitment's story
  done?: string; // delivered at (ISO)
};

export type DependencySeed = {
  on: string; // commitment key
  unit: string; // downstream unit code
  by: string; // who declares it (user key, a manager of the downstream unit)
  needBy: string;
  impactIls: number;
  note: string;
  downstream?: string; // the downstream commitment that relies on it
};

const REGIONS = ["NORTH", "COAST", "CENTER", "JERUSALEM", "SOUTH"];
const REGION_HEAD: Record<string, string> = {
  NORTH: "yossi",
  COAST: "gil",
  CENTER: "maya",
  JERUSALEM: "rina",
  SOUTH: "omer",
};

export const COMMITMENTS: CommitmentSeed[] = [
  // R4: promo signage (Marketing) → promo launch (Store Ops) → launch-day execution (regions)
  {
    key: "M-SIGNAGE",
    title: "Holiday promo signage and shelf talkers for 60 branches",
    owner: "ronit",
    unit: "D-MKT",
    beneficiaries: ["D-STORE", ...REGIONS],
    source: "Weekly ops meeting · 15 Oct",
    madeAt: "2026-10-15T09:00:00Z",
    dueAt: "2026-10-19T12:00:00Z",
    impactIls: 300_000,
    catalog: "R4",
  },
  {
    key: "S-LAUNCH",
    title: "Holiday promotion live in all 60 branches",
    owner: "shira",
    unit: "D-STORE",
    beneficiaries: ["D-MKT", "D-TRADE"],
    source: "Weekly ops meeting · 15 Oct",
    madeAt: "2026-10-15T09:00:00Z",
    dueAt: "2026-10-24T08:00:00Z",
    impactIls: 300_000,
    catalog: "R4",
  },
  // R5: pay tables (HR) → compliant rosters (Store Ops), Q4 labor re-forecast (Finance)
  {
    key: "H-PAY",
    title: "Publish updated pay tables for the new wage rule",
    owner: "hila",
    unit: "D-HR",
    beneficiaries: ["D-STORE", "D-FIN", "D-LEGAL"],
    source: "Compliance register · 3 Oct",
    madeAt: "2026-10-03T10:00:00Z",
    dueAt: "2026-10-17T15:00:00Z",
    impactIls: 120_000,
    compliance: 0.8,
    catalog: "R5",
  },
  {
    key: "S-ROSTERS",
    title: "Compliant holiday rosters for 60 branches",
    owner: "shira",
    unit: "D-STORE",
    beneficiaries: ["D-LEGAL", "D-HR"],
    source: "Compliance register · 3 Oct",
    madeAt: "2026-10-03T10:00:00Z",
    dueAt: "2026-11-14T12:00:00Z",
    impactIls: 120_000,
    compliance: 0.8,
  },
  {
    key: "F-LABOR",
    title: "Q4 labor cost re-forecast",
    owner: "michal",
    unit: "D-FIN",
    beneficiaries: ["GROUP"],
    source: "Monthly finance review · 6 Oct",
    madeAt: "2026-10-06T08:00:00Z",
    dueAt: "2026-10-30T12:00:00Z",
  },
  // R2: North DC recovery (Supply Chain) → North and Center branches
  {
    key: "SC-RECOVERY",
    title: "North DC back to full delivery waves",
    owner: "noa",
    unit: "D-SUPPLY",
    beneficiaries: ["NORTH", "CENTER", "D-STORE"],
    source: "Daily supply call · 21 Oct",
    madeAt: "2026-10-21T07:30:00Z",
    dueAt: "2026-10-23T06:00:00Z",
    impactIls: 450_000,
    catalog: "R2",
  },
  // R7: spend freeze (Finance) vs. the contracted Q4 campaign (Marketing); Finance recorded later → Finance decides (Q1)
  {
    key: "M-CAMPAIGN",
    title: "Q4 campaign: ₪350k media and in-store",
    owner: "ronit",
    unit: "D-MKT",
    beneficiaries: ["D-TRADE", "D-STORE"],
    source: "Marketing plan · 2 Oct",
    madeAt: "2026-10-02T09:00:00Z",
    dueAt: "2026-10-29T08:00:00Z",
    impactIls: 350_000,
    compliance: 0.3,
    effects: [
      { resource: "budget:q4-discretionary", effect: "spend", windowStart: "2026-10-29", windowEnd: "2026-12-15" },
    ],
    catalog: "R7",
  },
  {
    key: "F-FREEZE",
    title: "Freeze Q4 discretionary spend",
    owner: "michal",
    unit: "D-FIN",
    beneficiaries: ["GROUP"],
    source: "Finance committee · 19 Oct",
    madeAt: "2026-10-19T14:00:00Z",
    dueAt: "2026-10-20T08:00:00Z",
    effects: [
      {
        resource: "budget:q4-discretionary",
        effect: "freeze_spend",
        windowStart: "2026-10-20",
        windowEnd: "2026-12-31",
      },
    ],
    catalog: "R7",
    done: "2026-10-20T07:00:00Z",
  },
  // R9: holiday peak staffing (Store Ops) vs. the POS cut-over (IT); IT recorded later → IT decides (Q1)
  {
    key: "S-PEAK",
    title: "Holiday peak staffing plan for 60 branches",
    owner: "shira",
    unit: "D-STORE",
    beneficiaries: [...REGIONS],
    source: "Weekly ops meeting · 8 Oct",
    madeAt: "2026-10-08T09:00:00Z",
    dueAt: "2026-10-31T12:00:00Z",
    impactIls: 400_000,
    effects: [
      { resource: "branches:all-pos", effect: "peak_trading", windowStart: "2026-11-01", windowEnd: "2026-11-20" },
    ],
    catalog: "R9",
  },
  {
    key: "IT-POS",
    title: "POS upgrade cut-over in all 60 branches",
    owner: "amir",
    unit: "D-IT",
    beneficiaries: ["D-STORE", "D-FIN"],
    source: "Change calendar · 12 Oct",
    madeAt: "2026-10-12T11:00:00Z",
    dueAt: "2026-11-19T18:00:00Z",
    impactIls: 400_000,
    compliance: 0.3,
    effects: [{ resource: "branches:all-pos", effect: "cutover", windowStart: "2026-11-05", windowEnd: "2026-11-19" }],
    catalog: "R9",
  },
  // R12: Coast promotion (Marketing) vs. delisting the same 14 items (Trade); Trade recorded later → Trade decides (Q1)
  {
    key: "M-COAST-PROMO",
    title: "Coast promotion on 14 slow-moving items",
    owner: "ronit",
    unit: "D-MKT",
    beneficiaries: ["COAST"],
    source: "Promo calendar · 14 Oct",
    madeAt: "2026-10-14T10:00:00Z",
    dueAt: "2026-11-01T06:00:00Z",
    impactIls: 80_000,
    effects: [{ resource: "sku-set:coast-14", effect: "promote", windowStart: "2026-11-01", windowEnd: "2026-11-07" }],
    catalog: "R12",
  },
  {
    key: "T-DELIST-COAST",
    title: "Delist 14 slow items at 5 Coast branches",
    owner: "eitan",
    unit: "D-TRADE",
    beneficiaries: ["COAST", "D-SUPPLY"],
    source: "Range review · 20 Oct",
    madeAt: "2026-10-20T13:00:00Z",
    dueAt: "2026-10-30T06:00:00Z",
    effects: [{ resource: "sku-set:coast-14", effect: "delist", windowStart: "2026-10-30", windowEnd: "2026-12-31" }],
    catalog: "R12",
  },
  // Live: due this afternoon; one clock day later it is overdue and Finance's forecast is at risk.
  {
    key: "T-DAIRY",
    title: "Agree the response to Dairy Co.'s +7% price increase",
    owner: "eitan",
    unit: "D-TRADE",
    beneficiaries: ["D-FIN", "D-MKT"],
    source: "Weekly ops meeting · 15 Oct",
    madeAt: "2026-10-15T09:00:00Z",
    dueAt: "2026-10-22T14:00:00Z",
    impactIls: 50_000,
  },
  {
    key: "F-MARGIN",
    title: "Q4 margin forecast to the board",
    owner: "michal",
    unit: "D-FIN",
    beneficiaries: ["GROUP"],
    source: "Board calendar · 1 Oct",
    madeAt: "2026-10-01T08:00:00Z",
    dueAt: "2026-10-26T09:00:00Z",
    impactIls: 0,
  },
  // Live: Marketing's weekend dairy promotion for South conflicts with this when it is recorded.
  {
    key: "T-DELIST-SOUTH",
    title: "Delist 6 dairy items at South branches",
    owner: "eitan",
    unit: "D-TRADE",
    beneficiaries: ["SOUTH", "D-SUPPLY"],
    source: "Range review · 14 Oct",
    madeAt: "2026-10-14T13:00:00Z",
    dueAt: "2026-10-30T06:00:00Z",
    effects: [
      { resource: "sku-set:south-dairy-6", effect: "delist", windowStart: "2026-10-30", windowEnd: "2026-12-31" },
    ],
  },
  // Delivered, on time and late (the on-time rate is real).
  {
    key: "IT-SCO",
    title: "Self-checkout firmware fix at Center branches",
    owner: "amir",
    unit: "D-IT",
    beneficiaries: ["CENTER"],
    source: "Weekly ops meeting · 8 Oct",
    madeAt: "2026-10-08T09:00:00Z",
    dueAt: "2026-10-18T18:00:00Z",
    done: "2026-10-17T16:00:00Z",
  },
  {
    key: "H-TRAINING",
    title: "Food-safety refresher for fresh counters",
    owner: "hila",
    unit: "D-HR",
    beneficiaries: ["D-STORE"],
    source: "Weekly ops meeting · 8 Oct",
    madeAt: "2026-10-08T09:00:00Z",
    dueAt: "2026-10-20T12:00:00Z",
    done: "2026-10-20T08:00:00Z",
  },
  {
    key: "L-RECALL-TEMPLATES",
    title: "Recall notice templates for all branches",
    owner: "yael",
    unit: "D-LEGAL",
    beneficiaries: ["D-STORE", "D-SUPPLY"],
    source: "Quarterly compliance review · 1 Oct",
    madeAt: "2026-10-01T10:00:00Z",
    dueAt: "2026-10-15T12:00:00Z",
    done: "2026-10-14T15:00:00Z",
  },
  {
    key: "B-HFA-REQUEST",
    title: "Replenishment request to the North DC (Haifa Grand Canyon)",
    owner: "avi",
    unit: "HFA-GC",
    beneficiaries: ["D-SUPPLY"],
    source: "Branch call · 20 Oct",
    madeAt: "2026-10-20T08:00:00Z",
    dueAt: "2026-10-21T12:00:00Z",
    done: "2026-10-21T18:00:00Z",
  },
  // Overdue but small, with nobody waiting: listed, not escalated (Q2).
  {
    key: "IT-HOURS",
    title: "Update holiday opening hours on the website",
    owner: "amir",
    unit: "D-IT",
    beneficiaries: ["D-MKT"],
    source: "Weekly ops meeting · 15 Oct",
    madeAt: "2026-10-15T09:00:00Z",
    dueAt: "2026-10-20T12:00:00Z",
    impactIls: 2_000,
  },
];

export const DEPENDENCIES: DependencySeed[] = [
  {
    on: "M-SIGNAGE",
    unit: "D-STORE",
    by: "shira",
    needBy: "2026-10-23T12:00:00Z",
    impactIls: 300_000,
    note: "Signage must be in branches a day before the promotion goes live",
    downstream: "S-LAUNCH",
  },
  ...REGIONS.map((r) => ({
    on: "S-LAUNCH",
    unit: r,
    by: REGION_HEAD[r],
    needBy: "2026-10-24T08:00:00Z",
    impactIls: 60_000,
    note: "Launch-day execution in the region's 12 branches",
  })),
  {
    on: "H-PAY",
    unit: "D-STORE",
    by: "shira",
    needBy: "2026-11-07T12:00:00Z",
    impactIls: 120_000,
    note: "Rosters need two pay cycles of lead time before the rule takes effect",
    downstream: "S-ROSTERS",
  },
  {
    on: "H-PAY",
    unit: "D-FIN",
    by: "michal",
    needBy: "2026-10-28T12:00:00Z",
    impactIls: 0,
    note: "The Q4 labor re-forecast uses the new pay tables",
    downstream: "F-LABOR",
  },
  {
    on: "SC-RECOVERY",
    unit: "NORTH",
    by: "yossi",
    needBy: "2026-10-23T06:00:00Z",
    impactIls: 250_000,
    note: "Fresh stock for 9 North branches",
  },
  {
    on: "SC-RECOVERY",
    unit: "CENTER",
    by: "maya",
    needBy: "2026-10-23T06:00:00Z",
    impactIls: 200_000,
    note: "Fresh stock for 5 Center branches",
  },
  {
    on: "T-DAIRY",
    unit: "D-FIN",
    by: "michal",
    needBy: "2026-10-24T12:00:00Z",
    impactIls: 50_000,
    note: "The margin forecast needs the agreed dairy price",
    downstream: "F-MARGIN",
  },
  {
    on: "T-DAIRY",
    unit: "D-MKT",
    by: "ronit",
    needBy: "2026-10-27T12:00:00Z",
    impactIls: 20_000,
    note: "Weekend dairy pricing in the flyer",
  },
  {
    on: "IT-SCO",
    unit: "CENTER",
    by: "maya",
    needBy: "2026-10-19T08:00:00Z",
    impactIls: 15_000,
    note: "Self-checkout lanes back for the weekend",
  },
  {
    on: "L-RECALL-TEMPLATES",
    unit: "D-STORE",
    by: "shira",
    needBy: "2026-10-20T08:00:00Z",
    impactIls: 0,
    note: "Ready-to-use notices for a recall",
  },
];

/** The live conflict for the demo: Marketing records this, and the conflict rules flag Trade's South delisting. */
export const DEMO_DAIRY_PROMO = {
  title: "Weekend dairy discount in South",
  owner: "ronit",
  unit: "D-MKT",
  beneficiaries: ["SOUTH"],
  source: "Promo calendar · 22 Oct",
  dueAt: "2026-10-31T06:00:00Z",
  impactIls: 40_000,
  effects: [
    { resource: "sku-set:south-dairy-6", effect: "promote", windowStart: "2026-10-31", windowEnd: "2026-11-02" },
  ] as CommitmentEffect[],
};
