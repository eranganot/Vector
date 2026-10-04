# Runbook: the demo environment (production for investor demos)

Decision D2/D3: Railway project "Vector" has two environments, **Dev** (deploys every merge to `main`) and **demo**
(updates only when Eran signs off a phase). The demo environment deploys the git branch **`demo`**; promoting a phase means
moving `demo` to the signed-off commit.

Claude's Railway token is scoped to Dev only (D4), so Eran creates the demo environment once.

## One-time setup (Eran, ~10 minutes)

1. **Create the environment.** Railway → project **Vector** → environment menu (top left, "Dev") → **New Environment** →
   choose **Duplicate environment** from **Dev** → name it `demo`. Railway copies both services (`Vector`, `Postgres`)
   and their variables; the duplicate gets its **own, empty** Postgres.
2. **Deploy from the `demo` branch, not `main`.** In `demo` → service **Vector** → **Settings** → **Source** → Branch:
   `demo`. (This keeps D3: merges to `main` never reach the demo environment.)
3. **Give it a public URL.** Service **Vector** → **Settings** → **Networking** → **Generate Domain**. Copy it.
4. **Set the variables that must differ from Dev** (service **Vector** → **Variables**):

   | Variable             | Value in demo                                                                |
   | -------------------- | ---------------------------------------------------------------------------- |
   | `VECTOR_ENV`         | `demo`                                                                       |
   | `BETTER_AUTH_URL`    | the domain from step 3, with `https://`                                      |
   | `BETTER_AUTH_SECRET` | a new random value (e.g. `openssl rand -base64 32` or your password manager) |
   | `SEED_USER_PASSWORD` | a new password for the personas' password sign-in                            |
   | `APP_DB_PASSWORD`    | a new random value (the restricted `vector_app` database role)               |

   Keep as copied: `DATABASE_URL` and `APP_DATABASE_URL` (references to the demo Postgres), `LOG_LEVEL=info`,
   `DEMO_PERSONAS=on` (persona sign-in for the demo), `DEMO_CONTROLS=on` (reset and clock controls, Admin persona only).
   Check that `DATABASE_URL` shows `${{Postgres.DATABASE_URL}}` and points at the demo environment's Postgres.

5. **Deploy.** Railway deploys on save. The start command migrates the database, creates the `vector_app` role, seeds the
   synthetic organization (detector + scenario catalog) and starts the app; the first boot takes about a minute.
6. **Tell Claude the URL.** Claude runs `pnpm smoke --url <demo url> --expect-sha <commit>` and `pnpm run doctor --url
<demo url>` (both public checks; no token needed) and records the result.

## Promoting a phase (after Eran's sign-off)

1. Claude fast-forwards `demo` to the signed-off commit on `main` (`git push origin <sha>:demo`) and records it in
   STATUS.md and DECISIONS.md.
2. Railway deploys `demo`. If the synthetic organization changed (new `SEED_VERSION`), the start command opens a new epoch
   automatically; otherwise data is kept.
3. Claude runs smoke and doctor against the demo URL.

## Before every live demo

- Sign in as **Ops Admin** → **Demo controls** → **Reset demo** (fresh epoch, story day 22 October, approvals waiting).
- Walk the script in [docs/specs/demo-narrative.md](../specs/demo-narrative.md) once.
- Rollback: Railway → service **Vector** → **Deployments** → previous deployment → **Redeploy**; or move `demo` back to the
  previous signed-off commit.

## Notes

- `railway.toml` (Config as Code) applies to both environments. Railway deprecates it on 2026-12-01 in favour of
  `.railway/railway.ts`; migrate before then.
- Cost: one more web service and Postgres, roughly $5–10/month at demo traffic (D2).
