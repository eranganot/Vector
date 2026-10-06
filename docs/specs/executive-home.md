# C-suite home (E2) and IA v2

Status: **Proposed (E0, 2026-10-06), for Eran's design gate.** Implements FB-1 to FB-6 and FB-12. Wireframes:
[wireframes/v2/](wireframes/v2/). This page replaces the "KPIs never the headline" principle of the Phase 1 IA with
FB-3: **health and money lead, and every number carries its cause.**

## 1. The five-second promise

A C-level who opens VECTOR must be able to say within five seconds:

1. **How are we doing?** Health per department: state and change.
2. **What changed, and why?** The two or three causes behind the change.
3. **Where is it heading?** End-of-month and end-of-quarter projections against target.
4. **Where should I spend my attention?** A ranked list, with ₪.

The Time-to-Understanding check (time-to-understanding.md) moves to these four questions. In the automated check at
1440×900, all four must be above the fold for Dana (CEO), Michal (CFO) and one VP.

## 2. Navigation (IA v2)

Header: **VECTOR | Organizational Intelligence** (Hebrew: **VECTOR | אינטליגנציה ארגונית**, FB-2). It also carries
the demo clock, the language switch and the persona chip. The page `<title>` is `<page> · VECTOR | Organizational
Intelligence`. The same name appears on sign-in, exports and outbox messages.

C-suite sidebar, in order of use:

| Tab                  | Route            | Question it answers                                         | Stage            |
| -------------------- | ---------------- | ----------------------------------------------------------- | ---------------- |
| Home                 | `/`              | How are we doing, why, where is it heading, where to focus? | E2               |
| Action Center        | `/action-center` | What should become an action, with whom, saying what?       | E4               |
| Waiting on you       | `/approvals`     | What must I decide or approve? (same items, FB-12)          | as is            |
| Risks                | `/risks`         | What could hurt us, and what is it worth?                   | as is + ₪ header |
| Opportunities        | `/opportunities` | What could we gain, at what cost and risk?                  | E3               |
| Cross-department     | `/initiatives`   | Which shared projects need management?                      | E3               |
| Commitments          | `/commitments`   | Who promised what, and what is it worth?                    | as is + ₪ header |
| Actions & outcomes   | `/actions`       | What is in flight, and did it work?                         | as is + ₪ header |
| Market & competitors | `/market`        | What changed outside, and how does it hit us?               | E6               |
| Reports              | `/reports`       | Materials for meetings and the board                        | E5               |
| Inbox                | `/inbox`         | Which messages wait on me or need a decision?               | E7               |
| Organization · Audit | `/org`, `/audit` | as today                                                    | as is            |

People who are not C-suite (regional and branch managers, Ben, Dafna, the board observer) keep today's home and
navigation. They also gain the tabs that are not C-suite-specific (Cross-department, Reports) where their scope holds
content.

## 3. Home layout (top to bottom)

1. **Headline line**: one sentence for the scope, e.g. "Supply Chain and Store Operations are slipping; October
   tracks −2.1% to sales budget." Below it, a subline: P1 count, ₪ at stake, and how many items wait on you.
2. **Health strip**: one tile per department (8; FB-4). Each tile shows:
   - **score and state** (0–100; healthy ≥ 80, watch 60–79, at risk < 60, always as a dot plus a word);
   - **change** versus 7 days earlier (▲/▼ points, green when better);
   - **projection**: health at end of quarter, with a direction word (improving, stable, worsening);
   - **one cause line**, the largest contributor to the change, linked to its insight.

   Clicking a tile opens the drill-down: that department's KPIs and financials **by region** (5 rows) and the items
   behind them. A Group / Region toggle shows the same strip per region (§4.4).

3. **Why it changed**: two or three cause cards for the scope: what moved, by how much in ₪ or points, and the
   insight, decision, action or external event behind it (§5).
4. **Financials vs budget**: a compact table, one row per department, showing that department's money KPIs (§6) for
   month to date, with columns for budget, variance, and end-of-month and end-of-quarter projections against target.
   Totals in the group row: revenue, gross margin, operating profit.
5. **Where to focus**: up to 5 ranked items (§7), each with ₪, band, who acts, and one button (Decide, Approve, Open,
   Make it an action).
6. **Waiting on you**: as today (FB-12); hidden when empty.
7. Below the fold: risk and opportunity summaries, cross-department initiatives needing management (E3), market
   headline (E6), what changed in the last 24 h.

