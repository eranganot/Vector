@AGENTS.md

# VECTOR — working notes for Claude

Start every session with: `docs/SESSION_HANDOFF.md` → `STATUS.md` → `docs/DECISIONS.md` → CI and deploy state.
Report in five lines before working (session-kickoff skill).

## Ground rules (from the charter and Eran's preferences)

- Eran owns product vision and approval gates (charter §30). Never infer approval. Record approvals in `docs/DECISIONS.md`.
- Bugs: investigate to a PROVEN root cause with evidence before fixing (investigate-issue skill); record root cause + ruled-out causes in `STATUS.md`.
- Nothing is "done" until it has been run: tests, smoke (`pnpm smoke`), and the deployed health check.
- Every phase ends with its smoke checks added to `scripts/smoke.ts`; later phases re-run earlier checks.

## Architecture rules

- `src/domain` is pure TypeScript. No Next, React, pg or Drizzle imports (lint-enforced).
- All state changes to Decision/Action/Approval/Outcome go through named commands in `src/application`, which authorize and write an audit event in the same transaction (from Phase 2).
- UI code never imports the DB (lint-enforced). Backend authorization is mandatory; UI checks are cosmetic.
- Time comes from the injected `Clock` (`src/domain/clock.ts`), never `Date.now()` in the domain.

## Workflow

- Branch `feat/...` → PR → CI green → squash-merge to `main` (D3) → Railway Dev auto-deploys.
- Verify a deploy with `pnpm smoke --url <dev url> --expect-sha <merged sha>`.
- Railway: project "Vector", environment "Dev". The dev-scoped project token is held in the session, never in the repo.

## Sandbox notes (cloud workspace)

- Docker containers have no port networking here; use the native Postgres 16 cluster (`sudo pg_ctlcluster 16 main start`), role/db `vector`/`vector` and `vector_test`.
- Playwright: set `PW_CHROMIUM_PATH` to the preinstalled Chromium under `/opt/pw-browsers` instead of downloading browsers.
