import { and, eq } from "drizzle-orm";
import { DomainError } from "@/domain/errors";
import type { OrgFacts } from "@/domain/policy/approval-rules";
import type { UnitRef } from "@/domain/types";
import { orgUnit } from "@/infra/db/schema";
import { toUnitRef } from "../context";
import type { DbOrTx } from "../db";

export const SYSTEM = {
  detector: { kind: "system", id: "system:detector" },
  policy: { kind: "system", id: "system:policy" },
  executor: { kind: "system", id: "system:executor" },
  evaluator: { kind: "system", id: "system:outcome-evaluator" },
  clock: { kind: "system", id: "system:clock" },
} as const;

export function notFound(what: string): never {
  throw new DomainError("NotFound", `${what} not found`);
}

export async function unitsByIds(db: DbOrTx, orgId: string, ids: string[]): Promise<UnitRef[]> {
  const rows = await db.select().from(orgUnit).where(eq(orgUnit.orgId, orgId));
  const map = new Map(rows.map((r) => [r.id, toUnitRef(r)]));
  return ids.map((id) => map.get(id) ?? notFound(`unit ${id}`));
}

export async function unitByCode(db: DbOrTx, orgId: string, code: string): Promise<UnitRef | undefined> {
  const [r] = await db
    .select()
    .from(orgUnit)
    .where(and(eq(orgUnit.orgId, orgId), eq(orgUnit.code, code)));
  return r ? toUnitRef(r) : undefined;
}

export async function orgFacts(db: DbOrTx, orgId: string, budgetDepartmentCode?: string): Promise<OrgFacts> {
  const group = await unitByCode(db, orgId, "GROUP");
  if (!group) notFound("group unit");
  return {
    group,
    supplyChain: await unitByCode(db, orgId, "D-SUPPLY"),
    legal: await unitByCode(db, orgId, "D-LEGAL"),
    budgetDepartment: budgetDepartmentCode ? await unitByCode(db, orgId, budgetDepartmentCode) : undefined,
  };
}

/** All ids on the paths of these units: who can see an entity that touches them. */
export const visibleIds = (units: UnitRef[]) => [...new Set(units.flatMap((u) => u.pathIds))];
