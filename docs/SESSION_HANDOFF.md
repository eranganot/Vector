# Session handoff

_Last updated: 2026-10-04_

## Current phase

Phase 1 — Product & architecture: specs complete, awaiting Eran's gate (Phase 0 signed off 2026-10-04)

## Objective

Turn the charter into approved specs before core code: domain model, authorization/approval, audit, priority, security, AI governance, tests, data, demo, IA + wireframes.

## Completed

- Phase 1 specs in `docs/specs/` (domain-model, authorization, security, priority + calibration, synthetic-data, demo-narrative, ai-governance, testing, information-architecture), `docs/architecture.md`, ADR-003/004/005, wireframes (design canvas + `docs/specs/wireframes/`)
- Priority calibration: 10 scenarios, all expected bands reproduced (`pnpm exec tsx scripts/calibrate-priority.ts`)

- Repo scaffold: Next.js 16, TypeScript strict, ESLint with layer-boundary rules, Prettier, Vitest, Playwright
- Postgres via Drizzle: `app_meta` table, migration `0000_init`, `scripts/migrate.ts`
- `/api/health`: build SHA, DB connectivity and latency, migration status; 503 when degraded
- Diagnostics `pnpm run doctor`, smoke `pnpm smoke`
- CI: gitleaks + typecheck, lint, unit, migrate, integration, build, e2e, doctor
- Docs: charter, decisions register, plan summary, ADR-001/002

## Verified (by running)

- Dev deploy of `d3241c5` (PR #1): Railway build SUCCESS; migration ran at start; `pnpm smoke --expect-sha` and `pnpm run doctor --url` pass against https://vector-dev-46ab.up.railway.app
- CI green on PR #1 (gitleaks + verify) on both pushes
- Fresh clone of the branch: install → migrate → build → start → /api/health ok

- Local: typecheck, lint, 6 unit + 2 integration + 2 e2e tests pass; doctor and smoke pass against a local production build
- Lint boundary rules fire on a domain→pg import and a UI→DB import

## Failed / broken

- (none open)

## Open decisions

- Phase 1 gate: approve domain model + state machines, roles/approval rules AP-1..AP-6, priority model v1 + bands, wireframes/IA, demo narrative, ADR-003/004/005

- AI provider (Claude vs Gemini) — at Phase 5 gate

## Known limitations / deliberate deferrals

- Railway deprecates `railway.toml` (Config as Code) in favour of `.railway/railway.ts` (Infrastructure as Code); `railway.toml` keeps working until 2026-12-01. Migrate before then (`railway config migrate` dry-run output is ready); treat as an infrastructure change.
- Railway runs Postgres 18; CI and Compose use 18; Claude's sandbox uses native 16 (no feature differences relied on).

- Restricted app DB role (no UPDATE/DELETE on audit) moves to Phase 2, where the audit table it protects
  is created and can be tested. Phase 0 connects as the Railway Postgres owner.
- The cloud workspace cannot reach Docker container ports, so Claude's local loop uses native Postgres 16;
  the README path (Docker Compose) is exercised by Eran's machine and CI uses a Postgres service.

## Next recommended action

Eran approves the Phase 1 gate → start Phase 2 (core VECTOR chain, deterministic).

## Reproducible commands

See README "Commands". Deploy check: `pnpm smoke --url <dev url> --expect-sha <sha>`.

## Environment

- GitHub: eranganot/Vector, default branch `main`
- Railway: project "Vector" (81d7e2a7-902c-4162-be63-d3c2b52b8fd7), environment "Dev"; services `Vector` (web, deploys `main`) and `Postgres`; public URL https://vector-dev-46ab.up.railway.app
- Dev variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `VECTOR_ENV=dev`, `LOG_LEVEL=info`

## Lessons

- 2026-10-04: `railway add --database postgres` printed "Project not found" yet created the database (twice). A CLI error is not proof of a no-op: after any Railway mutation, re-read state (`railway status --json`) before retrying.
