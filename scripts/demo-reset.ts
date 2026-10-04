/**
 * Ops bootstrap: seeds a new demo epoch, runs the detector and loads the scenario catalog.
 *   pnpm demo:reset [--if-empty]   (DATABASE_URL; SEED_USER_PASSWORD outside local/test)
 * --if-empty reseeds only when no active epoch carries the current SEED_VERSION, or when SEED_USER_PASSWORD was rotated
 * since the epoch was seeded (reseedReason), so a deploy that changes either starts a new epoch (old epochs and their
 * audit stay intact).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/infra/db/schema";
import { SEED_VERSION } from "../src/infra/seed/org";
import { seedPassword } from "../src/infra/seed/password";
import { bootstrapEpoch } from "../src/application/scenario";
import { reseedReason } from "../src/infra/seed/reseed";
import type { Db } from "../src/application/db";

async function main() {
  const password = seedPassword();
  if (!password) throw new Error("SEED_USER_PASSWORD is required outside local/test");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const db = drizzle(pool, { schema }) as unknown as Db;
    if (process.argv.includes("--if-empty")) {
      const reason = await reseedReason(db, password);
      if (!reason) {
        console.log(`demo: active ${SEED_VERSION} epoch is current; not reseeding`);
        return;
      }
      console.log(`demo: reseeding (${reason})`);
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
