# STATUS

Structured state lives in [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md). This file is the shipped log and
the place for root-cause records of fixed bugs (what broke, proven cause, what was ruled out, fix).

## Shipped

| Date       | What                                                                                                  | PR     |
| ---------- | ----------------------------------------------------------------------------------------------------- | ------ |
| 2026-10-04 | Phase 0 foundation; close-out                                                                         | #1, #2 |
| 2026-10-04 | Phase 1 specs; amendment (departments, cross-department scenarios)                                    | #3, #4 |
| 2026-10-04 | Phase 2a–2e: schema + audit integrity, domain, commands, detector + scenario engine, auth + thin UI   | #5–#9  |
| 2026-10-04 | Priority v2, local priority, opportunity workstream, full scenario catalog (Dev smoke 5/5 on 09f7492) | #10    |
| 2026-10-04 | Phase 2 complete: full synthetic org, live catalog, local v2.1, performance dashboards, dark theme    | #11    |

## Root-cause records

### 2026-10-04 · `doctor` reported broken audit chains in the local dev database (caught before shipping, PR #11)

- **Symptom:** the new `doctor` audit check failed: 6 of 38 local organization epochs broke at seq #1 or #26.
- **Proven cause:** every broken row was written by an integration test on purpose: `approval.granted` by actor `mallory`,
  request `forged` (the tamper-detection test, #26), and `test.row` by `system:test` (the append-only test, #1). Query
  output matched all six. The tests ran against the dev database because `tests/integration/helpers.ts` used
  `DATABASE_URL`, and the dev `.env` was loaded. CI had the same shape: integration tests and the final `doctor` share the
  `vector` database, so the new check would have failed CI.
- **Ruled out:** a hashing or canonicalisation fault in the catalog's writes (the active epoch and every epoch without a
  test row verified end to end: 90 events); jsonb drift (same).
- **Fix:** the helper uses `TEST_DATABASE_URL` and refuses any database whose name lacks "test"; CI creates `vector_test`
  and sets `TEST_DATABASE_URL`; local dev database recreated. Verified: the guard refuses `vector`, the suite passes on
  `vector_test`, doctor passes.
- **Blast radius / why silent:** local and CI databases only; never Dev or demo (integration tests don't run there).
  Silent because nothing verified chains outside the tests until `doctor` gained the check.

### 2026-10-04 · Audit chain verification failed on every chain (caught before shipping, P2c)

- **Symptom:** `verifyAuditChain` reported every org's chain broken at seq 1 in the first end-to-end integration run.
- **Proven cause:** the verifier recomputed hashes from the full DB row (`{...row}`), which includes `id`, `hash`,
  `prev_hash` and `recorded_at`; the writer hashes only the 18 audit fields. Probe output showed `prevHash` links intact
  and the extra keys in the hashed payload.
- **Ruled out:** broken `prev_hash` linkage (probe: linkage ok on every row); jsonb round-trip drift of `changes`/`policy`
  (chains verify end to end once only the hashed fields are compared).
- **Fix:** `hashedFields` picks the hashed fields explicitly; regression test `src/application/audit.test.ts`.
- **Blast radius / why silent:** verifier only; stored hashes were always correct. No chain had been verified before this test.
