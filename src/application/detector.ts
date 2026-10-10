/**
 * Runs the KPI deviation detector over every branch as of the (demo) clock's day and turns findings
 * into insights with a recommendation (rule-generated; AI arrives in Phase 5).
 */
import { and, eq, gte, lt } from "drizzle-orm";
import { addDays } from "@/domain/calendar";
import { DETECTOR, detectDeviation, KPI_CONFIG, type Deviation } from "@/domain/detection/kpi-deviation";
import { kpi, kpiObservation, orgUnit, roleAssignment, user } from "@/infra/db/schema";
import type { AppContext } from "./context";
import { recordDetection, type DetectionResult } from "./commands/detection";
import { runMarketRules } from "./market-rules";

const ils = (n: number) => `₪${Math.round(n / 1000).toLocaleString("en-US")}k`;
const pct = (x: number) => `${(Math.abs(x) * 100).toFixed(1)}%`;

/**
 * The head of a unit for a role: the person work is assigned to. A unit may have several managers
 * (Supply Chain has Noa and Ben), so this never picks "the first row": it asks for the flagged head.
 */
export async function holderOf(ctx: AppContext, unitId: string, role: "regional_manager" | "department_manager") {
  const heads = await ctx.db
    .select({ id: user.id, name: user.name })
    .from(roleAssignment)
    .innerJoin(user, eq(user.id, roleAssignment.userId))
    .where(and(eq(roleAssignment.orgUnitId, unitId), eq(roleAssignment.role, role), eq(roleAssignment.isHead, true)));
  if (heads.length > 1) throw new Error(`unit ${unitId} has ${heads.length} heads for ${role}; expected one`);
  return heads[0];
}

