/**
 * Seeds the scenario catalog (docs/specs/scenarios.md) into a fresh demo epoch: each catalog item enters
 * through the detector's normal write path (signal → evidence → insight → recommended decision →
 * proposed actions, all audited), and a few are then moved along by personas through the normal,
 * authorized commands, so the demo opens mid-flight: decisions taken, approvals waiting.
 */
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { addDays } from "@/domain/calendar";
import { kpi, kpiObservation, orgUnit, user } from "@/infra/db/schema";
import { CATALOG, type CatalogItem } from "@/infra/seed/catalog";
import { recordDetection, type DetectionResult } from "./commands/detection";
import { acceptDecision, acknowledgeInsight, executeReadyActions } from "./commands/lifecycle";
import { loadUserActor, type AppContext } from "./context";

export const CATALOG_SOURCE = "scenario-catalog@1";

async function kpiEvidence(ctx: AppContext, item: CatalogItem, unitIdByCode: Map<string, string>) {
  if (!item.evidence) return [];
  const asOf = ctx.clock.now().toISOString().slice(0, 10);
  const [k] = await ctx.db
    .select()
    .from(kpi)
    .where(and(eq(kpi.orgId, ctx.orgId), eq(kpi.code, item.evidence.kpi)));
  if (!k) return [];
  // A region in the evidence list stands for its branches.
  const units = await ctx.db.select().from(orgUnit).where(eq(orgUnit.orgId, ctx.orgId));
  const ids = item.evidence.units.flatMap((code) => {
    const id = unitIdByCode.get(code)!;
    const u = units.find((x) => x.id === id)!;
    return u.type === "region" ? units.filter((x) => x.parentId === id).map((x) => x.id) : [id];
  });
  const obs = await ctx.db
    .select()
    .from(kpiObservation)
    .where(
      and(
        eq(kpiObservation.kpiId, k.id),
        inArray(kpiObservation.orgUnitId, ids),
        gte(kpiObservation.day, addDays(asOf, -56)),
        lt(kpiObservation.day, asOf),
      ),
    );
  const byDay = new Map<string, number[]>();
  for (const o of obs) byDay.set(o.day, [...(byDay.get(o.day) ?? []), o.value]);
  const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
  const days = [...byDay.keys()].sort();
  const early = days.filter((d) => d < addDays(asOf, -28)).map((d) => mean(byDay.get(d)!));
  const expected = k.target ?? (early.length ? mean(early) : 0);
  const recent = days.filter((d) => d >= addDays(asOf, -21));
  return [
    {
      kind: "kpi_series",
      title: item.evidence.title,
      sourceRef: `kpi_observation:${k.code}`,
      payload: {
        unit: k.unit === "ILS" ? "ILS" : k.unit === "pct" ? "pct" : k.unit,
        expectedIs: k.target !== null ? "target" : "usual level",
        days: recent.map((d) => ({
          day: d,
          actual: Math.round(mean(byDay.get(d)!) * 100) / 100,
          expected: Math.round(expected * 100) / 100,
        })),
      },
    },
  ];
}

export async function seedCatalog(ctx: AppContext): Promise<DetectionResult[]> {
  const units = await ctx.db.select().from(orgUnit).where(eq(orgUnit.orgId, ctx.orgId));
  const unitIdByCode = new Map(units.map((u) => [u.code, u.id]));
  const people = await ctx.db.select().from(user).where(eq(user.orgId, ctx.orgId));
  const userId = (key: string) => {
    const p = people.find((x) => x.email === `${key}@vector-retail.example`);
    if (!p) throw new Error(`catalog: no seeded user ${key}`);
    return p.id;
  };
  const uid = (code: string) => {
    const id = unitIdByCode.get(code);
    if (!id) throw new Error(`catalog: no unit ${code}`);
    return id;
  };
  const now = ctx.clock.now();
  const results: DetectionResult[] = [];

  for (const item of CATALOG) {
    const evidence = await kpiEvidence(ctx, item, unitIdByCode);
    const r = await recordDetection(ctx, {
      signal: {
        type: item.signalType,
        source: item.source,
        detector: "scenario-catalog",
        detectorVersion: "1",
        observedAt: now,
        primaryUnitId: uid(item.primary),
        measurements: { scenario: item.id, ...item.facts },
        dedupeKey: `catalog:${item.id}`,
      },
      evidence: [
        ...evidence,
        {
          kind: "source_record",
          title: `Source record (${item.source.replace(/_/g, " ")}, synthetic)`,
          sourceRef: `${item.source}:${item.id}`,
          payload: item.facts,
        },
      ],
      insight: {
        workstream: item.workstream,
        ownerDepartmentId: uid(item.owner),
        title: item.title,
        whatHappened: item.whatHappened,
        whyItMatters: item.whyItMatters,
        primaryUnitId: uid(item.primary),
        affectedUnitIds: item.affected.map(uid),
        confidence: item.confidence,
        ...(item.workstream === "risk"
          ? {
              priority: {
                z: item.z,
                impactIls: item.impactIls,
                breadth: item.breadth,
                hoursToImpact: item.hoursToImpact,
                strategicWeight: item.strategicWeight,
                compliance: item.compliance,
                confidence: item.confidence,
                ...(item.costLine ? { costLine: item.costLine } : {}),
              },
            }
          : {
              opportunity: {
                valueIls: item.valueIls,
                costIls: item.costIls,
                reach: item.reach,
                hoursToClose: item.hoursToClose,
                strategicFit: item.strategicFit,
                confidence: item.confidence,
              },
            }),
        generatedBy: CATALOG_SOURCE,
      },
      recommendation: {
        statement: item.recommendation.statement,
        rationale: item.recommendation.rationale,
        actions: item.recommendation.actions.map((a) => ({
          type: a.type,
          title: a.title,
          ownerUserId: userId(a.owner),
          targetUnitIds: a.targets.map(uid),
          dueAt: new Date(now.getTime() + a.dueHours * 3_600_000),
          estimatedCost: a.cost,
          params: a.params ?? {},
        })),
      },
    });
    results.push(r);

    for (const step of item.steps ?? []) {
      if ("accept" in step) {
        const actor = await loadUserActor(ctx.db, ctx.orgId, userId(step.accept), {
          sessionId: "seed:catalog",
          viaDemoSwitcher: false,
        });
        await acceptDecision(ctx, actor, r.decisionId!, step.rationale);
      } else {
        const actor = await loadUserActor(ctx.db, ctx.orgId, userId(step.acknowledge), {
          sessionId: "seed:catalog",
          viaDemoSwitcher: false,
        });
        await acknowledgeInsight(ctx, actor, r.insightId);
      }
    }
  }
  await executeReadyActions(ctx);
  return results;
}
