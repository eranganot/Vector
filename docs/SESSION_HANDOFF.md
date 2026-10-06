# Session handoff

_Last updated: 2026-10-07 (E2b)_

## Current phase

**Plan v2, stage E2 (C-suite home v2), in progress.** E1 was signed off by Eran 2026-10-06 (G-E1). Prod (`demo`
e8ff6ab) stays on Phase 4 until Eran asks for a promotion.

- E2a #38: health-v2, projection-v1 and the read model `executiveHome` (no UI yet); money lines follow the demo
  clock; migration 0010 (org/day indexes).
- E2b #39: the C-suite home on screen, department drill-down, VP home, EN/HE, TtU e2e (Dana, Michal, Noa).
- E2c #40: ₪ headers on Risks, Opportunities, Commitments, Actions & outcomes.
- Next: the E2 gate (verify on Dev, docs/phases/STAGE_E2.md).

## Objective (E0, done)

Approve the design before E1 code: docs/phases/STAGE_E0.md lists what Eran confirms (ADR-008 mechanism, health-v2
weights, projection-v1 terms, department money lines, M1–M5 rules, wireframes v2).

## Open decisions (for Eran)

- AI provider still open for the AI-integration stage (D-AI).

## Known limitations / deliberate deferrals

- Railway deprecates `railway.toml` in favour of `.railway/railway.ts`; `railway.toml` keeps working until 2026-12-01. Migrate before then; treat as an infrastructure change.
- This cloud session cannot reach Railway's API and holds no Railway token: deploys are verified from outside (health SHA, migrations, seed version, smoke, persona sign-in, e2e on Dev).
- Price-transparency portals of chains other than Shufersal are not yet verified (E6).
- Audit explorer and commitment read models filter in the application layer (fine at demo scale).
- `tests/integration/lifecycle.test.ts` "§5.2" depends on the tests before it in its file.

## Next recommended action

1. Verify E2 on Dev and write docs/phases/STAGE_E2.md for Eran's gate; on sign-off, E3.

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

- 2026-10-04: public smoke and doctor never sign in; verifying an environment includes one persona sign-in.
- 2026-10-04: rotating `SEED_USER_PASSWORD` now reseeds on the next boot (`reseedReason`); before #18 it did not.
- 2026-10-04: chain doc edits and commits with `set -e` (or `&&`); a failed edit script must stop the commit.

- 2026-10-04: a merge is not done until the push-to-`main` CI run is green, not only the PR run (#28/#30 were missed).
- 2026-10-04: never pick "the first row" for a person; a unit can have several managers (`is_head`).

- 2026-10-04: integration tests must never share a database with anything a person or `doctor` relies on: they forge audit
  rows on purpose. The helper now refuses non-test databases; CI creates `vector_test`.
- 2026-10-04: `railway add --database postgres` printed "Project not found" yet created the database (twice). A CLI error is not proof of a no-op: after any Railway mutation, re-read state (`railway status --json`) before retrying.
