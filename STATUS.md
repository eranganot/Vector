# STATUS

Structured state lives in [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md). This file is the shipped log and
the place for root-cause records of fixed bugs (what broke, proven cause, what was ruled out, fix).

## Shipped

| Date       | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | PR       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 2026-10-04 | Phase 0 foundation; close-out                                                                                                                                                                                                                                                                                                                                                                                                                                                         | #1, #2   |
| 2026-10-04 | Phase 1 specs; amendment (departments, cross-department scenarios)                                                                                                                                                                                                                                                                                                                                                                                                                    | #3, #4   |
| 2026-10-04 | Phase 2a–2e: schema + audit integrity, domain, commands, detector + scenario engine, auth + thin UI                                                                                                                                                                                                                                                                                                                                                                                   | #5–#9    |
| 2026-10-04 | Priority v2, local priority, opportunity workstream, full scenario catalog (Dev smoke 5/5 on 09f7492)                                                                                                                                                                                                                                                                                                                                                                                 | #10      |
| 2026-10-04 | Phase 2 complete: full synthetic org, live catalog, local v2.1, performance dashboards, dark theme                                                                                                                                                                                                                                                                                                                                                                                    | #11      |
| 2026-10-04 | Error pages, Waiting on you, recall to Legal/Supply Chain, build cache, `is_head` (Dev + CI fixes)                                                                                                                                                                                                                                                                                                                                                                                    | #13–#15  |
| 2026-10-04 | The five Phase 2 known issues; Phase 2 sign-off; Prod (`demo`) at 9cec7c6                                                                                                                                                                                                                                                                                                                                                                                                             | #16      |
| 2026-10-04 | Phase 3: Command Center, unit views, hierarchy, role-routed home, actionable cards, Zod inputs, TtU                                                                                                                                                                                                                                                                                                                                                                                   | #17      |
| 2026-10-04 | Reseed on a rotated `SEED_USER_PASSWORD` (Prod sign-in); also on Prod as `demo` 21733bf                                                                                                                                                                                                                                                                                                                                                                                               | #18      |
| 2026-10-04 | Home is a dashboard for every persona (G-P3a); Risks and Opportunities tabs                                                                                                                                                                                                                                                                                                                                                                                                           | #21      |
| 2026-10-04 | Phase 4 plan; P4b commitments, dependencies, conflicts (schema 0006, commands, seed p4-v1, live monitor)                                                                                                                                                                                                                                                                                                                                                                              | #23, #24 |
| 2026-10-04 | P4c/P4d: Commitments tab, live conflict from the UI, Dependencies card on every home, plans on traces                                                                                                                                                                                                                                                                                                                                                                                 | #25      |
| 2026-10-05 | P4e: approval workflow UX; every lifecycle command in the UI; AZ-2 fix for amendments                                                                                                                                                                                                                                                                                                                                                                                                 | #26      |
| 2026-10-05 | P4f: Actions & outcomes tracker, lessons library, "Last time we did this"                                                                                                                                                                                                                                                                                                                                                                                                             | #27      |
| 2026-10-05 | P4g: scoped audit explorer; audit entity ids always UUIDs on refusal paths                                                                                                                                                                                                                                                                                                                                                                                                            | #28      |
| 2026-10-05 | Phase 4 verified on Dev; gate docs, screens, handoff; actions table layout                                                                                                                                                                                                                                                                                                                                                                                                            | #29      |
| 2026-10-05 | Home: commitments and actions & outcomes (G-P4a); Q1 escalation (migration 0007); Q3 level above moves dates                                                                                                                                                                                                                                                                                                                                                                          | #30      |
| 2026-10-05 | Hebrew and right-to-left with a language switch: every screen, names, seeded and generated text (ADR-007)                                                                                                                                                                                                                                                                                                                                                                             | #31      |
| 2026-10-05 | Phase 4 signed off (G-P4); Prod promoted to Phase 4 (`main` 0ecc8e1 merged into `demo` as e8ff6ab)                                                                                                                                                                                                                                                                                                                                                                                    | —        |
| 2026-10-05 | Prod verified at e8ff6ab: health ok, migrations 8/8, seed p4-v1; smoke 11/11; CEO persona sign-in and home                                                                                                                                                                                                                                                                                                                                                                            | —        |
| 2026-10-05 | Phase 5 (AI intelligence) parked by Eran; no Phase 5 work until he resumes it                                                                                                                                                                                                                                                                                                                                                                                                         | —        |
| 2026-10-06 | Plan v2 adopted (FB-0–FB-12). E0 specs and design: C-suite home and IA v2, health-v2, projection-v1, financials and data v5, ADR-008, cross-department, Action Center, reports, market (sources checked), mail agent; wireframes v2                                                                                                                                                                                                                                                   | #32      |
| 2026-10-06 | E0 design review (G-E0a–f): wireframes v3 (visual-first, reference style), specs updated for cross-department action items, action-driven Action Center, editable report charts, competitor charts                                                                                                                                                                                                                                                                                    | #33      |
| 2026-10-06 | E0 signed off (G-E0); gross margin to 26% (G-E0g). E1a: product name "VECTOR \| Organizational Intelligence" / "VECTOR \| אינטליגנציה ארגונית" on every screen, tab title and sign-in (one source, `src/i18n/brand.ts`)                                                                                                                                                                                                                                                               | #34      |
| 2026-10-06 | E1b: C-suite flag (migration 0008), COO persona (Oren Halevi), CFO and COO read the group (Viewer @ Group, ADR-008), C-suite navigation; seed p4-v2; fix: a read-only grant no longer counts as "working in" a unit for commitment owners                                                                                                                                                                                                                                             | #35      |
| 2026-10-06 | E1c: synthetic data v5 (seed p5-v1, migration 0009): 52 weeks of history and holidays, money lines per region and department with monthly budgets (gross margin 26%), action economics (economics-v0) on every proposed action, 8 cross-department initiatives with milestones and barriers (`initiative.record`, audited), doctor budget check; bulk inserts keep a reset at ~8 s                                                                                                    | #36      |
| 2026-10-06 | E1 verified on Dev (0ad0ea1): smoke 14/14, e2e 29/29 against Dev, demo reset after; gate brief docs/phases/STAGE_E1.md                                                                                                                                                                                                                                                                                                                                                                | #37      |
| 2026-10-07 | E1 signed off (G-E1). E2a: health-v2 and projection-v1 (pure, hand-computed tests), the C-suite home read model (`executiveHome`: department health with 7-day change, causes and EOQ direction; region drill-down; money lines MTD vs budget with EOM/EOQ projections; bridge; month revenue chart; focus; risks, opportunities, outside, inside; rule-based VECTOR insight); money lines now follow the demo clock; org/day indexes (migration 0010, ~650 → ~100 ms)                | #38      |
| 2026-10-07 | E2b: the C-suite home on screen (wireframes v3 screen 1): KPI tiles, organization pulse with dependency and conflict links, region toggle, health bridge, month revenue vs budget with projection and range, today's priorities, risks & opportunities, outside / inside, rule-based VECTOR insight, money vs budget, Waiting on you and Dependencies; department drill-down (`/?unit=`) and VP home with regions or measures; EN/HE; TtU e2e for Dana, Michal, Noa in both languages | #39      |
| 2026-10-07 | E2c: ₪ header on Risks, Opportunities, Commitments and Actions & outcomes (`src/domain/money-headers.ts`, scoped and filtered like the list; the Risks P1 figure equals the home tile); EN/HE; e2e                                                                                                                                                                                                                                                                                    | #40      |
| 2026-10-07 | E2 verified on Dev (209bc25): smoke 16/16, e2e 34/34 against Dev, demo reset after; gate brief docs/phases/STAGE_E2.md                                                                                                                                                                                                                                                                                                                                                                | #41      |
| 2026-10-07 | E2 signed off (G-E2); store labor budgeted at run-rate 15.3% (G-E2a, seed p5-v2). E3a: economics-v1 execution risk (dependencies, conflicts, track record, owner load) at read time; value map and net-value list on Opportunities, response map on Risks; EN/HE                                                                                                                                                                                                                      | #42      |
| 2026-10-07 | E3b: Cross-department tab — initiative-rules-v1 (milestone state, status, M1–M5, who steps in), portfolio rings, progress map, your action items with one button each, deviations, Gantt, on-time delivery, barriers, all-initiatives table; audited commands (milestone complete/move, barrier raise/resolve, reminders; migration 0011, `initiative.update`); EN/HE; e2e                                                                                                            | #43      |
| 2026-10-07 | E3 verified on Dev (ab6ebf1): smoke 17/17, e2e 38/38 against Dev, demo reset after; gate brief docs/phases/STAGE_E3.md                                                                                                                                                                                                                                                                                                                                                                | #44      |
| 2026-10-07 | E3 rule readings approved (G-E3a). E3c (Eran's review): action workflow (owner, step, who it waits on, viewer), Who needs to act and the Action plan on Opportunities/Risks, labelled band filters; Cross-department work items with who/due/next step/blockers, item card with analysis and recommendation, clickable status filters, deviations and Gantt bars; sticky top bar and sidebar; EN/HE                                                                                   | #45      |
| 2026-10-07 | E3c verified on Dev (12a6ba6): smoke 17/17, e2e 40/40 against Dev, demo reset after; gate brief updated                                                                                                                                                                                                                                                                                                                                                                               | #46      |
| 2026-10-07 | E4: Action Center — queue by ₪ × urgency with one button, selected item (who is involved, steps, "When you approve, VECTOR will…", with whom and why, editable action-suggest-v1 message), Approve and send through the lifecycle (held until approvals, in-app only, audited; migration 0012), Decline, event → action plan, ₪ header, Messages for you in Waiting on you; Action plan due/₪ formatting (Eran); EN/HE; e2e                                                           | #47      |
| 2026-10-07 | E4 verified on Dev (4dc66f0): migrations 13/13, smoke 18/18, e2e 43/43 against Dev, demo reset after; gate brief docs/phases/STAGE_E4.md                                                                                                                                                                                                                                                                                                                                              | #48      |
| 2026-10-08 | E4d (Eran's E4 review): event → action plan rebuilt (what each task is, who waits, cost to do / at stake / each week it slips / lost so far, coloured status, next step); Cross-department "How a delay travels between departments" (knock-on-v1 dependency flow with what-if +3/+7/+14 d, days and ₪ per department); EN/HE; e2e                                                                                                                                                    | #49      |
| 2026-10-08 | E4d verified on Dev (8dbf734): smoke 18/18, e2e 46/46 against Dev, demo reset after                                                                                                                                                                                                                                                                                                                                                                                                   | #50      |
| 2026-10-08 | G-E4 recorded. E4e (Eran's review): dates shown as "27 Oct" across Cross-department, Waiting on you and charts; Hebrew table cells keep their padding (root cause below); the department map becomes an ordered relay (step, start date, who acts now, held-up arrows, blockers, legend); EN/HE; e2e                                                                                                                                                                                  | #51      |
| 2026-10-08 | E4e verified on Dev (db3c43e): smoke 18/18, e2e 48/48 against Dev, demo reset after                                                                                                                                                                                                                                                                                                                                                                                                   | —        |
| 2026-10-10 | E5a: reports builder (weekly management template; add, remove, reorder, edit charts by type, period, scope), report-v1 model, report data from the screens' read models, immutable versioned snapshots with hash and audit (migration 0013, `report.generate`), snapshot page with print view; EN/HE; smoke phase 9; e2e                                                                                                                                                              | #52      |

## Root-cause records

### 2026-10-08 · Hebrew: the due date touched the next-step text in the Cross-department list

- **What happened:** in Hebrew, "10-27" ran into "להחליט על ההמלצה" with no space (Eran's screenshot).
- **Root cause (proven by measuring the cell in the browser):** the cell had the `num` class, which sets
  `direction: ltr`. In a right-to-left table that moved the cell's `padding-inline-end` (12px) to its right side, away
  from the next column on its left: computed `direction: ltr`, `padding-right: 12px`, `padding-left: 0px`, gap 0.
  The date itself was also the raw ISO month-day.
- **Ruled out:** a missing column gap in the table markup (the English layout has the same classes and is fine); the
  translation (the date was not translated text).
- **Fix:** table cells with `num` keep the page's direction (`unicode-bidi: plaintext` keeps numbers in order); after
  the fix the cell measures `direction: rtl`, `padding-left: 12px`. Dates go through one helper (`day(t, …)`: "27 Oct"
  / "27 אוק׳"), the due column does not wrap, and an e2e checks the Hebrew cell.

### 2026-10-07 · Unit names in the Action plan "Owner" column stayed English in Hebrew

- **What happened:** on Opportunities in Hebrew, the owner's department ("Store Operations") showed in English though
  `he-content.ts` translates it.
- **Root cause (proven by reading `localize`):** the localize walker skips fields named `unit` (`SKIP` in
  `src/i18n/content.ts`, meant for KPI units such as "ILS"). The action workflow put the department name in
  `owner.unit`, and initiatives put names in `waitingOn[].unit` / `waitedOnBy[].unit`.
- **Ruled out:** a missing translation (the key exists), the client cache (server-rendered on each request).
- **Fix:** those fields are now `unitName` (also the Action Center's event tasks).

### 2026-10-07 · Action Center: switching items kept the previous item's recipient and message (found by e2e before merge)

- **What happened:** after selecting another queue item, the To select still showed the first item's person.
- **Root cause (proven by the e2e trace):** the fields are uncontrolled (`defaultValue`) and client navigation reused
  the same form element, so React kept the old values.
- **Fix:** the forms are keyed by the item id.

### 2026-10-07 · PR #45 was merged before its CI `verify` run finished (process lapse, no broken code)

- **What happened:** the merge step ran while `verify` on f966d19 was still in progress. CI later passed on both the
  PR head and the merge commit (12a6ba6), and Dev smoke and e2e (40/40) passed, so nothing broken shipped.
- **Root cause (proven from the command output):** the wait loop gave up after 55 × 10 s (about 9 minutes) and the
  script went on to merge, because it only stopped on a reported `failure`, not on "still running". `verify` now
  takes longer than 9 minutes since the e2e suite grew to 40 tests.
- **Ruled out:** a CI failure (both runs green), branch protection (not configured, so GitHub accepted the merge).
- **Fix:** the wait script now exits non-zero unless every check run completed with success, waits up to 20 minutes,
  and the merge only runs on exit 0.

### 2026-10-07 · CI `verify` failed on PR #40 at d6c8d44 (`format:check`, STATUS.md)

- **Root cause (proven):** the STATUS.md row for E2c was added by a script after `pnpm format` had run, so the
  table's column padding was not re-aligned. `pnpm format:check` locally reports exactly `STATUS.md`.
- **Ruled out:** code changes (lint, typecheck and tests passed in the same run); other docs (only STATUS.md flagged).
- **Fix:** run the formatter after the last doc edit; check `pnpm format:check` immediately before committing.

### 2026-10-06 · A read-only grant let someone own another department's commitment (caught by a test while building E1b)

- **Symptom:** after giving the CFO Viewer @ Group (ADR-008), the integration test "the owner must work in the owning
  unit" failed: recording a Marketing commitment owned by Michal (CFO) succeeded instead of being refused.
- **Proven cause:** `recordCommitment` checked that the owner holds _any_ role whose unit contains the owning unit.
  Viewer @ Group contains every unit, so a read-only grant counted as "working in" Marketing. Proven by the failing test
  (run before and after the fix) and by her role rows in the test database (department_manager @ D-FIN, viewer @ GROUP).
- **Ruled out:** authorization of the recorder (Dana may record anywhere; the refusal is about the owner); the other
  role-assignment checks. A search of every role-assignment query found that the others either go through
  `authorize()`, which filters by permission, or select a specific role (`holderOf`, approval rules).
- **Why silent:** until ADR-008, no one held a read-only role above a department, so "any role" and "a role that can
  act" were the same set.
- **Fix:** only roles with `commitment.update` count (`canKeep` in `src/application/commands/commitments.ts`).
  Two tests now ask for Finance's own view, because the CFO's default scope is the group by design
  (integration `phase4.test.ts`; e2e "dependencies on every home"). The new `tests/integration/c-suite.test.ts`
  covers the ADR-008 matrix.

### 2026-10-05 · CI `verify` failed on `main` at 0776804 (ship-rules commit to CLAUDE.md)

- **Symptom:** run 37279180356 on `main` failed at `pnpm format:check`; every later step was skipped. Dev still deployed
  0776804 (Railway does not wait for CI on Dev), so the failure was silent there.
- **Proven cause:** the new "Ship rules" section in `CLAUDE.md` had no blank line after its heading and no final newline;
  `prettier --check CLAUDE.md` failed locally and passes after `prettier --write` (the only change).
- **Ruled out:** the 165 files a Windows checkout flags locally: CRLF line endings from `core.autocrlf=true` only
  (`prettier --check --end-of-line auto .` passes; CI on Linux passed them at d91c9f9).
- **Why silent:** the commit was made without running the repo checks (docs only, assumed safe).
- **Fix:** formatted in 0ecc8e1 (CI green). Lesson: run `pnpm format:check` (with `--end-of-line auto` on Windows) before
  every commit, docs included.

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
