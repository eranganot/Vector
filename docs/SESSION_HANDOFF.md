# Session handoff

_Last updated: 2026-10-10 (E5a)_

## Current phase

**Plan v2, stage E5 (reports): E5a–E5b built** (builder, weekly management and board pack, snapshots, editable
PowerPoint, PDF from the print view). Next: verify on Dev and write the E5 gate brief. E4 accepted by Eran 2026-10-08 (G-E4); E4e (his review
fixes) verified on Dev db3c43e. Prod (`demo` e8ff6ab) stays on Phase 4 until Eran asks for a promotion.

- E5a #52: reports (report-v1, migration 0013); Dev 0bf6db6 smoke 19/19. E5b #53: board pack, PowerPoint, PDF.
  Spec as built: docs/specs/reports.md §5–§6.
- E4 #47–#51 shipped and verified on Dev.

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

1. Verify E5 on Dev (e2e, decks opened); E5 gate brief docs/phases/STAGE_E5.md; Eran reviews.

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
