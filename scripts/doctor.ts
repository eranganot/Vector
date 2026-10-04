/**
 * VECTOR diagnostic (charter §40). Grows with each phase.
 *   pnpm doctor                 -> checks the local environment and database
 *   pnpm doctor --url <baseUrl> -> also checks a deployed environment's health
 * Exits non-zero if any check fails.
 */
import { existsSync } from "node:fs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrationStatus } from "../src/infra/db/migrations";
import * as schema from "../src/infra/db/schema";
import { verifyAuditChain } from "../src/application/audit";
import type { Db } from "../src/application/db";

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

    const required = ["DATABASE_URL", "VECTOR_ENV", "LOG_LEVEL"];
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
        // Audit integrity (ADR-004): every organization epoch's hash chain verifies end to end.
        const db = drizzle(pool, { schema }) as unknown as Db;
        const orgs = await pool.query("select id, is_active, seed_version from organization order by created_at");
        const broken: string[] = [];
        let events = 0;
        for (const o of orgs.rows) {
          const v = await verifyAuditChain(db, o.id);
          events += v.count;
          if (!v.ok) broken.push(`${o.id.slice(0, 8)} at #${v.brokenAt}`);
        }
        record(
          "audit hash chains",
          broken.length === 0,
          broken.length ? `broken: ${broken.join(", ")}` : `${orgs.rowCount} epoch(s), ${events} events verified`,
        );
        // Seed integrity: the active epoch is the current synthetic organization with both workstreams.
        const active = orgs.rows.find((o) => o.is_active);
        if (active) {
          const c = await pool.query(
            `select (select count(*)::int from org_unit where org_id = $1 and type = 'branch') as branches,
                    (select count(*)::int from org_unit where org_id = $1 and type = 'department') as departments,
                    (select count(*)::int from insight where org_id = $1) as insights`,
            [active.id],
          );
          const { branches, departments, insights } = c.rows[0];
          record(
            "active demo epoch",
            branches === 60 && departments === 8 && insights >= 19,
            `seed ${active.seed_version}: ${branches} branches, ${departments} departments, ${insights} insights`,
          );
        } else record("active demo epoch", false, "none — run pnpm demo:reset");
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
