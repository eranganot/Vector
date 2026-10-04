/** Applies pending SQL migrations from ./drizzle. Runs before the app starts on Railway. */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { migrationsFolder } from "../src/infra/db/migrations";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: migrationsFolder() });
    console.log("migrations: up to date");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("migrations: FAILED", err);
  process.exit(1);
});
