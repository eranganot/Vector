/**
 * The scenario catalog as seeded insights (docs/specs/scenarios.md). R8 (Haifa Grand Canyon) is not here:
 * the live detector finds it in the generated data. Every other scenario arrives as a synthetic signal
 * from its source feed, with the calibrated priority inputs of docs/specs/priority-scenarios.json
 * (a unit test keeps the two identical). Evidence comes from the generated KPIs where a KPI exists.
 */
import type { Breadth } from "@/domain/priority";

export type CatalogAction = {
  type: string;
  title: string;
  owner: string; // user key (org.ts)
  targets: string[]; // unit codes
  cost: number;
  dueHours: number;
  params?: Record<string, unknown>;
};

/** A lifecycle step played at seed time by a persona, through the normal commands (audited). */
export type CatalogStep = { accept: string; rationale: string } | { acknowledge: string };

type Common = {
  id: string;
  fixture: string;
  title: string;
  whatHappened: string;
  whyItMatters: string;
  signalType: string;
  source: string;
  primary: string; // unit code: who decides (authorization.md: decision.decide over the primary unit)
  affected: string[]; // unit codes, including every involved department
  owner: string; // owning department code
  confidence: number;
  /** KPI evidence drawn from the generated observations: KPI code and the units to average. */
  evidence?: { kpi: string; units: string[]; title: string };
  facts: Record<string, unknown>;
  recommendation: { statement: string; rationale: string; actions: CatalogAction[] };
  steps?: CatalogStep[];
};

export type CatalogRisk = Common & {
  workstream: "risk";
  z: number;
  impactIls: number;
  breadth: Breadth;
  hoursToImpact: number | null;
  strategicWeight: number;
  compliance: number;
  costLine?: "labor" | "operating";
};

export type CatalogOpportunity = Common & {
  workstream: "opportunity";
  valueIls: number;
  costIls: number;
  reach: Breadth;
  hoursToClose: number;
  strategicFit: number;
};

export type CatalogItem = CatalogRisk | CatalogOpportunity;

const NORTH_DIP = ["KAT", "KRM", "AKO", "NHR", "TIB", "AFL", "KSH", "YKN", "SAF"];
const REGIONS = ["NORTH", "COAST", "CENTER", "JERUSALEM", "SOUTH"];

