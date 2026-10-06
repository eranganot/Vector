/**
 * Seeds the cross-department initiatives (src/infra/seed/initiatives.ts) through the audited command, each recorded by
 * its sponsor, linked to the catalog insights and commitments that tell its story (plan v2, E1c).
 */
import { eq } from "drizzle-orm";
import { orgUnit, user } from "@/infra/db/schema";
import { INITIATIVES } from "@/infra/seed/initiatives";
import { recordInitiative } from "./commands/initiatives";
import { type AppContext, loadUserActor } from "./context";

export async function seedInitiatives(
  ctx: AppContext,
  catalogInsightIds: Map<string, string>,
  commitmentIds: Map<string, string>,
) {
  const units = await ctx.db.select().from(orgUnit).where(eq(orgUnit.orgId, ctx.orgId));
  const people = await ctx.db.select().from(user).where(eq(user.orgId, ctx.orgId));
  const uid = (code: string) => units.find((x) => x.code === code)?.id ?? fail(`initiatives: no unit ${code}`);
  const person = (key: string) =>
    people.find((x) => x.email === `${key}@vector-retail.example`)?.id ?? fail(`initiatives: no seeded user ${key}`);
  const ids = new Map<string, string>();
  for (const i of INITIATIVES) {
    const actor = await loadUserActor(ctx.db, ctx.orgId, person(i.sponsor), {
      sessionId: `seed:${i.sponsor}`,
      viaDemoSwitcher: true,
      sessionAgeHours: 0,
    });
    const id = await recordInitiative(ctx, actor, {
      key: i.key,
      title: i.title,
      kind: i.kind,
      sponsorUserId: person(i.sponsor),
      ownerUnitId: uid(i.owner),
      participatingUnitIds: i.participants.map(uid),
      budgetIls: i.budgetIls,
      spentIls: i.spentIls,
      valueIls: i.valueIls,
      startsOn: i.startsOn,
      endsOn: i.endsOn,
      commitmentIds: i.commitments.map((k) => commitmentIds.get(k) ?? fail(`initiatives: no commitment ${k}`)),
      insightIds: i.catalog.map((c) => catalogInsightIds.get(c) ?? fail(`initiatives: no catalog story ${c}`)),
      milestones: i.milestones.map((m) => ({ ...m, ownerUnitId: uid(m.owner) })),
      barriers: i.barriers.map((b) => ({ ...b, ownerUnitId: uid(b.owner) })),
    });
    ids.set(i.key, id);
  }
  return ids;
}

function fail(msg: string): never {
  throw new Error(msg);
}
