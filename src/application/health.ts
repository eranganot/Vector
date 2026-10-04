import type { Pool } from "pg";
import { buildInfo } from "@/infra/build-info";
import { migrationStatus, type MigrationStatus } from "@/infra/db/migrations";

export interface HealthReport {
  status: "ok" | "degraded";
  env: string;
  build: { sha: string; shortSha: string };
  db: { ok: boolean; latencyMs?: number; error?: string };
  migrations?: MigrationStatus;
  /** The active demo epoch: seed version and workstream sizes (counts only, no content). */
  demo?: { seedVersion: string | null; risks: number; opportunities: number };
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
    else {
      const r = await pool.query(
        `select o.seed_version,
                count(*) filter (where i.workstream = 'risk')::int as risks,
                count(*) filter (where i.workstream = 'opportunity')::int as opportunities
           from organization o left join insight i on i.org_id = o.id
          where o.is_active group by o.id, o.seed_version limit 1`,
      );
      report.demo = r.rows[0]
        ? { seedVersion: r.rows[0].seed_version, risks: r.rows[0].risks, opportunities: r.rows[0].opportunities }
        : { seedVersion: null, risks: 0, opportunities: 0 };
    }
  } catch (err) {
    report.db = { ok: false, error: err instanceof Error ? err.message : String(err) };
    report.status = "degraded";
  }
  return report;
}