export async function runDetector(ctx: AppContext): Promise<DetectionResult[]> {
  const asOf = ctx.clock.now().toISOString().slice(0, 10);
  const units = await ctx.db.select().from(orgUnit).where(eq(orgUnit.orgId, ctx.orgId));
  const byCode = new Map(units.map((u) => [u.code, u]));
  const branches = units.filter((u) => u.type === "branch");
  const kpis = await ctx.db.select().from(kpi).where(eq(kpi.orgId, ctx.orgId));
  const kpiByCode = new Map(kpis.map((k) => [k.code, k]));
  const obs = await ctx.db
    .select()
    .from(kpiObservation)
    .where(
      and(
        eq(kpiObservation.orgId, ctx.orgId),
        gte(kpiObservation.day, addDays(asOf, -42)),
        lt(kpiObservation.day, asOf),
      ),
    );

  const results: DetectionResult[] = [];
  for (const b of branches) {
    const found: Record<string, Deviation> = {};
    for (const code of Object.keys(KPI_CONFIG)) {
      const k = kpiByCode.get(code);
      if (!k) continue;
      const series = obs
        .filter((o) => o.orgUnitId === b.id && o.kpiId === k.id)
        .map((o) => ({ day: o.day, value: o.value }));
      const dev = detectDeviation(series, asOf, KPI_CONFIG[code]);
      if (dev) found[code] = dev;
    }
    const sales = found.net_sales;
    if (!sales) continue; // Phase 2 rules interpret sales deviations; others become insights in Phase 3.

    const region = units.find((u) => u.id === b.parentId)!;
    const supply = byCode.get("D-SUPPLY");
    const store = byCode.get("D-STORE");
    const osa = found.osa;
    const weeklyImpact = Math.abs(sales.expectedTotal - sales.actualTotal) * (7 / sales.days.length);

    // Interpretation rule: an OSA drop at the same branch explains a sales drop (availability, not demand).
    const siblings = branches.filter((x) => x.parentId === b.parentId && x.id !== b.id);
    const osaKpi = kpiByCode.get("osa")!;
    const osaAvg = (unitId: string) => {
      const xs = obs.filter((o) => o.orgUnitId === unitId && o.kpiId === osaKpi.id && o.day >= addDays(asOf, -7));
      return xs.reduce((s, o) => s + o.value, 0) / Math.max(1, xs.length);
    };
    const source = siblings.sort((x, y) => osaAvg(y.id) - osaAvg(x.id))[0];
    const branchManager = await holderOf(ctx, b.id, "regional_manager");
    const supplyManager = supply ? await holderOf(ctx, supply.id, "department_manager") : undefined;

    const actions: Parameters<typeof recordDetection>[1]["recommendation"]["actions"] = [];
    if (osa && source && supplyManager) {
      actions.push({
        type: "inventory_transfer",
        title: `Transfer top-category stock ${source.name} → ${b.name}`,
        ownerUserId: supplyManager.id,
        targetUnitIds: [b.id],
        dueAt: new Date(ctx.clock.now().getTime() + 36 * 3_600_000),
        estimatedCost: 6000,
        params: { sourceUnitId: source.id, sourceUnitName: source.name, categories: ["dairy", "bakery"] },
      });
    }
    if (branchManager) {
      actions.push({
        type: "notify_owner",
        title: `Brief ${branchManager.name} on the sales drop${osa ? " and incoming stock" : ""}`,
        ownerUserId: branchManager.id,
        targetUnitIds: [b.id],
        estimatedCost: 0,
        params: {},
      });
    }

    const r = await recordDetection(ctx, {
      signal: {
        type: "kpi_deviation",
        source: "kpi_observation",
        detector: DETECTOR.name,
        detectorVersion: DETECTOR.version,
        observedAt: ctx.clock.now(),
        primaryUnitId: b.id,
        measurements: {
          kpi: "net_sales",
          change: sales.change,
          z: sales.z,
          window: [sales.windowStart, sales.windowEnd],
          ...(osa ? { osaChangePts: osa.change, osaZ: osa.z } : {}),
        },
        dedupeKey: `kpi_deviation:net_sales:${b.id}`,
      },
      evidence: [
        {
          kind: "kpi_series",
          title: `Net sales vs. usual level, ${b.name}`,
          sourceRef: "kpi_observation:net_sales",
          payload: { unit: "ILS", days: sales.days },
        },
        ...(osa
          ? [
              {
                kind: "kpi_series",
                title: `On-shelf availability vs. usual level, ${b.name}`,
                sourceRef: "kpi_observation:osa",
                payload: { unit: "pct", days: osa.days },
              },
            ]
          : []),
      ],
      insight: {
        title: `${b.name} net sales −${pct(sales.change)} vs. usual`,
        whatHappened: `Net sales at ${b.name} were ${pct(sales.change)} below their usual level over ${sales.days.length} trading days to ${sales.windowEnd} (${ils(sales.actualTotal)} vs. ${ils(sales.expectedTotal)} expected).`,
        whyItMatters: osa
          ? `About ${ils(weeklyImpact)} of weekly sales is at stake. On-shelf availability is ${Math.abs(osa.change).toFixed(1)} points below usual, which points to a stock problem rather than weaker demand.`
          : `About ${ils(weeklyImpact)} of weekly sales is at stake. No availability problem was found; the cause needs investigation.`,
        primaryUnitId: b.id,
        affectedUnitIds: [region.id, ...(osa && supply ? [supply.id] : []), ...(store ? [store.id] : [])],
        ownerDepartmentId: store?.id,
        confidence: Math.min(0.95, 0.75 + 0.05 * (sales.days.length - 3)),
        priority: {
          compliance: 0,
          z: sales.z,
          impactIls: weeklyImpact,
          breadth: "isolated",
          hoursToImpact: null,
          strategicWeight: kpiByCode.get("net_sales")!.strategicWeight,
          confidence: 0.9,
        },
        generatedBy: `rule:${DETECTOR.name}@${DETECTOR.version}`,
      },
      recommendation: {
        statement:
          osa && source
            ? `Restore availability at ${b.name} with a stock transfer from ${source.name}`
            : `Investigate the sales drop at ${b.name}`,
        rationale: osa
          ? "Sales fell where and when availability fell; replenishing the gap is the fastest lever."
          : "No operational cause detected yet.",
        actions,
      },
    });
    results.push(r);
  }
  // Plan v2 (E6b): market-v1 on public market data, through the same write path.
  results.push(...(await runMarketRules(ctx)));
  return results;
}
