# VECTOR

VECTOR is an organizational intelligence layer: it turns signals from an organization's systems into
explained, prioritized insights, then decisions, actions and measured outcomes, with human approval and
a full audit trail.

**Signal → Insight → Decision → Action → Outcome → Learning**, governed by evidence, priority,
authorization, human control and auditability. See [docs/product/CHARTER.md](docs/product/CHARTER.md).

The prototype runs on a synthetic retail group (60 branches in 5 regions, 8 departments, 18 people). Insights come in
two workstreams, risks and opportunities, ranked separately; region and branch managers also see a priority relative
to their own scope. Each person gets a performance dashboard for their position (group, region, branch or department).

Current phase and status: [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md) and [STATUS.md](STATUS.md).

## Run it locally

Requires Node 22+, pnpm 10 (`corepack enable`), and Postgres (Docker Compose provides one).

```bash
pnpm install
cp .env.example .env          # then set BETTER_AUTH_SECRET (>= 32 characters)
docker compose up -d --wait   # Postgres 18 on localhost:5432
pnpm db:migrate               # apply the SQL migrations
pnpm demo:reset               # seed the organization, run the detector, load the scenario catalog
pnpm dev
```

Open http://localhost:3000 and sign in. With `DEMO_PERSONAS=on` the sign-in page lists every seeded person; pick
one to sign in as them. To sign in by hand, use `<name>@vector-retail.example` (for example
`dana@vector-retail.example`) with the default local password `vector-local-only`, which applies only when
`VECTOR_ENV` is `local` or `test` and `SEED_USER_PASSWORD` is empty. Health: http://localhost:3000/api/health.

For integration tests, create a separate database whose name contains `test` (for example `vector_test`) and set
`TEST_DATABASE_URL`. The tests forge audit rows on purpose and refuse any database whose name lacks "test" (CI creates `vector_test`).

## Configuration

All variables are in [.env.example](.env.example).

| Variable             | Purpose                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Postgres as the owner role: migrations, seeding, doctor. The app also uses it when `APP_DATABASE_URL` is unset |
| `APP_DATABASE_URL`   | Optional: the restricted `vector_app` role the app runs as (see `pnpm db:roles`)                               |
| `VECTOR_ENV`         | `local`, `test`, `dev` or `demo`; shown in `/api/health`                                                       |
| `LOG_LEVEL`          | `debug`, `info`, `warn` or `error`                                                                             |
| `SEED_USER_PASSWORD` | Password of the seeded people. Required outside `local`/`test`                                                 |
| `DEMO_PERSONAS`      | `on` enables the persona switcher                                                                              |
| `DEMO_CONTROLS`      | `off` disables the Admin demo controls (clock, reset)                                                          |
| `BETTER_AUTH_SECRET` | Session signing secret, at least 32 characters                                                                 |
| `BETTER_AUTH_URL`    | Public base URL of the app                                                                                     |
| `TEST_DATABASE_URL`  | Database for integration tests (name must contain `test`)                                                      |

`pnpm db:roles` also reads `APP_DB_PASSWORD` (not in `.env.example`; set it only where you create the role).

## Commands

| Command                                        | What it does                                                                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                     | Dev server                                                                                                                                                             |
| `pnpm build` / `pnpm start`                    | Production build and server                                                                                                                                            |
| `pnpm start:railway`                           | Railway start: migrate, create the app role if configured, seed a demo epoch if none has the current seed version, start                                               |
| `pnpm typecheck` / `pnpm lint`                 | Static checks (lint also enforces the layer boundaries)                                                                                                                |
| `pnpm format` / `pnpm format:check`            | Prettier write / check (CI runs the check)                                                                                                                             |
| `pnpm test`                                    | Unit tests                                                                                                                                                             |
| `pnpm test:integration`                        | Integration tests against `TEST_DATABASE_URL` (a `*_test` database)                                                                                                    |
| `pnpm build && pnpm test:e2e`                  | Playwright end-to-end; needs a freshly reset demo and `DEMO_PERSONAS=on` (starts the built app unless `BASE_URL` is set)                                               |
| `pnpm db:generate`                             | Generate a SQL migration from `src/infra/db/schema.ts`                                                                                                                 |
| `pnpm db:migrate`                              | Apply pending migrations                                                                                                                                               |
| `pnpm db:roles [--if-configured]`              | Create or re-key the `vector_app` login role (needs `APP_DB_PASSWORD`)                                                                                                 |
| `pnpm db:seed`                                 | Seed a new organization epoch only (no detector, no catalog)                                                                                                           |
| `pnpm demo:reset [--if-empty]`                 | Seed a new epoch, run the detector, load the scenario catalog. `--if-empty` skips it when an active epoch has the current seed version                                 |
| `pnpm run doctor [--url <base>]`               | Diagnostic: env, deps, DB, migrations, every epoch's audit hash chain, the active demo epoch, deployed health. Note `pnpm run`: plain `pnpm doctor` is a pnpm built-in |
| `pnpm smoke --url <base> [--expect-sha <sha>]` | Phase smoke test against a running environment                                                                                                                         |
| `pnpm exec tsx scripts/calibrate-priority.ts`  | Print every priority scenario's score and band against its expected band                                                                                               |

## Layout

```
src/domain        Pure business logic: state machines, policy, priority, detection (no framework, no DB). Lint-enforced.
src/application   Commands and queries: authorization, transactions, audit; detector, scenario engine, facade for the UI.
src/infra         Database schema and roles, auth (Better Auth), config, logging, seed data.
src/app           Next.js UI, server actions and route handlers. Never touches the DB directly.
drizzle/          SQL migrations (generated, reviewed, committed).
scripts/          migrate, db-roles, seed, demo-reset, doctor, smoke, calibrate-priority.
tests/            integration (real Postgres) and e2e (Playwright).
docs/             charter, decisions, plan, ADRs, specs (docs/specs/), handoff.
```

## Environments

| Env   | Where                                       | Deploys from                        |
| ----- | ------------------------------------------- | ----------------------------------- |
| local | your machine                                | working tree                        |
| dev   | Railway project "Vector", environment "Dev" | `main`, on every merge              |
| demo  | Railway, environment "demo"                 | `demo` branch, after phase sign-off |

Secrets live only in Railway variables or a local `.env`. Never commit them; CI runs gitleaks.
