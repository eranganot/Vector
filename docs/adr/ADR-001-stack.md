# ADR-001: TypeScript modular monolith (Next.js + PostgreSQL + Drizzle)

- Status: Accepted (Eran, 2026-10-04, decision D1)

## Context

VECTOR's hard problems are domain correctness (explicit lifecycle state machines), authorization,
human approval and tamper-evident audit, not scale. The prototype must also produce an investor-grade UI
quickly, and later evolve into a real product.

## Decision

One TypeScript codebase deployed as one service:

- Next.js App Router (React Server Components) for UI and thin route handlers.
- A framework-free domain core (`src/domain`) holding state machines, policy and priority; an application
  layer (`src/application`) of commands/queries that authorize and audit inside DB transactions.
- PostgreSQL (18 on Railway, CI and Compose) via Drizzle ORM with SQL migrations in git.
- Better Auth for authentication (Phase 2); authorization is our own policy module.
- Vitest (unit + real-Postgres integration) and Playwright (E2E).
- Layer boundaries enforced by ESLint `no-restricted-imports`.

## Alternatives considered

- Separate API (Fastify/Nest) + SPA: two deployables, duplicated contracts, no benefit at this stage.
- Python backend + React: two languages and type systems.
- Prisma: heavier and less direct control over roles, grants and triggers that audit integrity needs.

## Consequences

- Audit and state change share one transaction, which makes "no hidden transitions" enforceable.
- Next.js server actions are a bypass risk; mitigated by lint rules and the commands-only mutation path.
- Splitting out a worker or API later is possible because the domain does not depend on Next.
