# Session handoff

_Last updated: 2026-10-04 (evening)_

## Current phase

Phase 2 — Core VECTOR chain: **built, awaiting Eran's Phase 2 gate** and the first promotion to the demo environment.
Phase 1 approved 2026-10-04 (G1, G1-a amendment, G1-b/G1-c scenario review). Phase 2 scope extended by Eran on
2026-10-04 (G2): dark mode, performance dashboards by position, every catalog risk and opportunity live, specs up to date.

## Objective

Close Phase 2: the chain Signal → Insight → Decision → Action → Outcome runs end to end with authorization, approvals and
a hash-chained audit, on a realistic synthetic organization, with both workstreams and position-specific dashboards.

## Completed

- Phase 2a–2e (PRs #5–#9): schema + audit integrity, domain core, commands + audit, detector + scenario engine, auth +
  persona switcher + thin UI.
- PR #10: priority-v2 (compliance), local priority, opportunity-v1, separate workstreams (ADR-006), full scenario catalog.
- PR #11 (`feat/phase2-complete`):
  - R11 decision: priority-v2.1-local (cost overrun vs its budget line); local priority raise-only (G2-a, proposed).
  - Synthetic org `p2-v2`: 5 regions × 12 branches, 8 departments, 18 personas, 16 KPIs, planted background conditions.
  - All 14 risks + 5 opportunities live (R8 from the detector, 18 from `src/infra/seed/catalog.ts`); R1, R3, O1 start
    with approvals waiting on Dana, Yossi and Omer.
  - `/performance` dashboards by position (group, region, branch, department); dark theme with a sidebar shell.
  - Migration 0004 (kpi level/target, insight owner department); health reports the demo seed; smoke + doctor extended
    (doctor verifies every epoch's audit chain and the active epoch).
  - Authorization §5 cases 5.3, 5.5, 5.6 now tested; all 8 covered.
  - Every doc in `docs/` and `README.md` brought in line with the code; new `docs/specs/performance-dashboards.md`;
    built screens in `docs/specs/screens/`.

## Verified (by running)

- Local, on the PR #11 branch: typecheck, lint, format; 426 unit tests; 37 integration tests (`vector_test`); 5 e2e tests
  against a local build; `pnpm run doctor` (all checks incl. audit chains); `pnpm smoke` (7 checks); calibration (all three
  models in band).
- Dev after merging PR #11 (`03133a1`): Railway deployed, migration 0004 applied, new `p2-v2` epoch seeded on boot; `pnpm smoke --expect-sha` 7/7; `pnpm test:e2e` 5/5 against Dev; `pnpm run doctor --url` passes; Dev demo reset afterwards so it opens fresh.
- Branch `demo` created at `03133a1` for the demo environment (not connected yet; runbook: docs/runbooks/prod-environment.md).

## Failed / broken

- (none open). Fixed in PR #11 with a recorded root cause: integration tests wrote forged audit rows into the dev database
  (STATUS.md).

## Evening 2026-10-04 (PR #13)

- Fixed (root causes in STATUS.md): two trace pages crashed on a source record's `days` count; the inbox listed only
  approval requests (now "Waiting on you": decisions, approvals, your actions) and Accept/Decline showed for people who
  may not decide.
- G3: the recall's work sits with Legal (Dafna) and Supply Chain (Ben), approvals inside Legal, the CEO is briefed; approval
  policy v2 and inbox routing (G3-a, proposed). Seed `p2-v3` (20 personas).
- Prod environment (Eran, duplicate of Dev, deploys `demo`): needs `BETTER_AUTH_URL` with `https://`, `VECTOR_ENV`
  `prod` (after `demo` moves) or `demo` (before), new secrets, "Wait for CI", then deploy. Runbook:
  docs/runbooks/prod-environment.md.

## Open decisions (for Eran)

- Phase 2 gate sign-off and promotion to the demo environment (needs Eran to create the environment once: docs/runbooks/prod-environment.md).
- G2-a: local priority raise-only (proposed by Claude).
- D1-n: Postgres "16 or later" wording (16 in the sandbox, 18 on CI/Railway).
- AI provider (Claude vs Gemini) at the Phase 5 gate.

## Known issues from the Phase 2 gate: all five fixed (Eran: "fix them all before the next phase")

Each was reproduced by a failing integration test first, then fixed (root causes in STATUS.md): (1) approval lapse now
audits the action's move back and re-requests as `system:policy`; (2) the approval policy is re-run at execution (A7b);
(3) AZ-3 checks the session's real age on every write; (4) the trace resolves only the people its record references;
(5) an unknown action type is an audited domain refusal. Found on the way: trace evidence order was nondeterministic
(fixed). An invariant test now checks that every action's last audited state is its current state.

## Known limitations / deliberate deferrals

- Railway deprecates `railway.toml` (Config as Code) in favour of `.railway/railway.ts` (Infrastructure as Code); `railway.toml` keeps working until 2026-12-01. Migrate before then (`railway config migrate` dry-run output is ready); treat as an infrastructure change.
- Railway runs Postgres 18; CI and Compose use 18; Claude's sandbox uses native 16 (no feature differences relied on).

- The cloud workspace cannot reach Docker container ports, so Claude's local loop uses native Postgres 16;
  the README path (Docker Compose) is exercised by Eran's machine and CI uses a Postgres service.

## Next recommended action

After the Phase 2 gate: promote to the demo environment (gate brief), then Phase 3 (unit views `/units/[id]`, Command
Center polish, Time-to-Understanding test) and the open issues above.

## Reproducible commands

See README "Commands". Deploy check: `pnpm smoke --url <dev url> --expect-sha <sha>`.

## Environment

- GitHub: eranganot/Vector, default branch `main`
- Railway: project "Vector" (81d7e2a7-902c-4162-be63-d3c2b52b8fd7), environment "Dev"; services `Vector` (web, deploys `main`) and `Postgres`; public URL https://vector-dev-46ab.up.railway.app
- Dev variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `VECTOR_ENV=dev`, `LOG_LEVEL=info`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, `DEMO_PERSONAS=on`, `DEMO_CONTROLS=on`, `SEED_USER_PASSWORD`, `APP_DB_PASSWORD`, `APP_DATABASE_URL`
  (composed from Postgres references with the `vector_app` role)
- Start command (`start:railway`): migrate → app role → `demo:reset --if-empty` (reseeds when the seed version changes) → start

## Lessons

- 2026-10-04: a merge is not done until the push-to-`main` CI run is green, not only the PR run (#28/#30 were missed).
- 2026-10-04: never pick "the first row" for a person; a unit can have several managers (`is_head`).

- 2026-10-04: integration tests must never share a database with anything a person or `doctor` relies on: they forge audit
  rows on purpose. The helper now refuses non-test databases; CI creates `vector_test`.
- 2026-10-04: `railway add --database postgres` printed "Project not found" yet created the database (twice). A CLI error is not proof of a no-op: after any Railway mutation, re-read state (`railway status --json`) before retrying.
