# Financial data and synthetic data v5 (E1)

Status: **Proposed (E0, 2026-10-06).** Implements FB-5 and the data needs of FB-4, FB-6 and FB-7. The company stays
synthetic (VECTOR Retail Group); its numbers must sit plausibly next to real competitors (market-intelligence.md).

## 1. Scale check

Today the group sells about ₪51M a week (Dana's home, 2026-10-22), which is about ₪2.66B a year. For comparison,
Shufersal reported NIS 7.1B for H1 2026 ([Globes, 2026-08-27](https://en.globes.co.il/en/article-1001553761)), so
VECTOR Retail Group reads as a mid-sized chain, about a fifth of the market leader. The P&L below is calibrated to
Israeli grocery margins.

| Group line (annual, calibrated) | Share of sales | ≈ ₪M / year |
| ------------------------------- | -------------: | ----------: |
| Net sales                       |           100% |       2,660 |
| Gross margin (target 31.5%)     |          31.5% |         838 |
| Labor (target 15.8%)            |          15.8% |         420 |
| Logistics                       |           4.2% |         112 |
| Rent and occupancy              |           4.8% |         128 |
| Marketing                       |           1.3% |          35 |
| Other opex (HQ, IT, legal, HR)  |           1.4% |          37 |
| **Operating profit (EBITDA)**   |       **4.0%** |     **106** |

## 2. Data model (migration in E1)

| Table                 | Grain                                        | Fields                                                                                                                |
| --------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `fin_account`         | one per money line                           | code, name, kind (`revenue`, `cost`, `margin`, `balance`), higher_is_better, unit (`ils`, `pct`, `days`)              |
| `fin_actual`          | account × org unit × day                     | account_code, org_unit_id, day, amount, source (`seed:v5`; later an ERP adapter)                                      |
| `fin_budget`          | account × org unit × month                   | account_code, org_unit_id, month, amount, version (budget v1; reforecasts are new versions)                           |
| `fin_target`          | account × org unit × period (month, quarter) | for ratio lines (margin %, labor %, inventory days)                                                                   |
| `projection_snapshot` | measure × unit × horizon × computed_at       | inputs and terms (baseline, risk drag, action lift), range, model `projection-v1`; immutable, so a report can cite it |

Branch-level lines (net sales, labor, shrinkage) are stored per branch and summed up the tree. Department-only lines
(marketing spend, IT opex, legal penalties) are stored on the department unit. The fiscal year is the calendar year,
with monthly budgets (FB-5).

Accounts (codes are stable; names are translated per ADR-007):

| Code                  | Line                         | Level      | Owner              |
| --------------------- | ---------------------------- | ---------- | ------------------ |
| `rev_net_sales`       | Net sales                    | branch     | Store Operations   |
| `gm_amount`           | Gross margin ₪               | branch     | Trade & Commercial |
| `gm_pct`              | Gross margin %               | derived    | Trade & Commercial |
| `cogs`                | Cost of goods sold           | branch     | Trade & Commercial |
| `labor_cost`          | Store labor cost             | branch     | Store Operations   |
| `shrink_cost`         | Shrinkage ₪                  | branch     | Store Operations   |
| `logistics_cost`      | Logistics (DC and transport) | department | Supply Chain       |
| `inventory_days`      | Inventory days on hand       | department | Supply Chain       |
| `waste_cost`          | Fresh waste ₪                | branch     | Supply Chain       |
| `mkt_spend`           | Marketing spend              | department | Marketing          |
| `mkt_incremental`     | Campaign incremental sales   | department | Marketing          |
| `headcount_cost`      | Headcount cost (all staff)   | department | HR                 |
| `overtime_cost`       | Overtime                     | department | HR                 |
| `penalty_exposure`    | Open penalty exposure        | department | Legal & Compliance |
| `it_opex`, `it_capex` | IT spend                     | department | IT                 |
| `downtime_cost`       | Cost of POS downtime         | derived    | IT                 |
| `dept_opex`           | Department operating cost    | department | each department    |
| `op_profit`           | Operating profit (EBITDA)    | derived    | Finance            |

## 3. Synthetic data v5 (seed `p5-v1`)

- **History: 52 weeks** (365 days to the story day 2026-10-22), up from 84 days. This allows year-on-year, a
  credible run-rate, and the Q3 2026 close. The holiday calendar is extended to cover Passover 2026 and the summer.
- **Determinism and stability.** New lines draw from their own random streams (same rule as today), so existing KPIs
  and planted stories keep their values. A seed test asserts that every p4 story fixture still holds.
- **Budgets** are generated from the prior year's actuals: budget growth +3.5%, a margin target of 31.5% and a labor
  target of 15.8%, all with monthly seasonality. Planted variances make the stories readable:
  - October tracks −2.1% to sales budget (North DC delays plus the North stock-outs);
  - labor runs over in Center (the G1-c story);
  - marketing spend is frozen (the R7 conflict);
  - IT capex is behind plan (the POS upgrade).
- **Action economics** on every seeded action and playbook: expected impact (₪ per week or one-off, and horizon),
  cost (₪), and execution risk (cross-department.md §3).
- **Initiatives**: 8 seeded cross-department initiatives with milestones, barriers and links to existing
  dependencies (cross-department.md §5).
- **Personas**: a COO (Oren Halevi, COO) with Department Manager @ Store Operations and @ Supply Chain (not head) and
  Viewer @ Group; Michal gains Viewer @ Group (ADR-008). `is_c_suite` is set on the 10 C-suite people.
- **Inbox** seed for the mail agent arrives in E7 (mail-agent.md), not E1.

## 4. Acceptance (E1)

- The generator's unit tests cover reproducibility, the P&L shares in §1 within ±0.3 pts over 52 weeks, budget vs
  actual for each planted variance, and unchanged p4 story values.
- Migration and reseed run on Dev at boot (`p4-v1` → `p5-v1`); health shows the new seed version.
- `doctor` checks that every month has a budget for every account and unit that has actuals.
