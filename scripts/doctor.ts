/**
 * VECTOR diagnostic (charter §40). Grows with each phase.
 *   pnpm doctor                 -> checks the local environment and database
 *   pnpm doctor --url <baseUrl> -> also checks a deployed environment's health
 * Exits non-zero if any check fails.
 */
import { existsSync, readFileSync } from "node:fs";
import { Pool } from "pg";
import { migrationStatus } from "../src/infra/db/migrations";

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];
const record = (name: string, ok: boolean, detail: string) => results.push({ name, ok, detail });

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = arg("--url");
  const remoteOnly = process.argv.includes("--remote-only");

  if (!remoteOnly) {
    const major = Number(process.versions.node.split(".")[0]);
    record("node version", major >= 22, `v${process.versions.node} (need >= 22)`);
    record(
      "dependencies installed",
      existsSync("node_modules/.pnpm"),
      existsSync("node_modules/.pnpm") ? "node_modules present" : "run pnpm install",
    );

    const required = readFileSync(".env.example", "utf8")
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => l.split("=")[0]);
    const missing = required.filter((k) => !process.env[k]);
    record(
      "env vars",
      missing.length === 0,
      missing.length ? `missing: ${missing.join(", ")}` : `${required.length} set`,
    );

    if (process.env.DATABASE_URL) {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3_000 });
      try {
        await pool.query("select 1");
        record("database connection", true, "connected");
        const m = await migrationStatus(pool);
        record(
          "migrations",
          m.pending === 0,
          `${m.applied}/${m.expected} applied${m.pending ? ` — run pnpm db:migrate` : ""}`,
        );
      } catch (err) {
        record("database connection", false, err instanceof Error ? err.message : String(err));
      } finally {
        await pool.end();
      }
    }
  }

  if (url) {
    try {
      const res = await fetch(new URL("/api/health", url), { signal: AbortSignal.timeout(10_000) });
      const body = (await res.json()) as {
        status: string;
        build: { shortSha: string };
        env: string;
        db: { ok: boolean };
        migrations?: { pending: number };
      };
      record(
        `health ${url}`,
        res.ok && body.status === "ok",
        `${res.status} ${body.status} env=${body.env} sha=${body.build.shortSha} db=${body.db.ok} pending=${body.migrations?.pending}`,
      );
      const expectSha = arg("--expect-sha");
      if (expectSha)
        record(
          "deployed commit",
          body.build.shortSha === expectSha.slice(0, 7),
          `expected ${expectSha.slice(0, 7)}, got ${body.build.shortSha}`,
        );
    } catch (err) {
      record(`health ${url}`, false, err instanceof Error ? err.message : String(err));
    }
  }

  const width = Math.max(...results.map((r) => r.name.length));
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}  ${r.detail}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
  process.exit(failed ? 1 : 0);
}

main();
