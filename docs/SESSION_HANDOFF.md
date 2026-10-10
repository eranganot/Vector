# Session handoff

_Last updated: 2026-10-10 (E5a)_

## Current phase

**Plan v2, stage E7 (mail agent / Inbox): built, awaiting Eran's review (G-E7).** E7 #59. E6 is built (#56–#58, ₪
assumptions kept, G-E6e); Eran said "continue to E7" without asking for a Prod promotion, so **Prod is still on E5**
(`demo` 3d68c7f). Ask before promoting.

- Refresh market data: `pnpm market:fetch` from Claude's workspace, commit the new `data/market/snapshot-<day>.json`.

## Objective (E0, done)

Approve the design before E1 code: docs/phases/STAGE_E0.md lists what Eran confirms (ADR-008 mechanism, health-v2
weights, projection-v1 terms, department money lines, M1–M5 rules, wireframes v2).

## Open decisions (for Eran)

- AI provider still open for the AI-integration stage (D-AI).

## Known limitations / deliberate deferrals

- Railway deprecates `railway.toml` in favour of `.railway/railway.ts`; `railway.toml` keeps working until 2026-12-01. Migrate before then; treat as an infrastructure change.
- This cloud session cannot reach Railway's API and holds no Railway token: deploys are verified from outside (health SHA, migrations, seed version, smoke, persona sign-in, e2e on Dev).
- Market price files exist for one day (2026-10-10): MK1/MK4 and the per-chain basket lines need daily snapshots.
- Audit explorer and commitment read models filter in the application layer (fine at demo scale).
- `tests/integration/lifecycle.test.ts` "§5.2" depends on the tests before it in its file.

## Next recommended action

1. Eran reviews E7 (G-E7, docs/phases/STAGE_E7.md); ask whether to promote Prod (to E6 or E7).
2. Next stage after sign-off: the end-to-end MVP (v1 Phase 7).

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

- The local `vector_test` database only grows (integration tests never delete; a new epoch per run). At 27 GB it filled the
  workspace disk ("No space left on device" in every integration file). It is disposable: `drop database vector_test`
  and recreate it (owner `vector`).

- 2026-10-04: public smoke and doctor never sign in; verifying an environment includes one persona sign-in.
- 2026-10-04: rotating `SEED_USER_PASSWORD` now reseeds on the next boot (`reseedReason`); before #18 it did not.
- 2026-10-04: chain doc edits and commits with `set -e` (or `&&`); a failed edit script must stop the commit.

- 2026-10-04: a merge is not done until the push-to-`main` CI run is green, not only the PR run (#28/#30 were missed).
- 2026-10-04: never pick "the first row" for a person; a unit can have several managers (`is_head`).

- 2026-10-04: integration tests must never share a database with anything a person or `doctor` relies on: they forge audit
  rows on purpose. The helper now refuses non-test databases; CI creates `vector_test`.
- 2026-10-04: `railway add --database postgres` printed "Project not found" yet created the database (twice). A CLI error is not proof of a no-op: after any Railway mutation, re-read state (`railway status --json`) before retrying.
