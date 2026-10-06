# VECTOR execution plan (summary)

**Plan v2** (2026-10-06) replaces the roadmap after Phase 4. It follows Eran's feedback on Phases 0–4: VECTOR serves
the **C-suite** first, with a clear, trusted status that leads to analysis, decision, action and monitoring. The full
plan is the Claude doc **"VECTOR — Execution Plan v2"**; v1 (approved 2026-10-04) is kept for history. Decisions are
in [DECISIONS.md](DECISIONS.md) (FB-0 to FB-12). If this file and the doc disagree, ask Eran; do not silently pick
one.

## Done (v1)

| Phase                       | Outcome                                                                                           | Status                     |
| --------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------- |
| 0 Foundation                | Deployable, tested, documented shell on Dev                                                       | Signed off (G0)            |
| 1 Product & architecture    | Domain model, policies, priority model, threat model, IA, synthetic data, scenarios; ADR-003..006 | Signed off (G1)            |
| 2 Core VECTOR chain         | Signal → Outcome with authorization, approval and audit; thin UI                                  | Signed off (G-P2), on Prod |
| 3 Organizational experience | 60 branches / 5 regions / 8 departments; Command Center; unit views; local priority               | Signed off (G-P3), on Prod |
| 4 Operational intelligence  | Commitments, dependencies, conflicts, approval UX, actions & outcomes, audit explorer, Hebrew/RTL | Signed off (G-P4), on Prod |

## Plan v2 stages

| Stage                                   | Outcome                                                                                                                                                                        | Feedback items | Specs                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ----------------------------------------------------------------------------- |
| **E0 Specs & design**                   | IA v2, health and projection models, financial data model, new entities, C-suite scope, wireframes                                                                             | all            | this PR                                                                       |
| **E1 Foundation**                       | Product name in EN and HE everywhere; C-suite navigation and scope (ADR-008); COO persona; synthetic data v5 (52 weeks, P&L, budgets, action economics, initiatives)           | 1, 2           | [financials.md](specs/financials.md), [ADR-008](adr/ADR-008-c-suite-scope.md) |
| **E2 C-suite home v2**                  | Health strip per department (drill-down to region) with change, cause and EOM/EOQ projection; "Why it changed"; financials vs budget; "Where to focus"; ₪ header on every page | 3, 4, 5        | [executive-home.md](specs/executive-home.md)                                  |
| **E3 Opportunities & Cross-department** | Impact × cost × risk value map per action item; Initiatives tab with milestones, barriers, dependencies and "management needed" rules                                          | 7, 8           | [cross-department.md](specs/cross-department.md)                              |
| **E4 Action Center**                    | Insight → action with owner, route, editable message, Approve/Decline, internal sending in the demo; Waiting on you kept                                                       | 9              | [action-center.md](specs/action-center.md)                                    |
| **E5 Reports**                          | Weekly management report, then board pack; own scope or below; in-app, PDF, editable PPTX                                                                                      | 10             | [reports.md](specs/reports.md)                                                |
| **E6 Market & competitors**             | Real CBS indices, chains' price files, competitors' published results, each with source and date; market signals → insights                                                    | 6              | [market-intelligence.md](specs/market-intelligence.md)                        |
| **E7 Mail agent**                       | Synthetic inbox per C-suite persona; waiting for reply / needs decision with impact, benefit, recommendation; template follow-ups                                              | 11             | [mail-agent.md](specs/mail-agent.md)                                          |
| **MVP** (v1 Phase 7)                    | All scenarios and feedback items on one demo timeline; demo reset; pitch scripts                                                                                               | —              | —                                                                             |
| Then                                    | AI integration (v1 Phase 5); hardening (v1 Phase 8); real email, Slack and messaging channels for production                                                                   | —              | —                                                                             |

## Definition of done (every stage)

1. A feature branch and a PR. CI is green on the PR and on `main` after the squash-merge.
2. Dev deploys `main`. Dev's `/api/health` reports the merged SHA, migrations and seed version.
3. `pnpm smoke --url <dev> --expect-sha <sha>` passes, including this stage's new checks and every earlier check,
   plus a persona sign-in on Dev. e2e runs on Dev (then Dev is reset).
4. STATUS.md, the session handoff and the decisions register are updated.
5. Eran signs off the stage after a demo. **Only then** is Prod (`demo`) promoted (FB-0, D3).
