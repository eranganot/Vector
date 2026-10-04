# Session handoff

_Last updated: 2026-10-04 (night)_

## Current phase

Phase 3, Organizational Intelligence Experience: **built and verified locally, PR #17**. Awaiting Dev verification and
**Eran's Phase 3 gate**. Phase 2 was signed off (G-P2). The five known issues were fixed (PR #16), and Prod's `demo` branch
is at 9cec7c6 (P3-go).

## Objective

Make the organization understandable at a glance for each role (docs/phases/PHASE_3.md).

## Completed (Phase 3, branch `feat/phase3`)

- **Executive Command Center** (`/` for Executive, Viewer and Admin):
  - a one-sentence headline;
  - Waiting on you;
  - the top 3 risks and the top 3 opportunities;
  - what changed in the last 24 h (audited events);
  - the biggest KPI moves;
  - health by region;
  - the department pulse.
- **Unit views** `/units/[id]`:
  - one template for the group, a region, a branch and a department;
  - a breadcrumb;
  - KPIs linked to the insights that explain them;
  - lanes ranked by local priority, with one band per item everywhere;
  - actions and their owners;
  - dependencies;
  - child units;
  - recently resolved items.
  - The read model is scope-checked, and a unit outside your scope returns 404.
- **`/org` hierarchy:** the regions expand to show their branches, and each department shows what it owns and what it is involved in. Navigation is Home · Organization · Waiting on you · Audit.
- **Role-routed home:** managers land on their own unit; `/performance` redirects there.
- **Actionable cards:** each card shows the band and score, "Why:" (`explainPriority`), the recommendation, who it is waiting on, and the owner.
- **Zod validation** on every server action (`src/application/inputs.ts`), which also closes the open redirect on the persona switch.
- **Time-to-Understanding:**
  - the protocol;
  - the automated above-the-fold e2e check at 1440×900 for the CEO, a region manager, a branch manager and a VP;
  - a check that any branch is two clicks from home.
- **Fixed on the way** (root causes in STATUS.md):
  - the branch view showed the same item as both P1 and P2;
  - an e2e test read the URL before the redirect landed.

## Verified (by running, locally)

- typecheck, lint, format;
- 444 unit tests;
- 55 integration tests (`vector_test`);
- 14 e2e tests against a local production build after `demo:reset`;
- `pnpm smoke`: 9 checks, including 2 new Phase 3 checks;
- screens captured in `docs/specs/screens/`.

## Failed / broken

- (none open)

## Open decisions (for Eran)

- Phase 3 gate (sign-off, then promotion to Prod).
- Prod settings, as listed under "Next recommended action".
- AI provider (Claude vs Gemini), at the Phase 5 gate.

## Known limitations / deliberate deferrals

- Railway deprecates `railway.toml` (Config as Code) in favour of `.railway/railway.ts` (Infrastructure as Code); `railway.toml` keeps working until 2026-12-01. Migrate before then (`railway config migrate` dry-run output is ready); treat as an infrastructure change.
- Railway runs Postgres 18; CI and Compose use 18; Claude's sandbox uses native 16 (no feature differences relied on).

- The cloud workspace cannot reach Docker container ports, so Claude's local loop uses native Postgres 16;
  the README path (Docker Compose) is exercised by Eran's machine and CI uses a Postgres service.

## Next recommended action

1. Eran: Phase 3 gate (demo on Dev: docs/phases/PHASE_3.md "Demo scenario"), then promote to Prod by moving `demo` to the
   Phase 3 merge commit.
2. Eran: apply the Prod settings still open (`BETTER_AUTH_URL=https://vector-prod.up.railway.app`, new secrets from the
   PowerShell script, "Wait for CI", Apply + Deploy); Claude then runs `pnpm smoke --url … --expect-sha` and `doctor --url`
   against Prod. Prod's health still reported `env=dev` at 9cec7c6, so the staged variables were not applied yet.
3. Run the live Time-to-Understanding protocol with five people (docs/specs/time-to-understanding.md).
4. Phase 4 (Operational intelligence) after the gate.

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
