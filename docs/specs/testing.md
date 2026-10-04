# Test strategy

Status: **Draft for Phase 1 approval**. Charter §38–39: important transitions have explicit tests; AI has
evaluation criteria; nothing is done until it has been run.

| Layer                   | Tool                   | What it proves                                                                                                                                                         | Runs                                           |
| ----------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Domain unit             | Vitest                 | State machines, policy, priority: pure functions, no DB                                                                                                                | every PR                                       |
| Table-driven spec tests | Vitest                 | **Every row** of the transition tables (domain-model.md §4) and the permission matrix (authorization.md §2) is a test case, plus every unlisted transition is rejected | every PR                                       |
| Integration             | Vitest + real Postgres | Commands: authorization + transition + audit in one transaction; DB grants and triggers; scoped queries                                                                | every PR                                       |
| Golden fixtures         | Vitest                 | Priority scenarios S01–S10 keep their scores and bands; seeded generator stays deterministic                                                                           | every PR                                       |
| End to end              | Playwright             | Demo scenarios through the UI with real personas; screenshots for visual regression (P3+)                                                                              | every PR (smoke subset), full before promotion |
| Smoke                   | `pnpm smoke`           | The deployed environment works; later phases chain earlier checks                                                                                                      | after every deploy                             |
| Diagnostics             | `pnpm run doctor`      | Env, DB, migrations, audit chain (P2+), seed integrity                                                                                                                 | locally + against Dev                          |
| AI evaluation           | eval harness           | Groundedness, scope, injection resistance (ai-governance.md)                                                                                                           | on demand + before promotion (P5+)             |
| Demo validation         | rehearsal checklist    | The scripted story runs cleanly 3× in a row on `demo`                                                                                                                  | before sign-off (P7)                           |

## Mandatory negative tests (Phase 2)

- Each "approval is never inferred" case (authorization.md §5).
- Self-approval, admin approval and system-actor approval are refused.
- Out-of-scope read returns 404; out-of-scope write is refused and audited.
- `UPDATE`/`DELETE`/`TRUNCATE` on `audit_event` fail for the app role and the owner; a forged row breaks chain verification.
- Executing after approval lapse, or after params changed, is blocked.

## Regression rule

A PR may change previously accepted behavior only with an approved decision recorded in `docs/DECISIONS.md`. Such a PR
updates the affected tests in the same change and says so in its description.
