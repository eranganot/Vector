# ADR-002: Railway hosting with Dev and demo environments

- Status: Accepted (Eran, 2026-10-04, decisions D2–D4)

## Decision

- Railway project "Vector" (Eran's account) with two environments: **Dev** (deploys `main` on every merge)
  and **demo** (deploys a `demo` branch fast-forwarded only after phase sign-off). Each has a web service
  and its own Postgres.
- Build with Railpack; `railway.toml` sets `pnpm start:railway` (migrate, then start) and a `/api/health`
  healthcheck. A deploy is verified by the commit SHA reported in `/api/health`.
- Secrets live in Railway variables only. Claude holds a Dev-scoped project token for the session.

## Alternatives considered

Vercel + managed Postgres (serverless functions complicate background jobs and long-lived DB pools);
Fly.io (more ops work); a single environment (demos would break during development).

## Consequences

~$10–20/month. Demo stability is protected by the branch gate. Background jobs can run in-process now
and move to a separate Railway service later without re-platforming.
