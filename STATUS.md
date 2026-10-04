# STATUS

Structured state lives in [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md). This file is the shipped log and
the place for root-cause records of fixed bugs (what broke, proven cause, what was ruled out, fix).

## Shipped

| Date       | What                                                                                                     | PR       |
| ---------- | -------------------------------------------------------------------------------------------------------- | -------- |
| 2026-10-04 | Phase 0 foundation; close-out                                                                            | #1, #2   |
| 2026-10-04 | Phase 1 specs; amendment (departments, cross-department scenarios)                                       | #3, #4   |
| 2026-10-04 | Phase 2a–2e: schema + audit integrity, domain, commands, detector + scenario engine, auth + thin UI      | #5–#9    |
| 2026-10-04 | Priority v2, local priority, opportunity workstream, full scenario catalog (Dev smoke 5/5 on 09f7492)    | #10      |
| 2026-10-04 | Phase 2 complete: full synthetic org, live catalog, local v2.1, performance dashboards, dark theme       | #11      |
| 2026-10-04 | Error pages, Waiting on you, recall to Legal/Supply Chain, build cache, `is_head` (Dev + CI fixes)       | #13–#15  |
| 2026-10-04 | The five Phase 2 known issues; Phase 2 sign-off; Prod (`demo`) at 9cec7c6                                | #16      |
| 2026-10-04 | Phase 3: Command Center, unit views, hierarchy, role-routed home, actionable cards, Zod inputs, TtU      | #17      |
| 2026-10-04 | Reseed on a rotated `SEED_USER_PASSWORD` (Prod sign-in); also on Prod as `demo` 21733bf                  | #18      |
| 2026-10-04 | Home is a dashboard for every persona (G-P3a); Risks and Opportunities tabs                              | #21      |
| 2026-10-04 | Phase 4 plan; P4b commitments, dependencies, conflicts (schema 0006, commands, seed p4-v1, live monitor) | #23, #24 |
| 2026-10-04 | P4c/P4d: Commitments tab, live conflict from the UI, Dependencies card on every home, plans on traces    | #25      |
| 2026-10-05 | P4e: approval workflow UX; every lifecycle command in the UI; AZ-2 fix for amendments                    | #26      |
| 2026-10-05 | P4f: Actions & outcomes tracker, lessons library, "Last time we did this"                                | #27      |

## Root-cause records

### 2026-10-05 · Whoever amended an action could approve the revision they wrote (AZ-2 gap; found while building Amend, P4e)

- **Symptom:** Yossi amended "Weekend staffing uplift" (₪54k → ₪40k, revision 2); the revision-2 approval request
  was routed to Yossi himself, and the grant command would have accepted his approval.
- **Proven cause:** AZ-2 compares the approver with the action's `proposed_by` and owner. `amendAction` bumped the
  revision but left `proposed_by` at the original proposer (`system:detector`), so the author of the new revision was
  neither "proposer" nor owner. Observed in the database (rev 2 `requested`, `proposed_by = system:detector`) and in
  Yossi's inbox; reproduced by a failing integration test.
- **Why it was silent:** amendments existed only in the application layer (Phase 2) and its tests had the amender
  approve nothing afterwards; Phase 4 put Amend in the UI.
- **Ruled out:** routing alone (the grant command itself accepted him: AZ-2 had nothing to compare); the owner check
  (Shira, the owner, was correctly excluded).
- **Fix:** amending makes the amender the proposer of the new revision (`proposed_by` updated, old and new value in the
  audit event), so AZ-2 excludes them from routing and from granting. Test: `lifecycle.test.ts` "AZ-2: whoever amends";
  e2e "approval workflow".
- **Unrelated, noted:** `lifecycle.test.ts` "§5.2" depends on the earlier tests in its file (fails when run alone, with
  or without this change); the whole file passes.

### 2026-10-04 · The deciding unit could not see the plan its own collides with (caught by a new test before shipping, P4d)

- **Symptom:** in the integration test "an insight's trace shows the plans behind it", Michal (Finance, who decides the
  R7 conflict) saw only Finance's spend freeze, not Marketing's ₪350k campaign it collides with.
- **Proven cause:** a commitment's `visible_unit_ids` covered its owner and beneficiaries (and their ancestors) only.
  Marketing's campaign is owed to Trade & Commercial and Store Operations, not to Finance, so the read filter
  (`canRead`) correctly hid it from Finance. Nothing widened visibility when a conflict paired the two.
