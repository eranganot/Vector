# Stage E0: specs and design (plan v2)

Status: **Built 2026-10-06; awaiting Eran's design gate.** No product code changes. The gate approves the design
before E1 code starts.

## Inputs

Eran's feedback on Phases 0–4 (2026-10-06, items #1–#11) and his answers, recorded as FB-0 to FB-12 in
[DECISIONS.md](../DECISIONS.md).

## Deliverables

| Deliverable                                                                          | Where                                                                              |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Plan v2 summary                                                                      | [EXECUTION_PLAN.md](../EXECUTION_PLAN.md); Claude doc "VECTOR — Execution Plan v2" |
| C-suite home, IA v2, health-v2 and projection-v1 models, ₪ headers, "Where to focus" | [specs/executive-home.md](../specs/executive-home.md)                              |
| Financial data model, synthetic data v5, COO persona                                 | [specs/financials.md](../specs/financials.md)                                      |
| C-suite read scope                                                                   | [adr/ADR-008-c-suite-scope.md](../adr/ADR-008-c-suite-scope.md)                    |
| Opportunities value map, action economics, initiatives and "management needed" rules | [specs/cross-department.md](../specs/cross-department.md)                          |
| Action Center and channel seam                                                       | [specs/action-center.md](../specs/action-center.md)                                |
| Reports                                                                              | [specs/reports.md](../specs/reports.md)                                            |
| Market & competitors, with sources checked on 2026-10-06                             | [specs/market-intelligence.md](../specs/market-intelligence.md)                    |
| Mail agent                                                                           | [specs/mail-agent.md](../specs/mail-agent.md)                                      |
| Wireframes for the C-suite home and the new tabs                                     | [specs/wireframes/v3/](../specs/wireframes/v3/) (v2 kept for history)              |

## For Eran to confirm at the gate

1. **ADR-008.** The CFO and COO read the group through a Viewer @ Group grant, while their acting rights stay on
   their departments. The COO acts on Store Operations and Supply Chain, not as a second Executive, so approval
   routing does not change.
2. **health-v2 weights:** KPIs 45%, money 35%, risk load 20%. The score scale is unchanged (healthy ≥ 80, watch ≥ 60).
3. **projection-v1** terms: run-rate + risk drag + action lift, with a ±1σ range.
4. **Department money lines** (executive-home.md §6) and the calibrated group P&L (financials.md §1).
5. **"Management needed" rules M1–M5** and their thresholds.
6. **Wireframes v3** (after Eran's first review, G-E0a–f).
7. **Gross margin calibration.** Our seeded target is 31.5%. Rami Levy reports 23.6% (Q2 2026). Next to real
   competitors, ~26% would be more credible; the change would land in data v5 (E1).

## Verification

The PR passes CI (format, lint, typecheck, tests). After the merge, Dev serves the merged SHA and smoke passes.
