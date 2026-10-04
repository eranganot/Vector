# Test strategy

Status: **Approved (Phase 1, 2026-10-04); updated for Phase 2 as built.** Charter §38–39: important transitions have
explicit tests; AI has evaluation criteria; nothing is done until it has been run.

| Layer                   | Tool                   | What it proves                                                                                                                                                                                                                                                                                               | Runs                               |
| ----------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Domain unit             | Vitest                 | State machines, guards, policy, priority, calendar, clock, audit hashing: pure functions, no DB (`src/**/*.test.ts`)                                                                                                                                                                                         | every PR                           |
| Table-driven spec tests | Vitest                 | **Every row** of the transition tables (domain-model.md §4) and every cell of the permission matrix (authorization.md §2) is a test case, plus every unlisted transition is rejected                                                                                                                         | every PR                           |
| Golden fixtures         | Vitest                 | All risk (`priority-v2`), local (`priority-v2.1-local`) and opportunity (`opportunity-v1`) scenarios in `docs/specs/priority-scenarios.json` keep their bands; the seeded generator and the detector on it stay deterministic; the catalog covers every scenario and references only seeded units and people | every PR                           |
| Integration             | Vitest + real Postgres | Commands: authorization + transition + audit in one transaction; DB grants and triggers; scoped queries; the demo scenario engine                                                                                                                                                                            | every PR                           |
| End to end              | Playwright             | The Phase 2 story through the UI with real personas; out-of-scope 404; both workstreams and the dashboards; screenshots for visual regression (P3+)                                                                                                                                                          | every PR (CI runs the full suite)  |
| Smoke                   | `pnpm smoke`           | The deployed environment works; later phases chain earlier checks                                                                                                                                                                                                                                            | after every deploy                 |
| Diagnostics             | `pnpm run doctor`      | Env, deps, DB, migrations, every epoch's audit hash chain, the active demo epoch (60 branches, 8 departments, ≥19 insights), optional deployed health                                                                                                                                                        | locally, in CI, and against Dev    |
| AI evaluation           | eval harness           | Groundedness, scope, injection resistance (ai-governance.md)                                                                                                                                                                                                                                                 | on demand + before promotion (P5+) |
| Demo validation         | rehearsal checklist    | The scripted story runs cleanly 3× in a row on `demo`                                                                                                                                                                                                                                                        | before sign-off (P7)               |

At the end of Phase 2: 426 unit tests in 12 files, 37 integration tests in 4 files, 5 end-to-end tests in 2 files.

Integration tests need a database of their own: they use `TEST_DATABASE_URL` when set and refuse a database whose
name lacks "test" (CI creates `vector_test` for them), because the tamper-detection tests insert forged audit rows on purpose. They migrate
the database, create the `vector_app` role and run the commands as that restricted role. The end-to-end tests need a
freshly reset demo (`pnpm demo:reset`) and `DEMO_PERSONAS=on`; they start the built app unless `BASE_URL` is set.

## Mandatory negative tests (Phase 2)

- Each "approval is never inferred" case (authorization.md §5): done, all eight.
- Self-approval, admin approval and system-actor approval are refused: done.
- Out-of-scope read returns 404 (done, e2e); out-of-scope write is refused and audited (done: ineligible managers,
  every denied attempt on the audit record).
- `UPDATE`/`DELETE`/`TRUNCATE` on `audit_event` fail for the app role and the owner; a forged row breaks chain
  verification: done.
- Executing after approval lapse, or without an approval, is blocked: done. Executing after params changed is
  blocked by withdrawal and the revision check (unit-tested guard; the integration test covers the withdrawal).

Not covered yet: a stale or expired session cannot write (P3), the persona switcher is absent with the flag off (P3),
the human commands without UI (`dismissInsight`, `cancelAction`, `retryAction`) at integration level (P3, with their UI).

## Regression rule

A PR may change previously accepted behavior only with an approved decision recorded in `docs/DECISIONS.md`. Such a PR
updates the affected tests in the same change and says so in its description.