- **Ruled out:** the trace query only (it was also building from position-relative lists, fixed too, but the commitment
  was unreadable for Finance at the source); a scope bug in `canRead` (it behaved as specified).
- **Fix:** when a conflict is detected (K1), each side becomes visible to the other side's unit, in the same audited
  transaction; the trace uses every commitment the viewer may read. Test: `tests/integration/phase4.test.ts`.

### 2026-10-04 · Prod: persona sign-in failed ("Persona sign-in failed: check SEED_USER_PASSWORD") after the secrets were rotated

- **Symptom:** on Prod (9cec7c6, `env=prod`) every demo persona returned to `/login` with that error. Smoke (public
  checks) and doctor passed, so the deploy looked healthy.
- **Proven cause:** Prod's database was seeded on its first boot, when its variables were still the copy of Dev. Eran then
  set a new `SEED_USER_PASSWORD`. The boot step `demo:reset --if-empty` reseeded only when the `SEED_VERSION` changed, so the
  seeded people kept Dev's password while the persona switcher signs in with Prod's new one. Evidence: the email/password
  form on Prod signs Dana in **with Dev's seed password** (and on Dev, the control); the switcher on Prod, using Prod's
  value, is rejected.
- **Ruled out:** `BETTER_AUTH_URL` / cookie settings (a form sign-in on Prod succeeds and sets a session); unknown persona
  (the list renders and the error is the sign-in one); database or migrations (health and doctor pass).
- **Fix:** `reseedReason()` (src/infra/seed/reseed.ts): the boot reseed also runs when the seed password no longer
  verifies against the seeded people; a new epoch re-hashes every seeded person's password (old epochs and audit kept).
  Test: `tests/integration/schema-seed.test.ts` "boot-time reseed decision"; script run locally: same password → "not
  reseeding", rotated → "reseeding (SEED_USER_PASSWORD changed…)". CI now also runs on pushes to `demo` so Railway's "Wait
  for CI" has a check to wait for. `pnpm smoke --phase <n>` verifies an environment at the phase it runs.
- **Lesson:** public smoke and doctor do not sign in; a Prod verification must include one persona sign-in.

### 2026-10-04 · A branch manager's unit view showed the same risk as P1 and P2 (caught in Phase 3 screen review)

- **Symptom:** on Avi's home (Haifa Grand Canyon) the risk card read **P1 · 77**, while the summary said "0 P1" and Waiting
  on you showed the same item as **P2**.
- **Proven cause:** the unit view's item cards used the local band (`local?.band ?? i.band`, priority-v2.1-local,
  raise-only), but three other places used the stored group band: `workstreams.risks` counts and `kpiLinks` in
  `performanceView`, and the rows of `WaitingCard` (from `listMyDecisions` / `listMyApprovals`). The Haifa story is P2
  group-wide and P1 for its branch, so both appeared on one screen. Reproduced by the integration test "a unit view uses one
  band per item", which failed with the counts line reverted and passes with the fix.
- **Ruled out:** a scoring difference (both bands are correct for their scope: 77 local, P2 group); stale data from the
  reset (same result after a fresh `demo:reset`).
- **Fix:** local priority is computed before the counts, and `bandOf(i)` is used for counts and KPI links; the unit page
  passes its bands to `WaitingCard`. The Command Center keeps group bands (its scope is the group).

### 2026-10-04 · e2e "a unit outside your scope looks missing" got 200 (test bug, found while writing it)

- **Proven cause:** the test read `page.url()` right after the persona switch, before the redirect to Avi's unit landed,
  so it held `/`; Maya then opened her own home (200). Logged URL: `http://localhost:3100/`.
- **Ruled out:** a scope leak: the read model returns `null` for Avi's branch as Maya (integration test), and the fixed
  test gets 404.
- **Fix:** wait for `/units/` before reading the URL, and assert the two URLs differ.

### 2026-10-04 · The five known issues from the Phase 2 gate (Eran: fix all before Phase 3)

Each was reproduced by an integration test that failed before the fix (`tests/integration/lifecycle.test.ts`, "known issue #n").

1. **Lapse left a hidden transition.** Observed: after a granted approval lapsed, no audit row recorded the action's
   `ready → pending_approval`; the re-request was written as `system:clock`. Cause: `runClockJobs` updated the action without
   `audit()` and audited the request under its own actor. Fix: `action.approval_lapsed` row; re-request by `system:policy`
   (authorized as `action.submit`). Sibling search: every other `update(action)` already audits; a new invariant test checks
   each action's last audited state equals its state. Why silent: no test compared the audit trail with action states.
