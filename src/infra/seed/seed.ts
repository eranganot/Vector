/**
 * Seeds a fresh organization epoch with the synthetic organization (org.ts). Never deletes:
 * previous organizations are deactivated so their audit history stays intact (ADR-004).
 */
import { eq, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { addDays } from "@/domain/calendar";
import * as s from "@/infra/db/schema";
import { loadMarket } from "@/infra/market/load";
import { generateDay, generateDepartmentDay } from "./generator";
import { budgets, FIN_ACCOUNTS, financeHistory } from "./finance";
import { HISTORY_DAYS, KPIS, ORG_NAME, SEED_VERSION, STORY_DAY, UNITS, USERS } from "./org";

type Db = NodePgDatabase<typeof s>;

export type SeedResult = {
  orgId: string;
  unitIds: Record<string, string>;
  userIds: Record<string, string>;
  kpiIds: Record<string, string>;
};

export async function seed(db: Db, opts: { password: string }): Promise<SeedResult> {
  const passwordHash = await hashPassword(opts.password);
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(s.organization)
      .values({ name: ORG_NAME, seedVersion: SEED_VERSION, isActive: true })
      .returning();
    await tx.update(s.organization).set({ isActive: false }).where(ne(s.organization.id, org.id));

    const unitIds: Record<string, string> = {};
    const paths: Record<string, string[]> = {};
    for (const u of UNITS) {
      const id = randomUUID();
      unitIds[u.code] = id;
      paths[u.code] = [...(u.parent ? paths[u.parent] : []), id];
      await tx.insert(s.orgUnit).values({
        id,
        orgId: org.id,
        type: u.type,
        parentId: u.parent ? unitIds[u.parent] : null,
        code: u.code,
        name: u.name,
        city: u.city,
        lat: u.lat,
        lon: u.lon,
        sizeClass: u.sizeClass,
        pathIds: paths[u.code],
      });
    }

    const userIds: Record<string, string> = {};
    for (const u of USERS) {
      const existing = await tx.select().from(s.user).where(eq(s.user.email, u.email));
      const id = existing[0]?.id ?? randomUUID();
      userIds[u.key] = id;
      if (existing.length) {
        await tx
          .update(s.user)
          .set({ orgId: org.id, name: u.name, title: u.title, isSeeded: true, isCSuite: u.isCSuite ?? false })
          .where(eq(s.user.id, id));
        await tx
          .update(s.account)
          .set({ password: passwordHash, updatedAt: new Date() })
          .where(eq(s.account.userId, id));
      } else {
        await tx.insert(s.user).values({
          id,
          name: u.name,
          email: u.email,
          emailVerified: true,
          orgId: org.id,
          title: u.title,
          isSeeded: true,
          isCSuite: u.isCSuite ?? false,
        });
        await tx
          .insert(s.account)
          .values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: passwordHash });
      }
      for (const r of u.roles) {
        await tx
          .insert(s.roleAssignment)
          .values({ orgId: org.id, userId: id, role: r.role, orgUnitId: unitIds[r.unit], isHead: r.isHead });
      }
    }

    const kpiIds: Record<string, string> = {};
    for (const k of KPIS) {
      const [row] = await tx
        .insert(s.kpi)
        .values({
          orgId: org.id,
          code: k.code,
          name: k.name,
          unit: k.unit,
          higherIsBetter: k.higherIsBetter,
          strategicWeight: k.strategicWeight,
          ownerDepartmentId: unitIds[k.owner],
          level: k.level,
          target: k.target,
        })
        .returning();
      kpiIds[k.code] = row.id;
    }

    const rows: (typeof s.kpiObservation.$inferInsert)[] = [];
    const branchKpis = KPIS.filter((k) => k.level === "branch");
    for (let i = HISTORY_DAYS; i >= 1; i--) {
      const day = addDays(STORY_DAY, -i);
      for (const k of KPIS.filter((x) => x.level === "department")) {
        rows.push({
          orgId: org.id,
          kpiId: kpiIds[k.code],
          orgUnitId: unitIds[k.owner],
          day,
          value: generateDepartmentDay(k.code, day),
          source: "synthetic:department-feed",
        });
      }
    }
    for (const b of UNITS.filter((u) => u.type === "branch")) {
      for (let i = HISTORY_DAYS; i >= 1; i--) {
        const day = addDays(STORY_DAY, -i);
        const v = generateDay(b, day);
        for (const k of branchKpis) {
          rows.push({
            orgId: org.id,
            kpiId: kpiIds[k.code],
            orgUnitId: unitIds[b.code],
            day,
            value: v[k.code as keyof typeof v],
            source: "synthetic:store-feed",
          });
        }
      }
    }
    // Bulk insert as one array per column (unnest): 52 weeks are ~135k rows, and row-by-row statements cost ~10 s of CPU.
    for (let i = 0; i < rows.length; i += 50_000) {
      const c = rows.slice(i, i + 50_000);
      await tx.execute(sql`
        insert into kpi_observation (org_id, kpi_id, org_unit_id, day, value, source)
        select * from unnest(${sql.param(c.map((r) => r.orgId))}::uuid[], ${sql.param(c.map((r) => r.kpiId))}::uuid[],
          ${sql.param(c.map((r) => r.orgUnitId))}::uuid[], ${sql.param(c.map((r) => r.day))}::date[], ${sql.param(c.map((r) => r.value))}::float8[],
          ${sql.param(c.map((r) => r.source))}::text[])`);
    }

    // Plan v2 (E1c, financials.md): money lines for the same 52 weeks, and monthly budgets through year end.
    for (const a of FIN_ACCOUNTS)
      await tx.insert(s.finAccount).values({
        orgId: org.id,
        code: a.code,
        name: a.name,
        kind: a.kind,
        unit: a.unit,
        higherIsBetter: a.higherIsBetter,
        ownerDepartmentId: unitIds[a.owner],
        level: a.level,
      });
    const firstDay = addDays(STORY_DAY, -HISTORY_DAYS);
    const fin = financeHistory(firstDay, addDays(STORY_DAY, -1)).map((r) => ({
      orgId: org.id,
      accountCode: r.account,
      orgUnitId: unitIds[r.unit],
      day: r.day,
      amount: r.amount,
      source: "synthetic:finance-feed",
    }));
    for (let i = 0; i < fin.length; i += 50_000) {
      const c = fin.slice(i, i + 50_000);
      await tx.execute(sql`
        insert into fin_actual (org_id, account_code, org_unit_id, day, amount, source)
        select * from unnest(${sql.param(c.map((r) => r.orgId))}::uuid[], ${sql.param(c.map((r) => r.accountCode))}::text[],
          ${sql.param(c.map((r) => r.orgUnitId))}::uuid[], ${sql.param(c.map((r) => r.day))}::date[], ${sql.param(c.map((r) => r.amount))}::float8[],
          ${sql.param(c.map((r) => r.source))}::text[])`);
    }
    const bud = budgets(firstDay.slice(0, 7), `${STORY_DAY.slice(0, 4)}-12`).map((r) => ({
      orgId: org.id,
      accountCode: r.account,
      orgUnitId: unitIds[r.unit],
      month: r.month,
      amount: r.amount,
    }));
    await tx.insert(s.finBudget).values(bud);

    await tx.insert(s.demoClock).values({ orgId: org.id, now: new Date(`${STORY_DAY}T05:00:00Z`) });
    // Market & competitors (E6): public data from the committed snapshots, shared by every epoch (idempotent).
    await loadMarket(tx);
    return { orgId: org.id, unitIds, userIds, kpiIds };
  });
}
