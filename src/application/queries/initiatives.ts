/**
 * Initiatives the viewer may read (ADR-008 §3): the read rule is the insight's. An initiative is visible when one of
 * the viewer's read scopes is among its participating units or their ancestors. Status and the M1–M5 flags are
 * derived in E3; this read model returns the recorded facts.
 */
import { and, arrayOverlaps, eq, inArray } from "drizzle-orm";
import type { Actor } from "@/domain/types";
import { barrier, initiative, milestone } from "@/infra/db/schema";
import type { DbOrTx } from "../db";
import { readScope } from "./insights";

export async function listInitiatives(db: DbOrTx, orgId: string, actor: Actor) {
  const scope = readScope(actor);
  if (!scope.length) return [];
  const rows = await db
    .select()
    .from(initiative)
    .where(and(eq(initiative.orgId, orgId), arrayOverlaps(initiative.visibleUnitIds, scope)));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [ms, bs] = await Promise.all([
    db.select().from(milestone).where(inArray(milestone.initiativeId, ids)),
    db.select().from(barrier).where(inArray(barrier.initiativeId, ids)),
  ]);
  return rows
    .map((r) => ({
      ...r,
      milestones: ms.filter((m) => m.initiativeId === r.id).sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
      barriers: bs.filter((b) => b.initiativeId === r.id),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
