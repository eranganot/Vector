# Session handoff

_Last updated: 2026-10-05 (night)_

## Current phase

**Phase 4, Operational Intelligence: built and verified on Dev; awaiting Eran's Phase 4 gate.**

- Phase 3 was signed off (G-P3, 2026-10-04 22:49) and Prod was promoted to it.
- **Prod** (`demo` branch) is at **d5f15db**: the Phase 3 code, identical to `main` at 687dbe0.
- **Dev** (`main`) runs Phase 4. Seed `p4-v1` (20 commitments, 14 dependencies) reseeded on boot.

## Objective

Move from awareness to coordination: commitments, dependencies, conflicts, approvals, action and outcome tracking with
lessons (docs/phases/PHASE_4.md).

## Completed (Phase 4, PRs #23–#28, plus the gate docs)

- **#23** The plan and specs: Commitment, Dependency and Conflict, their state machines (C1–C6, K1–K2) and the new capabilities.
- **#24** Commitments, dependencies and conflicts:
  - migration 0006;
  - audited commands;
  - conflict-rules-v1 and commitment-monitor-v1, live on every clock advance;
  - catalog stories linked to their commitments.
- **#25** The Commitments tab:
  - recording a commitment runs the conflict rules immediately;
  - the Dependencies card on every home: who waits on whom, at risk or blocked, bottlenecks, on-time rate, conflicts;
  - the plans behind an insight on its trace.
  - Fix: each side of a conflict can see the other side's commitment.
- **#26** The approval workflow UX:
  - who else is asked, targets, due date, expiry, your recent answers;
  - acknowledge, dismiss, cancel, amend and retry from the trace.
  - Fix (AZ-2): whoever amends an action becomes its proposer, so they cannot approve their own revision.
- **#27** Actions & outcomes: the tracker with filters; outcomes being measured, waiting for a lesson, and reviewed; the lessons library; "Last time we did this".
- **#28** The scoped audit explorer for every `audit.read` holder: filters, refusals, and your own attempts.

- **#31** Hebrew and right-to-left (G-P4a, before Phase 5): EN / עברית switch per user, every screen mirrored and
  translated, names and seeded and generated text shown in Hebrew; the database stays English (ADR-007, P-6a).
  Verified locally: 514 unit, 79 integration, 24 e2e (English unchanged + the Hebrew path); a crawl of every persona
  and page in Hebrew finds no untranslated data string.

## Verified (by running)

- **Local:**
  - typecheck, lint, format;
  - 503 unit and 78 integration tests;
  - 22 e2e tests against a production build after a fresh reset;
  - smoke 10/10;
  - gitleaks clean.
- **Dev (649eb1a):**
  - smoke 10/10;
  - e2e 22/22 after a reset;
  - doctor passes;
  - Dev reset afterwards.

## Failed / broken

- (none open). The root causes fixed in Phase 4 are in STATUS.md:
  - the conflict-visibility gap;
  - the AZ-2 amend gap;
  - a gitleaks false positive on help text;
  - Prod persona sign-in after the secret rotation.

## Open decisions (for Eran)

- **The Phase 4 gate**, with choices Q1–Q4 to confirm:
  - Q1: who decides a conflict;
  - Q2: when an overdue commitment becomes an insight;
  - Q3: moving a date without approval;
  - Q4: dependency status is derived.
- **Q5:** allow amending after a denial? This changes the approved lifecycle and is not built.
- **Promotion of Phase 4 to Prod** after sign-off. The promotion runs migration 0006 and the `p4-v1` reseed.
- The AI provider (Claude vs Gemini), at the Phase 5 gate.

## Known limitations / deliberate deferrals

- Railway deprecates `railway.toml` (Config as Code) in favour of `.railway/railway.ts` (Infrastructure as Code); `railway.toml` keeps working until 2026-12-01. Migrate before then (`railway config migrate` dry-run output is ready); treat as an infrastructure change.
- Railway runs Postgres 18; CI and Compose use 18; Claude's sandbox uses native 16 (no feature differences relied on).

- The cloud workspace cannot reach Docker container ports, so Claude's local loop uses native Postgres 16;
  the README path (Docker Compose) is exercised by Eran's machine and CI uses a Postgres service.
- Audit explorer and commitment read models load an epoch's rows and filter in the application layer (fine at demo
  scale: ~1–2k events); move to SQL filters before real data volumes.
- `tests/integration/lifecycle.test.ts` "§5.2" depends on the tests before it in its file (fails when run alone).
- A branch manager does not see region-level dependencies (North waits on the DC): consistent with insight scoping
  (a branch sees only what touches the branch).

## Next recommended action

1. Eran: the Phase 4 demo on Dev (docs/phases/PHASE_4.md, "Demo scenario"), then the gate (confirm Q1–Q4, decide Q5).
2. After sign-off: promote to Prod by merging `main` into `demo` (no force), then verify with smoke, doctor, e2e and a persona sign-in.
3. Phase 5 (AI intelligence): needs the provider, key, spend cap and eval thresholds at its gate. AI text must follow
   the reader's language (ADR-007, consequences).

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
