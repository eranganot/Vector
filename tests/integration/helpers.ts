import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "@/infra/db/schema";
import { migrationsFolder } from "@/infra/db/migrations";
import { ensureAppRole } from "@/infra/db/roles";

export const OWNER_URL = process.env.DATABASE_URL ?? "";
if (!OWNER_URL) throw new Error("Integration tests need DATABASE_URL");
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
