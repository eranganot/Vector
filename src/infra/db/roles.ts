import type { Pool } from "pg";

/** Ensures the login role `vector_app` exists with this password and belongs to `vector_app_rw`. */
export async function ensureAppRole(pool: Pool, password: string): Promise<"created" | "updated"> {
  if (!/^[A-Za-z0-9_-]{24,}$/.test(password)) throw new Error("app role password must be >= 24 chars of [A-Za-z0-9_-]");
  const exists = await pool.query("select 1 from pg_roles where rolname = 'vector_app'");
  // Role DDL cannot take bind parameters; the password is validated to a safe character set above.
  if (exists.rowCount === 0) await pool.query(`create role vector_app login password '${password}'`);
  else await pool.query(`alter role vector_app with login password '${password}'`);
  await pool.query("grant vector_app_rw to vector_app");
  return exists.rowCount === 0 ? "created" : "updated";
}
