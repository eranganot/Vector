# Session handoff

_Last updated: 2026-10-04_

## Current phase

Phase 0 — Foundation (in progress)

## Objective

A deployable, tested, documented empty shell on Railway Dev. No product features.

## Completed

- Repo scaffold: Next.js 16, TypeScript strict, ESLint with layer-boundary rules, Prettier, Vitest, Playwright
- Postgres via Drizzle: `app_meta` table, migration `0000_init`, `scripts/migrate.ts`
- `/api/health`: build SHA, DB connectivity and latency, migration status; 503 when degraded
- Diagnostics `pnpm run doctor`, smoke `pnpm smoke`
- CI: gitleaks + typecheck, lint, unit, migrate, integration, build, e2e, doctor
- Docs: charter, decisions register, plan summary, ADR-001/002

## Verified (by running)

- Local: typecheck, lint, 6 unit + 2 integration + 2 e2e tests pass; doctor and smoke pass against a local production build
- Lint boundary rules fire on a domain→pg import and a UI→DB import

## Failed / broken

- (none open)

## Open decisions

- AI provider (Claude vs Gemini) — at Phase 5 gate

## Known limitations / deliberate deferrals

- Restricted app DB role (no UPDATE/DELETE on audit) moves to Phase 2, where the audit table it protects
  is created and can be tested. Phase 0 connects as the Railway Postgres owner.
- The cloud workspace cannot reach Docker container ports, so Claude's local loop uses native Postgres 16;
  the README path (Docker Compose) is exercised by Eran's machine and CI uses a Postgres service.

## Next recommended action

Finish Phase 0: PR → CI green → merge → verify Dev deploy with `pnpm smoke --expect-sha`.

## Reproducible commands

See README "Commands". Deploy check: `pnpm smoke --url <dev url> --expect-sha <sha>`.

## Environment

- GitHub: eranganot/Vector, default branch `main`
- Railway: project "Vector" (81d7e2a7-902c-4162-be63-d3c2b52b8fd7), environment "Dev"
