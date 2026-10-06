/**
 * Seeds a fresh organization epoch with the synthetic organization (org.ts). Never deletes:
 * previous organizations are deactivated so their audit history stays intact (ADR-004).
 */
import { eq, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { addDays } from "@/domain/calendar";
import * as s from "@/infra/db/schema";
import { generateDay, generateDepartmentDay } from "./generator";
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
    for (let i = 0; i < rows.length; i += 1000) await tx.insert(s.kpiObservation).values(rows.slice(i, i + 1000));

    await tx.insert(s.demoClock).values({ orgId: org.id, now: new Date(`${STORY_DAY}T05:00:00Z`) });
    return { orgId: org.id, unitIds, userIds, kpiIds };
  });
}
