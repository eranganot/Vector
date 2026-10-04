# VECTOR

VECTOR is an organizational intelligence layer: it turns signals from an organization's systems into
explained, prioritized insights, then decisions, actions and measured outcomes, with human approval and
a full audit trail.

**Signal → Insight → Decision → Action → Outcome → Learning**, governed by evidence, priority,
authorization, human control and auditability. See [docs/product/CHARTER.md](docs/product/CHARTER.md).

Current phase and status: [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md).

## Run it locally

Requires Node 22+, pnpm 10 (`corepack enable`), and Docker (for Postgres).

```bash
pnpm install
cp .env.example .env
docker compose up -d --wait
pnpm db:migrate && pnpm dev
```

Open http://localhost:3000 and http://localhost:3000/api/health.

## Commands

| Command                                        | What it does                                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                     | Dev server                                                                                                      |
| `pnpm typecheck` / `pnpm lint`                 | Static checks (lint also enforces the layer boundaries)                                                         |
| `pnpm test`                                    | Unit tests                                                                                                      |
| `pnpm test:integration`                        | Integration tests against the Postgres in `DATABASE_URL`                                                        |
| `pnpm build && pnpm test:e2e`                  | Playwright end-to-end (starts the built app unless `BASE_URL` is set)                                           |
| `pnpm db:generate`                             | Generate a SQL migration from `src/infra/db/schema.ts`                                                          |
| `pnpm db:migrate`                              | Apply pending migrations                                                                                        |
| `pnpm run doctor [--url <base>]`               | Diagnostic: env, deps, DB, migrations, deployed health. Note `pnpm run`: plain `pnpm doctor` is a pnpm built-in |
| `pnpm smoke --url <base> [--expect-sha <sha>]` | Phase smoke test against a running environment                                                                  |

## Layout

```
src/domain        Pure business logic (no framework, no DB). Lint-enforced.
src/application   Commands and queries: authorization, transactions, audit.
src/infra         Database, config, logging, (later) auth, jobs, executors.
src/app           Next.js UI and route handlers. Never touches the DB directly.
drizzle/          SQL migrations (generated, reviewed, committed).
scripts/          migrate, doctor, smoke.
tests/            integration (real Postgres) and e2e (Playwright).
docs/             charter, decisions, plan, ADRs, handoff.
```

## Environments

| Env   | Where                                       | Deploys from                        |
| ----- | ------------------------------------------- | ----------------------------------- |
| local | your machine                                | working tree                        |
| dev   | Railway project "Vector", environment "Dev" | `main`, on every merge              |
| demo  | Railway, environment "demo"                 | `demo` branch, after phase sign-off |

Secrets live only in Railway variables or a local `.env`. Never commit them; CI runs gitleaks.
