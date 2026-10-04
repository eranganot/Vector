# VECTOR execution plan (summary)

The full approved plan, with diagrams, lives in the Claude doc **"VECTOR — Execution Plan v1"** (approved
2026-10-04; all decisions are recorded in [DECISIONS.md](DECISIONS.md)). This file is the in-repo summary
that sessions work from. If the two disagree, ask Eran; do not silently pick one.

## Phases

| Phase                       | Outcome                                                                                                                                                                                                                                                                                          | Gate (Eran)                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| 0 Foundation                | Deployable, tested, documented shell on Dev                                                                                                                                                                                                                                                      | Phase sign-off                            |
| 1 Product & architecture    | Domain model + state diagrams, role/approval policy, priority model v1 (calibrated on 10 scenarios), threat model, IA + wireframes, synthetic data plan, demo narrative; ADR-003..005                                                                                                            | Specs approved                            |
| 2 Core VECTOR chain         | KPI anomaly travels Signal → Outcome deterministically: commands with authorization, approval and transactional audit; priority engine; simulated executors; outcome evaluator; scenario engine + demo clock; thin UI (login + persona switcher, insight trace, approvals inbox, audit explorer) | Sign-off + first promotion to demo        |
| 3 Organizational experience | 60 branches / 5 regions / 8 departments synthetic org; Command Center, Department, Region/Branch views; "Why am I seeing this?"; Time-to-Understanding test                                                                                                                                      | Visual direction, then sign-off           |
| 4 Operational intelligence  | Commitments, dependencies, conflicting decisions; approval workflow UX; action + outcome tracking with lessons                                                                                                                                                                                   | Sign-off                                  |
| 5 AI intelligence           | Governed AI gateway (provider decided at gate: Claude or Gemini), evidence-cited narratives, briefing, commitment extraction, scoped Q&A, eval harness, record-and-replay                                                                                                                        | Provider, key, spend cap, eval thresholds |
| 6 External intelligence     | Open-Meteo forecast → signal → insight → action → outcome → audit                                                                                                                                                                                                                                | Confirm source                            |
| 7 End-to-end MVP            | Five charter scenarios on one demo timeline; demo reset; pitch scripts                                                                                                                                                                                                                           | MVP sign-off                              |
| 8 Hardening                 | Sentry, rate limits, security review, backups + restore drill, runbooks                                                                                                                                                                                                                          | Production architecture                   |

## Definition of done (every phase)

Tests pass in CI; phase smoke checks added to `scripts/smoke.ts` and run against Dev; earlier smoke checks
still pass; handoff and decisions updated; Eran signs off after a demo.

## Phase 0 acceptance

- [ ] Fresh clone runs with the README's four commands
- [ ] First PR's CI is green
- [ ] Dev `/api/health` returns 200 with the merged commit's SHA and DB ok
- [ ] `pnpm run doctor` passes locally and against Dev
- [ ] gitleaks finds nothing
