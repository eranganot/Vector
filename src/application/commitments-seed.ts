/**
 * Seeds the commitment register and dependency graph (src/infra/seed/commitments.ts) through the normal commands,
 * played by each owner (audited like the catalog's steps), then runs the commitment monitor once.
 */
import { eq } from "drizzle-orm";
import { orgUnit, user } from "@/infra/db/schema";
import { COMMITMENTS, DEPENDENCIES } from "@/infra/seed/commitments";
import { completeCommitment, recordCommitment, recordDependency, runCommitmentMonitor } from "./commands/commitments";
import { type AppContext, loadUserActor } from "./context";

export async function seedCommitments(ctx: AppContext, catalogInsightIds: Map<string, string>) {
  const units = await ctx.db.select().from(orgUnit).where(eq(orgUnit.orgId, ctx.orgId));
  const people = await ctx.db.select().from(user).where(eq(user.orgId, ctx.orgId));
  const uid = (code: string) => {
    const u = units.find((x) => x.code === code);
    if (!u) throw new Error(`commitments: no unit ${code}`);
    return u.id;
  };
  const person = (key: string) => {
    const p = people.find((x) => x.email === `${key}@vector-retail.example`);
    if (!p) throw new Error(`commitments: no seeded user ${key}`);
    return p.id;
  };
  const actor = (key: string) =>
    loadUserActor(ctx.db, ctx.orgId, person(key), {
      sessionId: `seed:${key}`,
      viaDemoSwitcher: true,
      sessionAgeHours: 0,
    });

  const ids = new Map<string, string>();
  for (const c of COMMITMENTS) {
    const r = await recordCommitment(
      ctx,
      await actor(c.owner),
      {
        title: c.title,
        ownerUserId: person(c.owner),
        ownerUnitId: uid(c.unit),
        beneficiaryUnitIds: c.beneficiaries.map(uid),
        source: c.source,
        dueAt: new Date(c.dueAt),
        impactIls: c.impactIls,
        compliance: c.compliance,
        effects: c.effects,
        insightId: c.catalog ? catalogInsightIds.get(c.catalog) : undefined,
      },
      { madeAt: new Date(c.madeAt) },
    );
    ids.set(c.key, r.id);
    if (c.done) await completeCommitment(ctx, await actor(c.owner), r.id, { at: new Date(c.done) });
  }
  for (const d of DEPENDENCIES) {
    await recordDependency(ctx, await actor(d.by), {
      commitmentId: ids.get(d.on)!,
      downstreamUnitId: uid(d.unit),
      downstreamCommitmentId: d.downstream ? ids.get(d.downstream)! : null,
      needBy: new Date(d.needBy),
      impactIls: d.impactIls,
      note: d.note,
    });
  }
  const monitor = await runCommitmentMonitor(ctx);
  return { commitments: ids, monitor };
}
