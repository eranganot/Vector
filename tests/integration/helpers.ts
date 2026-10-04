import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "@/infra/db/schema";
import { migrationsFolder } from "@/infra/db/migrations";
import { ensureAppRole } from "@/infra/db/roles";

/**
 * Integration tests forge audit rows on purpose (tamper detection) and never delete anything, so
 * they must not run against a database anyone uses: TEST_DATABASE_URL is preferred, and a database
 * whose name lacks "test" is refused outside CI (STATUS.md, 2026-10-04 root-cause record).
 */
export const OWNER_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";
if (!OWNER_URL) throw new Error("Integration tests need TEST_DATABASE_URL (or DATABASE_URL in CI)");
const dbName = new URL(OWNER_URL).pathname.slice(1);
if (!/test/i.test(dbName) && process.env.CI !== "true")
  throw new Error(
    `Refusing to run integration tests against "${dbName}": they write forged audit rows. Set TEST_DATABASE_URL to a *_test database.`,
  );
export const APP_PASSWORD = "integration_test_app_role_pw";

/** Migrates, ensures the restricted app role, and returns owner + app-role pools. */
export async function setupDb() {
  const owner = new Pool({ connectionString: OWNER_URL });
  await migrate(drizzle(owner), { migrationsFolder: migrationsFolder() });
  await ensureAppRole(owner, APP_PASSWORD);
  const url = new URL(OWNER_URL);
  url.username = "vector_app";
  url.password = APP_PASSWORD;
  const app = new Pool({ connectionString: url.toString() });
  return { owner, app, ownerDb: drizzle(owner, { schema }), appDb: drizzle(app, { schema }) };
}
