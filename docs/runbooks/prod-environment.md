# Runbook: the Prod environment (production for investor demos)

Decision D2/D3: Railway project "Vector" has two environments, **Dev** (deploys every merge to `main`) and **Prod**
(Eran created it on 2026-10-04 as a duplicate of Dev; the plan called it "demo"). Prod updates only when Eran signs off a
phase. Prod deploys the git branch **`demo`**; promoting a phase means
moving `demo` to the signed-off commit.

Claude's Railway token is scoped to Dev only (D4), so Eran manages Prod's settings.

## One-time setup (Eran, ~10 minutes)

1. **Create the environment.** Railway → project **Vector** → environment menu (top left, "Dev") → **New Environment** →
   choose **Duplicate environment** from **Dev** → name it `Prod` (done). Railway copies both services (`Vector`, `Postgres`)
   and their variables; the duplicate gets its **own, empty** Postgres.
2. **Deploy from the `demo` branch, not `main`.** In `Prod` → service **Vector** → **Settings** → **Source** → Branch:
   `demo`. (This keeps D3: merges to `main` never reach the Prod environment.)
3. **Give it a public URL.** Service **Vector** → **Settings** → **Networking** → **Generate Domain**. Copy it.
4. **Set the variables that must differ from Dev** (service **Vector** → **Variables**):

   | Variable             | Value in Prod                                                                                                 |
   | -------------------- | ------------------------------------------------------------------------------------------------------------- |
   | `VECTOR_ENV`         | `prod` (any case). Accepted once `demo` carries the 2026-10-04 evening fixes; older builds accept only `demo` |
   | `BETTER_AUTH_URL`    | `https://vector-prod.up.railway.app`: the `https://` is required, or sign-in fails ("Invalid base URL")       |
   | `BETTER_AUTH_SECRET` | a new random value (e.g. `openssl rand -base64 32` or your password manager)                                  |
   | `SEED_USER_PASSWORD` | a new password for the personas' password sign-in                                                             |
   | `APP_DB_PASSWORD`    | a new random value (the restricted `vector_app` database role)                                                |

   Keep as copied: `DATABASE_URL` and `APP_DATABASE_URL` (references to the demo Postgres), `LOG_LEVEL=info`,
   `DEMO_PERSONAS=on` (persona sign-in for the demo), `DEMO_CONTROLS=on` (reset and clock controls, Admin persona only).
   Check that `DATABASE_URL` shows `${{Postgres.DATABASE_URL}}` and points at the Prod environment's Postgres.

5. **Turn on "Wait for CI"** (Settings → Source) so a push to `demo` deploys only after CI is green, then **Apply changes → Deploy**.
6. **Deploy.** Railway deploys on save. The start command migrates the database, creates the `vector_app` role, seeds the
   synthetic organization (detector + scenario catalog) and starts the app; the first boot takes about a minute.
7. **Tell Claude the URL.** Claude runs `pnpm smoke --url <prod url> --expect-sha <commit>` and `pnpm run doctor --url
<prod url>` (both public checks; no token needed) and records the result.

## Promoting a phase (after Eran's sign-off)

1. Claude fast-forwards `demo` to the signed-off commit on `main` (`git push origin <sha>:demo`) and records it in
   STATUS.md and DECISIONS.md.
2. Railway deploys `demo` after CI passes on that commit (CI runs on pushes to `demo` too). If the synthetic organization
   changed (new `SEED_VERSION`) or `SEED_USER_PASSWORD` was rotated, the start command opens a new epoch automatically;
   otherwise data is kept.
3. Claude runs smoke (`--phase <n>` for the phase Prod is on) and doctor against the Prod URL.

## Rotating a secret

- `SEED_USER_PASSWORD`: change it, then redeploy. On boot, `demo:reset --if-empty` sees that the seeded people no longer
  match the password and seeds a fresh epoch with it (before 2026-10-04 night it did not, and persona sign-in failed:
  STATUS.md).
- `BETTER_AUTH_SECRET`: change it and redeploy; everyone is signed out once.
- `APP_DB_PASSWORD`: change it and redeploy; the start command re-applies the `vector_app` role's password.

## Before every live demo

- Sign in as **Ops Admin** → **Demo controls** → **Reset demo** (fresh epoch, story day 22 October, approvals waiting).
- Walk the script in [docs/specs/demo-narrative.md](../specs/demo-narrative.md) once.
- Rollback: Railway → service **Vector** → **Deployments** → previous deployment → **Redeploy**; or move `demo` back to the
  previous signed-off commit.

## Notes

- `railway.toml` (Config as Code) applies to both environments. Railway deprecates it on 2026-12-01 in favour of
  `.railway/railway.ts`; migrate before then.
- Cost: one more web service and Postgres, roughly $5–10/month at demo traffic (D2).
