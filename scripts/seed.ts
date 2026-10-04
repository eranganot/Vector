/**
 * Seeds a new demo epoch (new organization; old ones are deactivated, never deleted).
 *   pnpm db:seed            (needs DATABASE_URL; SEED_USER_PASSWORD outside local/test)
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/infra/db/schema";
import { seed } from "../src/infra/seed/seed";
import { seedPassword } from "../src/infra/seed/password";

async function main() {
  const password = seedPassword();
  if (!password) throw new Error("SEED_USER_PASSWORD is required outside local/test");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await seed(drizzle(pool, { schema }), { password });
    console.log(
      `seeded org ${r.orgId}: ${Object.keys(r.unitIds).length} units, ${Object.keys(r.userIds).length} users, ${Object.keys(r.kpiIds).length} KPIs`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