2. **Policy not re-run at execution.** Observed: a transfer approved under AP-4 executed after its insight escalated to P1
   (AP-5 newly applied). Cause: `executeAction` checked only the approval's validity; A7b had no code. Fix: re-evaluate at
   execution; if rules were added, withdraw the approval (P5b), return the action to `pending_approval` with the new
   requirement, request approval again (all audited by `system:policy`), and report `{ reRequested }` (not counted as
   executed). Ruled out: amend path (it already re-submits). Why silent: actions normally execute right after approval.
3. **AZ-3 check never ran.** Observed with the real auth library: a session is valid at 11h59m and not extended, rejected at
   12h01m, so the rule held only through expiry; commands never passed the session age, so the explicit check was dead.
   Fix: the request carries the session's real-time age into the actor; every write checks it (test: 12.5 h refused, 0.5 h
   allowed). Ruled out: rolling refresh extending sessions (observed: expiry unchanged after use).
4. **Trace read the whole user table.** Observed: a user of another organization appeared in the trace's people. Cause:
   unfiltered `select … from user`. Fix: resolve only the people the insight's record references.
5. **Unknown action type was a crash.** Observed: `acceptDecision` on an action whose type has no playbook threw a plain
   `Error` (a 500) and nothing was audited. Fix: `DomainError("Invalid")`, and `runCommand` audits `Invalid` refusals too.

Found on the way: the trace returned its evidence (and signals) in database order, not the recorded order (an intermittent
integration failure: [availability, sales] instead of [sales, availability]). Fix: keep the insight's stored order. A new test
of mine had the same flaw (`.at(-1)` on unordered audit rows) and now sorts by `seq`.

### 2026-10-04 · CI failed on `main` after PRs #13 and #14 (e2e: Noa's inbox not empty) (reported by Eran)

- **Symptom:** runs #28 (a248652) and #30 (8c7b8de) on `main` failed at "the Haifa story": Noa's Waiting on you showed an
  approval request; the PR runs of the same code had passed, as had local and Dev runs.
- **Evidence:** the CI error context shows Noa asked to approve "Transfer top-category stock Haifa Downtown → Haifa Grand
  Canyon", and her own action list (3 items) does not contain it: in that run the transfer was owned by **Ben**.
- **Root cause:** the detector assigned the transfer with `holderOf()`, which took the first row of an unordered query
  ("seeded org has one each"). PR #13 added a second Supply Chain manager (Ben), so Postgres chose the owner; when it chose
  Ben, Noa became an eligible approver.
- **Ruled out:** approval routing (Noa really is eligible when she isn't the owner); test ordering (the failure is in the
  first assertion about Noa, on a fresh reset).
- **Why silent:** nondeterministic: local, PR and Dev runs happened to return Noa first. And I checked PR CI only, not the
  push-to-`main` run, so #28's failure went unnoticed until Eran saw it.
- **Fix:** `role_assignment.is_head` (migration 0005); one head per unit and role (seed test); the detector assigns work to
  the head and refuses an ambiguous unit; integration test asserts the transfer is Noa's. Seed `p2-v4`. Process: after a
  merge, wait for the `main` run too.

### 2026-10-04 · Dev deploy of a248652 (PR #13) failed at build

- **Symptom:** Railway deployment 30d4a9a3 FAILED; Dev kept serving 71e78fc (no outage).
- **Evidence (WHAT, proven):** build log `Build error occurred [Error: Failed to open database … Loading persistence directory
failed … failed to remove file /app/.next/cache/turbopack/v16.3.8-…/00000105.del: No such file or directory]`. The same
  commit built green in CI (no cache) and locally from a clean `.next`.
- **Ruled out:** a code or compile error (CI and local builds of the same commit succeed; the failure is in cache loading,
  before compilation).
- **WHY (inferred, not observed):** Next 16.3 caches `next build` work on disk by default; Railway restores `.next/cache`
  between builds, and the Prod environment Eran created as a duplicate of Dev builds the same service with the same cache
  around the same time, so a half-written cache was restored.
- **Fix:** `experimental.turbopackFileSystemCacheForBuild: false` in `next.config.ts`; builds no longer read or write a
  shared cache (verified: no `.next/cache` after a local build). Cost: slower cold builds.
- **Why silent:** CI never restores `.next/cache`, so only Railway exercises the cache path.

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
