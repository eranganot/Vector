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

### 2026-10-04 · Two insight pages returned "This page couldn't load" (reported by Eran on Dev)

- **Symptom:** the Tel Aviv Dizengoff shrinkage spike (P3·49) and the South heatwave (O1·64) traces showed a server error for
  every persona; the other 17 rendered.
- **Evidence:** a crawl of every trace on Dev as 7 personas reproduced exactly these two (500). Dev logs:
  `TypeError: a.flatMap is not a function` during render. In the database, the only evidence payloads with a non-array
  `days` field are those two insights' source records: `{"days": 5}` (shrinkage: five days) and `{"days": 4}` (heatwave).
- **Ruled out:** missing or out-of-scope data (the same pages failed for the CEO, who sees everything; 404s are distinct);
  local-priority computation (it fails for group-level viewers too, who get none); the opportunity breakdown (other
  opportunities render).
- **Root cause:** the trace page drew a chart whenever an evidence payload had a truthy `days` (`p.days ? <EvidenceChart…>`),
  so a source record whose facts include a count named `days` was passed to the chart as a series; `LineChart` called
  `days.flatMap`.
- **Why silent:** the e2e suite opened only the Haifa trace; no test rendered every trace. Type checks passed because
  evidence payloads are untyped JSON.
- **Fix:** draw a chart only for `kind === "kpi_series"` with an array; regression e2e test renders every trace for the CEO
  and the board observer.

### 2026-10-04 · Approvals tab empty for most people while their traces offered Accept/Decline (reported by Eran)

- **Evidence:** on Dev, 8 of 10 personas had an empty Approvals tab while their trace pages showed Accept/Decline on 2–13
  insights each (e.g. Shira 13, Ronit 10, Michal 10). A probe of `acceptDecision` as Shira on the Haifa insight was refused
  (`AZ-1 … outside your scope`).
- **Root causes:** (1) the inbox (`listMyApprovals`) listed only approval _requests_; recommendations waiting for a
  _decision_ had no inbox at all, although the IA spec promised "decisions waiting on you"; (2) the trace page showed
  Accept/Decline whenever a decision was `recommended`, with no permission check, so people saw buttons the backend refuses.
- **Ruled out:** expired approvals (none had expired on Dev: requests were < 72 h old); eligibility errors (Yossi and Omer
  saw exactly their eligible requests).
- **Why silent:** the e2e "viewers get no decision buttons" test opened an insight that was already decided, so the
  button was absent for everyone and the test passed vacuously.
- **Fix:** the page is now **Waiting on you**: decisions to make (the manager of the insight's primary unit), approvals to
  give, and your own actions in flight with who they wait on; Accept/Decline only for people who may decide (others see
  who decides); the e2e test now uses an open recommendation.

### 2026-10-04 · Prod environment settings would not run the app (review of Eran's Railway screenshots)

- **Evidence:** `parseConfig({VECTOR_ENV: "Prod"})` throws (`expected one of local|test|dev|demo`), so the app would fail on
  start; `betterAuth({baseURL: "vector-prod.up.railway.app"})` throws `Invalid base URL` (with `https://` it answers 200).
  Prod's live health showed `env=dev`, commit 71e78fc: the staged changes were not yet applied.
- **Fix:** `VECTOR_ENV` accepts `prod` case-insensitively (reaches Prod when `demo` moves); `BETTER_AUTH_URL` needs
  `https://` (Eran's change in Railway).

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
