import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { checkHealth } from "@/application/health";
import { expectedMigrations, migrationsFolder } from "@/infra/db/migrations";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Integration tests need DATABASE_URL");

let pool: Pool;

beforeAll(async () => {
  pool = new Pool({ connectionString: url });
  await migrate(drizzle(pool), { migrationsFolder: migrationsFolder() });
});

afterAll(async () => {
  await pool.end();
});

describe("checkHealth against a real database", () => {
  it("reports ok with every shipped migration applied", async () => {
    const report = await checkHealth(pool, "test");
    expect(report.status).toBe("ok");
    expect(report.db.ok).toBe(true);
    expect(report.migrations).toMatchObject({ pending: 0, applied: expectedMigrations().length });
    expect(report.migrations?.latest).toBe(expectedMigrations().at(-1));
  });

  it("reports degraded, not a crash, when the database is unreachable", async () => {
    const dead = new Pool({ connectionString: "postgres://nobody:x@127.0.0.1:1/none", connectionTimeoutMillis: 1_000 });
    const report = await checkHealth(dead, "test");
    expect(report.status).toBe("degraded");
    expect(report.db.ok).toBe(false);
    expect(report.db.error).toBeTruthy();
    await dead.end();
  });
});