export const CATALOG: CatalogItem[] = [
  {
    id: "R1",
    fixture: "S12",
    workstream: "risk",
    title: "Food-safety recall: chilled dessert batch off shelves in all 60 branches within 12 h",
    whatHappened:
      "A dairy supplier recalled batch 4471 of a chilled dessert after a lab finding. The batch was delivered to all 60 branches between 18 and 21 October.",
    whyItMatters:
      "The regulator requires the product off shelves within 12 hours and a notice within 24. About ₪180k of stock is affected, and a missed deadline is a regulatory breach.",
    signalType: "external_event",
    source: "supplier_notice",
    primary: "D-LEGAL",
    affected: [...REGIONS, "D-SUPPLY", "D-STORE", "D-IT", "D-MKT", "D-FIN"],
    owner: "D-LEGAL",
    confidence: 0.95,
    z: 4,
    impactIls: 180000,
    breadth: "systemic",
    hoursToImpact: 12,
    strategicWeight: 1,
    compliance: 1,
    facts: { supplier: "Galil Dairies (synthetic)", batch: "4471", branches: 60, deadlineHours: 12 },
    recommendation: {
      statement: "Pull batch 4471 from every branch now, notify the regulator, and tell affected customers",
      rationale: "A regulator-mandated action with a 12-hour clock outranks everything else.",
      actions: [
        {
          type: "recall",
          title: "Quarantine batch 4471 at the DCs and pull it from 60 branches",
          owner: "noa",
          targets: ["GROUP"],
          cost: 12000,
          dueHours: 12,
        },
        {
          type: "regulatory_notification",
          title: "Notify the food-safety regulator of the recall",
          owner: "yael",
          targets: ["D-LEGAL"],
          cost: 0,
          dueHours: 24,
        },
        {
          type: "customer_message",
          title: "Recall notice to loyalty customers who bought batch 4471",
          owner: "ronit",
          targets: ["GROUP"],
          cost: 0,
          dueHours: 24,
          params: { channel: "sms+email" },
        },
        {
          type: "schedule_change",
          title: "Block the SKU at every POS",
          owner: "amir",
          targets: ["D-IT"],
          cost: 0,
          dueHours: 6,
        },
      ],
    },
    steps: [{ accept: "yael", rationale: "Regulator-mandated. Go." }],
  },
  {
    id: "R2",
    fixture: "S04",
    workstream: "risk",
    title: "North DC delivery delays cascading to 14 branches in North and Center",
    whatHappened:
      "The North DC missed two delivery waves on 20–21 October (on-time deliveries fell from 95% to 78%). 14 branches in North and Center are short of fresh stock.",
    whyItMatters:
      "About ₪450k of weekly sales is at stake within 24 hours, including promo items Marketing is advertising this week.",
    signalType: "dependency_delay",
    source: "dc_feed",
    primary: "D-SUPPLY",
    affected: ["NORTH", "CENTER", "D-STORE", "D-MKT", "D-FIN"],
    owner: "D-SUPPLY",
    confidence: 0.9,
    evidence: { kpi: "dc_on_time", units: ["D-SUPPLY"], title: "DC deliveries on time vs. target" },
    z: 3,
    impactIls: 450000,
    breadth: "systemic",
    hoursToImpact: 24,
    strategicWeight: 0.9,
    compliance: 0,
    facts: { dc: "North DC", missedWaves: 2, branches: 14 },
    recommendation: {
      statement: "Reroute two trucks via the Center DC until the North DC catches up",
      rationale: "The Center DC has spare capacity tonight; rerouting costs less than one day of lost sales.",
      actions: [
        {
          type: "reroute_delivery",
          title: "Reroute 2 trucks via the Center DC for 3 days",
          owner: "noa",
          targets: ["NORTH", "CENTER"],
          cost: 30000,
          dueHours: 12,
        },
        {
          type: "notify_owner",
          title: "Brief North and Center branch managers on revised delivery times",
          owner: "shira",
          targets: ["NORTH", "CENTER"],
          cost: 0,
          dueHours: 6,
        },
      ],
    },
  },
  {
    id: "R3",
    fixture: "S02",
    workstream: "risk",
    title: "Stock-outs on top-50 SKUs in 9 North branches before the holiday weekend",
    whatHappened:
      "On-shelf availability of the top-50 SKUs fell to about 91% in 9 North branches over the last two days. Supplier fill rate dropped to 93% in the same days.",
    whyItMatters:
      "The holiday weekend starts in 48 hours; about ₪600k of weekly sales is at stake if shelves are not refilled.",
    signalType: "kpi_deviation",
    source: "kpi_observation",
    primary: "NORTH",
    affected: NORTH_DIP.concat(["D-SUPPLY", "D-TRADE", "D-STORE", "D-FIN"]),
    owner: "D-SUPPLY",
    confidence: 0.85,
    evidence: { kpi: "osa", units: NORTH_DIP, title: "On-shelf availability, 9 North branches, vs. target" },
    z: 3.5,
    impactIls: 600000,
    breadth: "regional",
    hoursToImpact: 48,
    strategicWeight: 0.9,
    compliance: 0,
    facts: { branches: NORTH_DIP.length, osa: 91, holidayInHours: 48 },
    recommendation: {
      statement: "Transfer stock from the Center DC and add weekend staff to refill shelves before the holiday",
      rationale: "Stock exists in the network; the gap is allocation and shelf time.",
      actions: [
        {
          type: "inventory_transfer",
          title: "Transfer top-50 SKU stock from the Center DC to 9 North branches",
          owner: "noa",
          targets: NORTH_DIP,
          cost: 8000,
          dueHours: 36,
          params: { source: "Center DC" },
        },
        {
          type: "staffing_change",
          title: "Weekend staffing uplift, 9 North branches",
          owner: "shira",
          targets: NORTH_DIP,
          cost: 54000,
          dueHours: 40,
        },
      ],
    },
    steps: [{ accept: "yossi", rationale: "Agree. Holiday weekend is the priority." }],
  },
  {
    id: "R4",
    fixture: "S06",
    workstream: "risk",
    title: "Holiday promo assets for 60 branches 3 days late; launch in 2 days",
    whatHappened:
      "Signage and shelf talkers committed at the weekly ops meeting were due on 19 October and have not shipped. Campaigns on schedule fell to 72%.",
    whyItMatters:
      "The promotion launches in 48 hours in every branch; promo stock is already on its way and supplier co-funding depends on in-store execution (about ₪300k).",
    signalType: "commitment_overdue",
    source: "meeting_commitments",
    primary: "D-MKT",
    affected: [...REGIONS, "D-STORE", "D-SUPPLY", "D-TRADE"],
    owner: "D-MKT",
    confidence: 0.95,
    evidence: { kpi: "campaign_ready", units: ["D-MKT"], title: "Campaigns on schedule vs. target" },
    z: 2.5,
    impactIls: 300000,
    breadth: "systemic",
    hoursToImpact: 48,
    strategicWeight: 0.8,
    compliance: 0,
    facts: { commitment: "Holiday promo signage", dueDate: "2026-10-19", owner: "Marketing", branches: 60 },
    recommendation: {
      statement: "Escalate to the agency and print a reduced asset set in-house for launch day",
      rationale: "A partial set on time beats a full set late; co-funding needs in-store execution on day one.",
      actions: [
        {
          type: "supplier_message",
          title: "Escalation to the creative agency: deliver by Friday 10:00",
          owner: "ronit",
          targets: ["D-MKT"],
          cost: 0,
          dueHours: 4,
        },
        {
          type: "campaign_change",
          title: "Print a reduced in-house asset set for 60 branches",
          owner: "ronit",
          targets: ["D-MKT"],
          cost: 18000,
          dueHours: 30,
        },
      ],
    },
  },
  {
    id: "R5",
    fixture: "S14",
    workstream: "risk",
    title: "New wage rule in 30 days; HR's updated pay tables are 5 days overdue",
    whatHappened:
      "A (synthetic) wage rule takes effect on 21 November. HR committed to publish updated pay tables by 17 October; compliance items on time fell to 80%.",
    whyItMatters:
      "Rosters must be compliant on the effective date, and the labor forecast rises about ₪120k per week. Compliance exposure: a legal deadline.",
    signalType: "commitment_overdue",
    source: "compliance_register",
    primary: "D-HR",
    affected: ["D-LEGAL", "D-FIN", "D-STORE"],
    owner: "D-HR",
    confidence: 0.9,
    evidence: { kpi: "compliance_on_time", units: ["D-LEGAL"], title: "Compliance items on time vs. target" },
    z: 2,
    impactIls: 120000,
    breadth: "systemic",
    hoursToImpact: -120,
    strategicWeight: 0.5,
    compliance: 0.8,
    facts: { effectiveDate: "2026-11-21", committedBy: "2026-10-17", daysOverdue: 5 },
    recommendation: {
      statement: "Publish the pay tables this week and re-forecast labor cost for Q4",
      rationale: "Rosters need two pay cycles of lead time before the effective date.",
      actions: [
        {
          type: "notify_owner",
          title: "Publish updated pay tables (HR) and confirm with Legal",
          owner: "hila",
          targets: ["D-HR"],
          cost: 0,
          dueHours: 72,
        },
        {
          type: "forecast_update",
          title: "Re-forecast Q4 labor cost (+₪120k/week)",
          owner: "michal",
          targets: ["D-FIN"],
          cost: 0,
          dueHours: 120,
        },
      ],
    },
  },
  {
    id: "R6",
    fixture: "S11",
    workstream: "risk",
    title: "Key dairy supplier +7% on 120 SKUs in 10 days; a promo is planned on 30 of them",
    whatHappened:
      "A key dairy supplier notified a 7% cost increase on 120 SKUs from 1 November. Marketing's November promotion covers 30 of those SKUs at the old cost.",
    whyItMatters:
      "Margin falls about ₪250k per week if prices hold. The supply contract has a 30-day price-protection clause (contractual exposure).",
    signalType: "external_event",
    source: "supplier_notice",
    primary: "D-TRADE",
    affected: ["D-FIN", "D-MKT", "D-LEGAL", "D-STORE"],
    owner: "D-TRADE",
    confidence: 0.9,
    evidence: { kpi: "gross_margin", units: ["D-TRADE"], title: "Gross margin vs. plan" },
    z: 2.5,
    impactIls: 250000,
    breadth: "systemic",
    hoursToImpact: 240,
    strategicWeight: 0.7,
    compliance: 0.3,
    facts: { supplier: "Emek Dairy (synthetic)", increase: 0.07, skus: 120, promoSkus: 30, effective: "2026-11-01" },
    recommendation: {
      statement: "Invoke the 30-day price-protection clause and reprice the promotion only if it fails",
      rationale: "The clause buys a month at the old cost, which covers the promotion.",
      actions: [
        {
          type: "contract_clause_invocation",
          title: "Invoke the 30-day price-protection clause",
          owner: "eitan",
          targets: ["D-TRADE"],
          cost: 0,
          dueHours: 72,
        },
        {
          type: "supplier_message",
          title: "Formal response to the supplier's notice",
          owner: "eitan",
          targets: ["D-TRADE"],
          cost: 0,
          dueHours: 72,
        },
      ],
    },
  },
  {
    id: "R7",
    fixture: "S15",
    workstream: "risk",
    title: "Finance spend freeze vs. Marketing's committed ₪350k Q4 campaign",
    whatHappened:
      "Finance froze Q4 discretionary spend after an IT project and two refurbishments overran (operating spend at 106% of budget). Marketing's ₪350k campaign is contracted and starts in 7 days.",
    whyItMatters:
      "Either the freeze or the campaign has to give. Cancelling has agency penalties and loses supplier co-funding.",
    signalType: "decision_conflict",
    source: "decision_register",
    primary: "D-FIN",
    affected: ["D-MKT", "D-LEGAL", "D-TRADE", "D-IT"],
    owner: "D-FIN",
    confidence: 0.85,
    evidence: { kpi: "opex_vs_budget", units: ["D-FIN"], title: "Operating spend vs. budget (100 = on budget)" },
    z: 1.5,
    impactIls: 350000,
    breadth: "systemic",
    hoursToImpact: 168,
    strategicWeight: 0.7,
    compliance: 0.3,
    facts: { campaign: 350000, opexVsBudget: 1.06, startsInDays: 7 },
    recommendation: {
      statement: "Keep the campaign, funded by deferring the IT project's second phase",
      rationale: "The campaign has co-funding and cancellation penalties; the IT phase has neither.",
      actions: [
        {
          type: "budget_decision",
          title: "Reallocate ₪350k from IT phase 2 to the Q4 campaign",
          owner: "michal",
          targets: ["D-FIN"],
          cost: 0,
          dueHours: 72,
        },
      ],
    },
  },
  {
    id: "R9",
    fixture: "S13",
    workstream: "risk",
    title: "POS upgrade scheduled inside the holiday peak across 60 branches",
    whatHappened:
      "IT scheduled the POS upgrade for all 60 branches in the two weeks before the holiday. HR has not booked the training sessions.",
    whyItMatters:
      "A cut-over during peak trading puts about ₪400k per week of sales at risk, plus payment reconciliation work for Finance.",
    signalType: "decision_conflict",
    source: "change_calendar",
    primary: "D-IT",
    affected: [...REGIONS, "D-STORE", "D-HR", "D-MKT", "D-FIN"],
    owner: "D-IT",
    confidence: 0.8,
    z: 2,
    impactIls: 400000,
    breadth: "systemic",
    hoursToImpact: 336,
    strategicWeight: 0.6,
    compliance: 0.3,
    facts: { branches: 60, window: "2026-11-05 to 2026-11-19" },
    recommendation: {
      statement: "Run a 5-branch pilot now and move the full rollout after the holiday",
      rationale: "Keeps the upgrade moving without a cut-over in peak weeks.",
      actions: [
        {
          type: "schedule_change",
          title: "Move the 60-branch POS cut-over after the holiday; pilot in 5 branches",
          owner: "amir",
          targets: ["D-IT"],
          cost: 0,
          dueHours: 96,
        },
        {
          type: "training_session",
          title: "Book POS training for the 5 pilot branches",
          owner: "hila",
          targets: ["D-HR"],
          cost: 4000,
          dueHours: 120,
        },
      ],
    },
  },
  {
    id: "R10",
    fixture: "S09",
    workstream: "risk",
    title: "Shrinkage spike at Tel Aviv Dizengoff",
    whatHappened:
      "Shrinkage at Tel Aviv Dizengoff rose from about 1.4% to 4.4% of sales over the last five days, concentrated in health & beauty.",
    whyItMatters: "About ₪40k per week is being lost. Evidence handling may involve the police.",
    signalType: "kpi_deviation",
    source: "kpi_observation",
    primary: "TLV-DZ",
    affected: ["CENTER", "D-STORE", "D-LEGAL", "D-HR", "D-FIN"],
    owner: "D-STORE",
    confidence: 0.8,
    evidence: { kpi: "shrink_pct", units: ["TLV-DZ"], title: "Shrinkage % of sales, Tel Aviv Dizengoff, vs. target" },
    z: 3.5,
    impactIls: 40000,
    breadth: "isolated",
    hoursToImpact: null,
    strategicWeight: 0.6,
    compliance: 0,
    facts: { category: "health & beauty", days: 5 },
    recommendation: {
      statement: "Add security staff in the evening shift and audit health & beauty stock",
      rationale: "The losses cluster in evening hours in one category.",
      actions: [
        {
          type: "staffing_change",
          title: "Evening security guard for 2 weeks",
          owner: "shira",
          targets: ["TLV-DZ"],
          cost: 9000,
          dueHours: 24,
        },
        {
          type: "notify_owner",
          title: "Stock audit: health & beauty",
          owner: "lior",
          targets: ["TLV-DZ"],
          cost: 0,
          dueHours: 48,
        },
      ],
    },
  },
  {
    id: "R11",
    fixture: "S05",
    workstream: "risk",
    title: "Labor cost 6% over plan across the Center region",
    whatHappened:
      "Labor cost as a share of sales has run about 6% above plan in all 12 Center branches for three weeks.",
    whyItMatters: "About ₪90k per week over the labor budget. Rosters have not been updated since the summer schedule.",
    signalType: "kpi_deviation",
    source: "kpi_observation",
    primary: "CENTER",
    affected: ["D-STORE", "D-HR", "D-FIN"],
    owner: "D-STORE",
    confidence: 0.85,
    evidence: { kpi: "labor_pct", units: ["CENTER"], title: "Labor cost % of sales, Center region, vs. target" },
    z: 2.2,
    impactIls: 90000,
    breadth: "regional",
    hoursToImpact: 168,
    strategicWeight: 0.5,
    compliance: 0,
    costLine: "labor",
    facts: { branches: 12, overPlan: 0.06, weeks: 3 },
    recommendation: {
      statement: "Move Center rosters to the autumn schedule",
      rationale: "Hours still follow the summer peak while sales have normalised.",
      actions: [
        {
          type: "staffing_change",
          title: "Autumn rosters for 12 Center branches",
          owner: "shira",
          targets: ["CENTER"],
          cost: 0,
          dueHours: 120,
        },
      ],
    },
  },
  {
    id: "R12",
    fixture: "S07",
    workstream: "risk",
    title: "Promotion planned on items Trade & Commercial is delisting (5 branches)",
    whatHappened:
      "Marketing scheduled a promotion in 10 days on 14 items that Trade & Commercial is delisting at 5 Coast branches.",
    whyItMatters: "About ₪80k of promo spend on items that will be gone, and empty promo shelf space.",
    signalType: "decision_conflict",
    source: "decision_register",
    primary: "D-TRADE",
    affected: ["D-MKT", "D-SUPPLY", "D-STORE", "COAST"],
    owner: "D-TRADE",
    confidence: 0.8,
    z: 2,
    impactIls: 80000,
    breadth: "local",
    hoursToImpact: 240,
    strategicWeight: 0.7,
    compliance: 0,
    facts: { items: 14, branches: 5 },
    recommendation: {
      statement: "Swap the 14 items in the promotion for their replacements",
      rationale: "Keeps the promotion and clears the conflict in one change.",
      actions: [
        {
          type: "campaign_change",
          title: "Swap 14 delisted items for their replacements in the promo",
          owner: "ronit",
          targets: ["D-MKT"],
          cost: 0,
          dueHours: 96,
        },
      ],
    },
  },
  {
    id: "R13",
    fixture: "S10",
    workstream: "risk",
    title: "2-hour POS outage at Tel Aviv Dizengoff, already resolved",
    whatHappened:
      "Four of eight tills at Tel Aviv Dizengoff were down for two hours on 21 October. IT fixed it the same day.",
    whyItMatters: "About ₪8k of sales was lost and needs reconciling. Unusual, but resolved.",
    signalType: "incident",
    source: "it_incidents",
    primary: "TLV-DZ",
    affected: ["CENTER", "D-IT", "D-STORE", "D-FIN"],
    owner: "D-IT",
    confidence: 0.95,
    evidence: { kpi: "pos_uptime", units: ["D-IT"], title: "POS uptime vs. target" },
    z: 4,
    impactIls: 8000,
    breadth: "isolated",
    hoursToImpact: 2000,
    strategicWeight: 0.4,
    compliance: 0,
    facts: { tills: 4, hours: 2, resolved: true },
    recommendation: {
      statement: "Reconcile the day's payments and close the incident",
      rationale: "The outage is fixed; only reconciliation is left.",
      actions: [
        {
          type: "notify_owner",
          title: "Reconcile 21 October card payments",
          owner: "michal",
          targets: ["TLV-DZ"],
          cost: 0,
          dueHours: 72,
        },
      ],
    },
    steps: [{ acknowledge: "lior" }],
  },
  {
    id: "R14",
    fixture: "S03",
    workstream: "risk",
    title: "Customer NPS at Tel Aviv Dizengoff 4 points below its range",
    whatHappened:
      "NPS at Tel Aviv Dizengoff has been about 4 points below its usual range for two weeks; comments mention queues.",
    whyItMatters: "About ₪15k per week of repeat visits at risk if it persists.",
    signalType: "kpi_deviation",
    source: "kpi_observation",
    primary: "TLV-DZ",
    affected: ["CENTER", "D-STORE", "D-HR", "D-MKT"],
    owner: "D-STORE",
    confidence: 0.7,
    evidence: { kpi: "nps", units: ["TLV-DZ"], title: "Customer NPS, Tel Aviv Dizengoff, vs. target" },
    z: 1.6,
    impactIls: 15000,
    breadth: "isolated",
    hoursToImpact: 720,
    strategicWeight: 0.6,
    compliance: 0,
    facts: { weeks: 2, theme: "queues" },
    recommendation: {
      statement: "Open an extra till at peak hours and follow up with detractors",
      rationale: "Queue complaints line up with the evening peak.",
      actions: [
        {
          type: "training_session",
          title: "Service refresher for the evening team",
          owner: "hila",
          targets: ["TLV-DZ"],
          cost: 2000,
          dueHours: 168,
        },
      ],
    },
  },
  // ── Opportunity workstream ────────────────────────────────────────────────
  {
    id: "O1",
    fixture: "OP1",
    workstream: "opportunity",
    title: "Heatwave in the South in 3 days: beverage and ice-cream demand",
    whatHappened:
      "The forecast shows 38–41°C in the South from 25 to 28 October. Eight South branches sell most of the region's beverages.",
    whyItMatters: "Comparable heatwaves lifted beverage and ice-cream sales about ₪150k across the eight branches.",
    signalType: "external_event",
    source: "weather_forecast",
    primary: "SOUTH",
    affected: ["BS-GN", "BS-OC", "ASH", "ASK", "KG", "DIM", "ARD", "EIL", "D-STORE", "D-SUPPLY", "D-MKT", "D-HR"],
    owner: "D-STORE",
    confidence: 0.7,
    valueIls: 150000,
    costIls: 20000,
    reach: "regional",
    hoursToClose: 72,
    strategicFit: 0.7,
    facts: { tempMax: 41, days: 4, branches: 8 },
    recommendation: {
      statement: "Pre-stock beverages and ice cream and add afternoon staff in 8 South branches",
      rationale: "Deliveries must leave the DC within 48 hours to land before the peak.",
      actions: [
        {
          type: "reroute_delivery",
          title: "Extra beverage and ice-cream deliveries to 8 South branches",
          owner: "noa",
          targets: ["BS-GN", "BS-OC", "ASH", "ASK", "KG", "DIM", "ARD", "EIL"],
          cost: 12000,
          dueHours: 48,
        },
        {
          type: "staffing_change",
          title: "Afternoon staff uplift during the heatwave",
          owner: "shira",
          targets: ["BS-GN", "BS-OC", "ASH", "ASK", "KG", "DIM", "ARD", "EIL"],
          cost: 8000,
          dueHours: 60,
        },
      ],
    },
    steps: [{ accept: "omer", rationale: "Yes — let's be ready." }],
  },
  {
    id: "O2",
    fixture: "OP2",
    workstream: "opportunity",
    title: "Competitor store near Ramat Gan Ayalon closes in 3 weeks",
    whatHappened: "A competing supermarket 600 m from Ramat Gan Ayalon announced it will close on 12 November.",
    whyItMatters: "Its customers will look for a new store. Capturing a third of them is worth about ₪90k per week.",
    signalType: "external_event",
    source: "market_news",
    primary: "D-MKT",
    affected: ["RG-AY", "D-STORE", "D-HR", "D-SUPPLY", "D-FIN"],
    owner: "D-MKT",
    confidence: 0.6,
    valueIls: 90000,
    costIls: 35000,
    reach: "local",
    hoursToClose: 504,
    strategicFit: 0.8,
    facts: { distanceM: 600, closes: "2026-11-12" },
    recommendation: {
      statement: "Run a local welcome campaign and add capacity at Ramat Gan Ayalon",
      rationale: "The first two weeks after a closure decide where customers settle.",
      actions: [
        {
          type: "campaign_change",
          title: "Local welcome campaign around Ramat Gan Ayalon",
          owner: "ronit",
          targets: ["RG-AY"],
          cost: 35000,
          dueHours: 240,
        },
      ],
    },
  },
  {
    id: "O3",
    fixture: "OP3",
    workstream: "opportunity",
    title: "Supplier overstock offer: 25% off two categories, expires in 5 days",
    whatHappened: "A snacks supplier offers two categories at 25% off for a ₪200k volume commitment.",
    whyItMatters: "About ₪60k of extra margin if it sells through within six weeks; it ties up cash and storage.",
    signalType: "external_event",
    source: "supplier_offer",
    primary: "D-TRADE",
    affected: ["D-FIN", "D-SUPPLY", "D-MKT", "D-LEGAL"],
    owner: "D-TRADE",
    confidence: 0.9,
    valueIls: 60000,
    costIls: 200000,
    reach: "systemic",
    hoursToClose: 120,
    strategicFit: 0.5,
    facts: { discount: 0.25, commitment: 200000 },
    recommendation: {
      statement: "Accept half the volume and pair it with a sell-through promotion",
      rationale: "Halves the cash and storage risk and keeps most of the margin.",
      actions: [
        {
          type: "purchase_order",
          title: "Buy ₪100k of the offer (half volume)",
          owner: "eitan",
          targets: ["D-TRADE"],
          cost: 100000,
          dueHours: 96,
        },
      ],
    },
  },
  {
    id: "O4",
    fixture: "OP4",
    workstream: "opportunity",
    title: "Click-and-collect orders +40% in Center: add pickup capacity before the holiday",
    whatHappened: "Click-and-collect orders in Center are up 40% for four weeks; evening slots sell out by noon.",
    whyItMatters: "More slots before the holiday are worth about ₪70k per week of online sales.",
    signalType: "kpi_deviation",
    source: "online_orders",
    primary: "D-IT",
    affected: ["CENTER", "D-STORE", "D-HR", "D-MKT"],
    owner: "D-IT",
    confidence: 0.85,
    valueIls: 70000,
    costIls: 15000,
    reach: "regional",
    hoursToClose: 336,
    strategicFit: 0.9,
    facts: { growth: 0.4, weeks: 4 },
    recommendation: {
      statement: "Open 30% more evening slots in Center and staff the pickup points",
      rationale: "Demand is proven; capacity is the constraint.",
      actions: [
        {
          type: "schedule_change",
          title: "Add evening pickup slots in the ordering system",
          owner: "amir",
          targets: ["D-IT"],
          cost: 5000,
          dueHours: 120,
        },
        {
          type: "staffing_change",
          title: "Pickers for the extra evening slots",
          owner: "shira",
          targets: ["CENTER"],
          cost: 10000,
          dueHours: 168,
        },
      ],
    },
  },
  {
    id: "O5",
    fixture: "OP5",
    workstream: "opportunity",
    title: "300 m² unused at Petah Tikva: lease to a pop-up partner",
    whatHappened: "A space review found 300 m² of unused floor space at Petah Tikva since the pharmacy moved out.",
    whyItMatters: "A pop-up lease would bring about ₪6k per week. Low urgency; worth keeping in view.",
    signalType: "facility_review",
    source: "facility_data",
    primary: "PT",
    affected: ["CENTER", "D-STORE", "D-LEGAL", "D-FIN", "D-TRADE"],
    owner: "D-STORE",
    confidence: 0.7,
    valueIls: 6000,
    costIls: 5000,
    reach: "isolated",
    hoursToClose: 2000,
    strategicFit: 0.4,
    facts: { m2: 300 },
    recommendation: {
      statement: "Ask Legal to draft a short-term lease template and shortlist partners",
      rationale: "Cheap to prepare; no rush.",
      actions: [
        {
          type: "notify_owner",
          title: "Shortlist pop-up partners for Petah Tikva",
          owner: "shira",
          targets: ["PT"],
          cost: 0,
          dueHours: 720,
        },
      ],
    },
  },
];
