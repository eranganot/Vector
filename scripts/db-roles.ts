/**
 * Creates (or re-keys) the application's login role `vector_app`, a member of `vector_app_rw`
 * (migration 0002). Run once per environment as the database owner:
 *   DATABASE_URL=<owner url> APP_DB_PASSWORD=<secret> pnpm db:roles
 * Then set APP_DATABASE_URL to the same URL with user vector_app and that password.
 */
import { Pool } from "pg";
import { ensureAppRole } from "../src/infra/db/roles";

async function main() {
  const url = process.env.DATABASE_URL;
  const password = process.env.APP_DB_PASSWORD;
  if (process.argv.includes("--if-configured") && !password) {
    console.log("vector_app: skipped (APP_DB_PASSWORD not set)");
    return;
  }
  if (!url || !password) throw new Error("DATABASE_URL and APP_DB_PASSWORD are required");
  const pool = new Pool({ connectionString: url });
  try {
    console.log(`vector_app ${await ensureAppRole(pool, password)}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
