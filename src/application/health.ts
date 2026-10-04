import type { Pool } from "pg";
import { buildInfo } from "@/infra/build-info";
import { migrationStatus, type MigrationStatus } from "@/infra/db/migrations";

export interface HealthReport {
  status: "ok" | "degraded";
  env: string;
  build: { sha: string; shortSha: string };
  db: { ok: boolean; latencyMs?: number; error?: string };
  migrations?: MigrationStatus;
  time: string;
}

/** Health = the build is identifiable, the DB answers, and no migration is pending. */
export async function checkHealth(pool: Pool, env: string, now: Date = new Date()): Promise<HealthReport> {
  const report: HealthReport = { status: "ok", env, build: buildInfo(), db: { ok: false }, time: now.toISOString() };
  try {
    const t0 = performance.now();
    await pool.query("select 1");
    report.db = { ok: true, latencyMs: Math.round(performance.now() - t0) };
    report.migrations = await migrationStatus(pool);
    if (report.migrations.pending > 0) report.status = "degraded";
  } catch (err) {
    report.db = { ok: false, error: err instanceof Error ? err.message : String(err) };
    report.status = "degraded";
  }
  return report;
}