VPs get the same layout for their own department. The health strip then shows their department plus the regions
(their department's KPIs per region), and Financials shows only their department's lines.

## 4. Health model (`health-v2`, deterministic)

### 4.1 Score

For a department `d` on day `t`:

```text
health(d,t) = 0.45 × KPI attainment + 0.35 × financial attainment + 0.20 × risk load
```

- **Attainment of one measure** `m` (a KPI or a financial line): let `g` be the signed gap to target in %, negative
  when worse (`(actual − target) / target`, sign flipped when lower is better). Then `score(m) = 100` when `g ≥ 0`,
  otherwise `max(0, 100 + 8 × g)`. So −2.5% scores 80 and −5% scores 60. A measure with no fixed target uses its
  usual level (same weekday, previous four weeks), as today.
- **KPI attainment**: the mean over the KPIs the department owns, last 7 complete days.
- **Financial attainment**: the mean over the department's money lines (§6), month to date against budget to date.
- **Risk load**: `max(0, 100 − Σ owned (P1 20 · P2 10 · P3 4 · P4 1) − Σ must-act (P1 6 · P2 3 · P3 1))`. This is
  today's pulse formula, kept so that open risks still count.

The weights are a config value (`health_weights`). Changing them follows the existing weight-change approval flow
(`config.priority_weights.*`).

### 4.2 Change and cause

**Change** = `health(d,t) − health(d,t−7)`. The change is **decomposed** into the contribution of each measure
(its score change × its weight ÷ the number of measures in its group) and of the risk load. The largest contributor
becomes the tile's cause line. Each contributor links to the explanation of its move, in this order:

1. an insight whose KPI or financial line is that measure (existing "Explained by" link);
2. an action executed or an outcome verdict in the window that targets it;
3. an external signal (E6);
4. otherwise "No explanation yet", shown on purpose because it is a gap worth seeing.

### 4.3 Projection (`projection-v1`, deterministic; FB-6)

For every money line and every KPI with a target, the projected value at **end of month** (EOM) and **end of
quarter** (EOQ):

```text
projected = actual to date
          + Σ remaining days × run-rate(day)                       (baseline)
          + Σ open risks' expected ₪ effect in the horizon          (risk drag)
          + Σ approved or executing actions' expected ₪ effect      (action lift)
```

- **Run-rate(day)**: the trailing 28-day average for that weekday, × the holiday factor from the calendar, × the
  budget's seasonality for the month. The calendar is `src/domain/calendar.ts`, extended to 52 weeks.
- **Risk drag**: `₪ at stake per week × weeks inside the horizon × (confidence)`, for P1–P2 risks on that line.
  Opportunities count only once their action is approved.
- **Action lift**: the action's expected impact (§ action economics, cross-department.md), × 0.5 when approved and
  × 0.8 when executing.
- **Range**: ±1σ of the daily residuals, shown as a band; the tile states the midpoint.
- **Verdict** against target: on track (projected ≥ target), at risk (within 2%), or miss by ₪X / Y pts.

**Projected health** is the health formula applied to the projected measures, with today's risk load. It gives the
tile's direction word: improving when projected health − health ≥ +3, worsening when ≤ −3, otherwise stable.

Every projection shows a "How this is calculated" breakdown with the three terms and their sources (charter 8.2,
8.8). When the AI agent arrives (after the MVP), it may propose a projection. That proposal is shown beside the
deterministic one, labelled, and never replaces it silently.

### 4.4 Region drill-down

The same score per region uses the branch KPIs averaged over the region's branches, and the money lines that exist
per branch (sales, labor, shrinkage). Department-only lines (marketing spend, IT opex) are not split by region; they
show "group only".

## 5. "Why it changed": cause cards

A cause card is chosen from the contributors of §4.2 summed over all departments, largest |₪| first (points when no
₪ applies). Each card holds:

- one sentence in a fixed template: "{Department} {−8 pts}: {cause title} ({band · score}) — {status of response}";
- ₪ effect this week and the projected effect to EOM;
- links to the insight trace, the decision, the action.

The templates live with the other generated sentences (ADR-007): English in the database, Hebrew by template.

## 6. Money on every page (FB-5)

A **₪ header** of 3–5 figures sits at the top of every list page, for the viewer's scope and current filters:

| Page               | ₪ header                                                                               |
| ------------------ | -------------------------------------------------------------------------------------- |
| Home               | revenue MTD vs budget · gross margin · operating profit MTD vs budget · EOQ projection |
| Risks              | ₪ at stake / week · P1 ₪ · mitigated ₪ (actions executing) · unowned ₪                 |
| Opportunities      | upside / week · cost to capture · net value (EOQ) · captured so far                    |
| Commitments        | value of open commitments · value at risk or overdue · delivered this month            |
| Actions & outcomes | committed cost · expected impact · realised impact (verdicts) · hit rate               |
| Cross-department   | budget · spent · value at risk on blocked initiatives                                  |

Financial lines per department (FB-5; data in financials.md):

| Department         | Money lines on its tile and in Financials                                    |
| ------------------ | ---------------------------------------------------------------------------- |
| Store Operations   | net sales vs budget · labor cost ₪ and % vs budget · shrinkage ₪ · dept opex |
| Trade & Commercial | gross margin % and ₪ vs budget · COGS vs plan · dept opex                    |
| Supply Chain       | logistics cost vs budget · inventory days vs target · waste ₪ · dept opex    |
| Marketing          | marketing spend vs budget · campaign incremental sales ₪ · dept opex         |
| Finance            | group operating profit vs budget · group opex vs budget · dept opex          |
| HR                 | headcount cost vs budget · overtime ₪ · dept opex                            |
| Legal & Compliance | dept opex vs budget · open penalty exposure ₪                                |
| IT                 | IT opex and capex vs budget · cost of downtime ₪                             |

## 7. "Where to focus"

A ranked list of at most 5 items for the viewer. Candidates are:

- P1/P2 risks;
- O1 opportunities with a closing window;
- decisions and approvals waiting on the viewer;
- escalated conflicts;
- initiatives flagged "management needed" (E3);
- money lines projected to miss target by more than 2%.

The ranking is `focus = ₪ at stake (or upside) per week × urgency × level`:

- **urgency** is 1.5 inside 72 h, 1.2 inside 7 days, otherwise 1;
- **level** is 1.5 when it needs a decision at the viewer's level or above, otherwise 1.

Each item carries its button, and "Make it an action" opens the Action Center.

## 8. Acceptance (E2)

- The automated Time-to-Understanding check shows all four answers above the fold for Dana, Michal and Noa, in
  English and Hebrew.
- Every number on the strip and in Financials opens its "how calculated" and its source records.
- health-v2 and projection-v1 have table-driven unit tests with hand-computed fixtures (one per department), plus a
  determinism test: the same seed and clock always give the same scores.
- Smoke checks for the new home are added to `scripts/smoke.ts`; earlier smoke checks still pass.
