/**
 * Ops bootstrap: seeds a new demo epoch and runs the detector once (no signed-in user needed).
 *   pnpm demo:reset     (DATABASE_URL; SEED_USER_PASSWORD outside local/test)
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/infra/db/schema";
import { seed } from "../src/infra/seed/seed";
import { seedPassword } from "../src/infra/seed/password";
import { createContext } from "../src/application/context";
import { runDetector } from "../src/application/detector";
import type { Db } from "../src/application/db";

async function main() {
  const password = seedPassword();
  if (!password) throw new Error("SEED_USER_PASSWORD is required outside local/test");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const db = drizzle(pool, { schema }) as unknown as Db;
    const r = await seed(db, { password });
    const found = await runDetector(await createContext(db, { orgId: r.orgId }));
    console.log(`demo epoch ${r.orgId}: ${found.length} insight(s) detected`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
