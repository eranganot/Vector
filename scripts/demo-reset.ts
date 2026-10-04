/**
 * Ops bootstrap: seeds a new demo epoch, runs the detector and loads the scenario catalog.
 *   pnpm demo:reset [--if-empty]   (DATABASE_URL; SEED_USER_PASSWORD outside local/test)
 * --if-empty reseeds only when no active epoch carries the current SEED_VERSION, so a deploy that
 * changes the synthetic organization starts a new epoch (old epochs and their audit stay intact).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/infra/db/schema";
import { SEED_VERSION } from "../src/infra/seed/org";
import { seedPassword } from "../src/infra/seed/password";
import { bootstrapEpoch } from "../src/application/scenario";
import type { Db } from "../src/application/db";

async function main() {
  const password = seedPassword();
  if (!password) throw new Error("SEED_USER_PASSWORD is required outside local/test");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const db = drizzle(pool, { schema }) as unknown as Db;
    if (process.argv.includes("--if-empty")) {
      const active = await pool.query("select id from organization where is_active and seed_version = $1 limit 1", [
        SEED_VERSION,
      ]);
      if (active.rowCount) {
        console.log(`demo: active ${SEED_VERSION} epoch ${active.rows[0].id} exists; not reseeding`);
        return;
      }
    }
    const r = await bootstrapEpoch(db, password);
    console.log(
      `demo epoch ${r.orgId} (${SEED_VERSION}): ${r.detections.length} detected, ${r.catalog.length} catalog insight(s)`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
