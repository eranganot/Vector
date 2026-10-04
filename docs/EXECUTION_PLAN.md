# VECTOR execution plan (summary)

The full approved plan, with diagrams, lives in the Claude doc **"VECTOR — Execution Plan v1"** (approved
2026-10-04; all decisions are recorded in [DECISIONS.md](DECISIONS.md)). This file is the in-repo summary
that sessions work from. If the two disagree, ask Eran; do not silently pick one.

## Phases

| Phase                       | Outcome                                                                                                                                                                                                                                                                                          | Gate (Eran)                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| 0 Foundation                | Deployable, tested, documented shell on Dev                                                                                                                                                                                                                                                      | Phase sign-off                            |
| 1 Product & architecture    | Domain model + state diagrams, role/approval policy, priority model (v1 on 10 scenarios → v2 with compliance, local priority and opportunity-v1 on 14 risks + 5 opportunities after review), threat model, IA + wireframes, synthetic data plan, demo narrative, scenario catalog; ADR-003..006  | Specs approved                            |
| 2 Core VECTOR chain         | KPI anomaly travels Signal → Outcome deterministically: commands with authorization, approval and transactional audit; priority engine; simulated executors; outcome evaluator; scenario engine + demo clock; thin UI (login + persona switcher, insight trace, approvals inbox, audit explorer) | Sign-off + first promotion to demo        |
| 3 Organizational experience | 60 branches / 5 regions / 8 departments synthetic org; Command Center, Department, Region/Branch views with separate risk and opportunity lanes and local priority (ADR-006); "Why am I seeing this?"; Time-to-Understanding test                                                                | Visual direction, then sign-off           |
| 4 Operational intelligence  | Commitments, dependencies, conflicting decisions; approval workflow UX; action + outcome tracking with lessons                                                                                                                                                                                   | Sign-off                                  |
| 5 AI intelligence           | Governed AI gateway (provider decided at gate: Claude or Gemini), evidence-cited narratives, briefing, commitment extraction, scoped Q&A, eval harness, record-and-replay                                                                                                                        | Provider, key, spend cap, eval thresholds |
| 6 External intelligence     | Open-Meteo forecast → opportunity (O1 heatwave) and risk signals → action → outcome → audit                                                                                                                                                                                                      | Confirm source                            |
| 7 End-to-end MVP            | Five charter scenarios on one demo timeline; demo reset; pitch scripts                                                                                                                                                                                                                           | MVP sign-off                              |
| 8 Hardening                 | Sentry, rate limits, security review, backups + restore drill, runbooks                                                                                                                                                                                                                          | Production architecture                   |

## Status (2026-10-04)

| Phase                       | Status                                                                                                                                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Foundation                | Signed off by Eran                                                                                                                                                                                                                                   |
| 1 Product & architecture    | Approved by Eran, with amendments: 5 more departments and cross-department scenarios (G1-a), the scenario and priority review (G1-b, G1-c)                                                                                                           |
| 2 Core VECTOR chain         | **Signed off by Eran** (G-P2) and promoted to Prod (`demo` branch); the five known issues from the gate fixed before Phase 3 (PR #16)                                                                                                                |
| 3 Organizational experience | Built (docs/phases/PHASE_3.md): Command Center, unit views `/units/[id]`, hierarchy, role-routed home, actionable cards, Zod inputs, Time-to-Understanding check. **Signed off by Eran** (G-P3, with the G-P3a home dashboards) and promoted to Prod |
| 4 Operational intelligence  | Built and verified on Dev (docs/phases/PHASE_4.md): commitments, dependencies, live conflicts, approval workflow UX, action and outcome tracking with lessons, scoped audit explorer. **Awaiting Eran's Phase 4 gate** (Q1–Q5)                       |

## Definition of done (every phase)

Tests pass in CI; phase smoke checks added to `scripts/smoke.ts` and run against Dev; earlier smoke checks
still pass; handoff and decisions updated; Eran signs off after a demo.

## Phase 0 acceptance

- [x] Fresh clone runs with the README's four commands
- [x] First PR's CI is green
- [x] Dev `/api/health` returns 200 with the merged commit's SHA and DB ok
- [x] `pnpm run doctor` passes locally and against Dev
- [x] gitleaks finds nothing
