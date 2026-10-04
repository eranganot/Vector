import { readFileSync } from "node:fs";
import path from "node:path";
import type { Pool } from "pg";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

export function migrationsFolder(): string {
  return MIGRATIONS_FOLDER;
}

/** Migrations shipped with this build, from drizzle-kit's journal. */
export function expectedMigrations(): string[] {
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };
  return journal.entries.map((e) => e.tag);
}

export interface MigrationStatus {
  expected: number;
  applied: number;
  latest: string | null;
  pending: number;
}

/** Compares migrations in the build against those recorded as applied in the database. */
export async function migrationStatus(pool: Pool): Promise<MigrationStatus> {
  const expected = expectedMigrations();
  const exists = await pool.query<{ exists: boolean }>(
    "select to_regclass('drizzle.__drizzle_migrations') is not null as exists",
  );
  const applied = exists.rows[0]?.exists
    ? Number((await pool.query<{ n: string }>("select count(*) as n from drizzle.__drizzle_migrations")).rows[0].n)
    : 0;
  const latest = applied > 0 ? (expected[applied - 1] ?? null) : null;
  return { expected: expected.length, applied, latest, pending: Math.max(expected.length - applied, 0) };
}
