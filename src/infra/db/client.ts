import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config";
import * as schema from "./schema";

let pool: Pool | undefined;

export function getPool(): Pool {
  pool ??= new Pool({
    connectionString: config().APP_DATABASE_URL ?? config().DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5_000,
  });
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
