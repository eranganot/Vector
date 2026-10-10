/**
 * market-v1 on the live data (plan v2, E6b; market-intelligence.md §4): public market data (CBS, the chains' price
 * files, reported results) against our own sales and prices, turned into insights through the detector's write path.
 * MK1 and MK4 need a run of daily price-file snapshots and stay quiet until one exists.
 */
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { addDays } from "@/domain/calendar";
import {
  MARKET_RULES,
  mk2,
  mk2AtRiskIls,
  mk3,
  mk3UpsideIls,
  mk6,
  mk6AtRiskIls,
  PRICE_ELASTICITY,
  priceLeads,
  SHARE_GAIN_UPLIFT,
} from "@/domain/detection/market-v1";
import { CATEGORIES, CATEGORY_WEIGHTS } from "@/domain/market";
import {
  competitor,
  competitorFigure,
  kpi,
  kpiObservation,
  marketPoint,
  marketSeries,
  orgUnit,
} from "@/infra/db/schema";
import { recordDetection, type DetectionResult } from "./commands/detection";
import type { AppContext } from "./context";
import { holderOf } from "./detector";

const ils = (n: number) => `₪${Math.round(n / 1000).toLocaleString("en-US")}k`;
const signed = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)}%`;
const CATEGORY_NAME: Record<string, string> = {
  dairy: "dairy",
  bakery: "bread & cereals",
  meat_fish: "meat & fish",
  drinks: "drinks",
  pantry: "pantry",
  snacks: "snacks",
  household: "household",
};
const MONTH = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const monthName = (period: string) => MONTH[Number(period.slice(5, 7)) - 1] ?? period;
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const generatedBy = `rule:${MARKET_RULES.name}@${MARKET_RULES.version}`;

/** Net sales in [from, to): the group, or one region's branches. */
async function salesBetween(ctx: AppContext, kpiId: string, from: string, to: string, regionId?: string) {
  const [r] = await ctx.db
    .select({ total: sql<number>`coalesce(sum(${kpiObservation.value}), 0)::float8` })
    .from(kpiObservation)
    .innerJoin(orgUnit, eq(orgUnit.id, kpiObservation.orgUnitId))
    .where(
      and(
        eq(kpiObservation.orgId, ctx.orgId),
        eq(kpiObservation.kpiId, kpiId),
        eq(orgUnit.type, "branch"),
        ...(regionId ? [eq(orgUnit.parentId, regionId)] : []),
        gte(kpiObservation.day, from),
        lt(kpiObservation.day, to),
      ),
    );
  return r?.total ?? 0;
}

export async function runMarketRules(ctx: AppContext): Promise<DetectionResult[]> {
  const asOf = ctx.clock.now().toISOString().slice(0, 10);
  const series = await ctx.db.select().from(marketSeries);
  if (!series.length) return [];
  const points = await ctx.db.select().from(marketPoint);
  const pts = (source: string, code: string) => {
    const s = series.find((x) => x.source === source && x.code === code);
    return s ? points.filter((p) => p.seriesId === s.id).sort((a, b) => a.period.localeCompare(b.period)) : [];
  };
  const units = await ctx.db.select().from(orgUnit).where(eq(orgUnit.orgId, ctx.orgId));
  const byCode = new Map(units.map((u) => [u.code, u]));
  const group = byCode.get("GROUP");
  const [sales] = await ctx.db
    .select()
    .from(kpi)
    .where(and(eq(kpi.orgId, ctx.orgId), eq(kpi.code, "net_sales")));
  if (!group || !sales) return [];

  // Our own figures (synthetic): weekly sales, and same-store growth over the last 13 weeks vs the 13 before.
  const weekly = await salesBetween(ctx, sales.id, addDays(asOf, -7), asOf);
  const recent = await salesBetween(ctx, sales.id, addDays(asOf, -91), asOf);
  const prior = await salesBetween(ctx, sales.id, addDays(asOf, -182), addDays(asOf, -91));
  const ourGrowth = prior > 0 ? (recent / prior - 1) * 100 : null;

  const results: DetectionResult[] = [];
  const now = ctx.clock.now();
  const trade = byCode.get("D-TRADE");
  const mkt = byCode.get("D-MKT");
  const fin = byCode.get("D-FIN");

  // ── MK2: CBS food falls while our prices rise, two months running ──
  const food = pts("cbs", "110050");
  const ours = pts("synthetic", "vector:price_index");
  const m2 = mk2(food, ours);
  if (m2 && trade) {
    const atRisk = mk2AtRiskIls(weekly, m2.gapPts);
    const tradeHead = await holderOf(ctx, trade.id, "department_manager");
    const finHead = fin ? await holderOf(ctx, fin.id, "department_manager") : undefined;
    const [a, b] = m2.months;
    const m1 = monthName(a.period);
    const mm2 = monthName(b.period);
    const url = food.at(-1)?.sourceUrl ?? "https://api.cbs.gov.il/index/";
    results.push(
      await recordDetection(ctx, {
        signal: {
          type: "market_price_divergence",
          source: "cbs+synthetic",
          detector: MARKET_RULES.name,
          detectorVersion: MARKET_RULES.version,
          observedAt: now,
          primaryUnitId: trade.id,
          measurements: {
            rule: "MK2",
            months: m2.months.map((m) => m.period).join(" · "),
            cbsMoM: m2.months.map((m) => signed(m.cbsPct)).join(" · "),
            oursMoM: m2.months.map((m) => signed(m.oursPct)).join(" · "),
            gapPts: m2.gapPts,
            weeklySalesIls: Math.round(weekly),
          },
          dedupeKey: `market:MK2:${m2.months.at(-1)!.period}`,
        },
        evidence: [
          {
            kind: "market_series",
            title: "Food prices (CBS 110050) vs our price index, month on month",
            sourceRef: "cbs:110050 · synthetic:vector:price_index",
            payload: {
              real: true,
              url,
              rows: [
                ...m2.months.map((m) => ({
                  label: monthName(m.period),
                  value: `CBS ${signed(m.cbsPct)} · ours ${signed(m.oursPct)}`,
                })),
                { label: "CBS food prices", value: "real (Central Bureau of Statistics)" },
                { label: "Our prices", value: "synthetic" },
              ],
            },
          },
        ],
        insight: {
          workstream: "risk",
          ownerDepartmentId: trade.id,
          title: `Our prices rose while food prices fell (${m1} and ${mm2})`,
          whatHappened: `CBS food prices fell ${signed(a.cbsPct)} and ${signed(b.cbsPct)} in ${m1} and ${mm2}; our price index rose ${signed(a.oursPct)} and ${signed(b.oursPct)}. We moved ${m2.gapPts.toFixed(1)} points against the market.`,
          whyItMatters: `Shoppers compare. At a price elasticity of ${PRICE_ELASTICITY}, about ${ils(atRisk)} of weekly sales is at risk if the gap holds.`,
          primaryUnitId: trade.id,
          affectedUnitIds: [group.id, ...(fin ? [fin.id] : []), ...(mkt ? [mkt.id] : [])],
          confidence: 0.75,
          priority: {
            compliance: 0,
            z: 1.5,
            impactIls: atRisk,
            breadth: "systemic",
            hoursToImpact: null,
            strategicWeight: 0.7,
            confidence: 0.75,
          },
          generatedBy,
        },
        recommendation: {
          statement: "Review the last two price moves against the market and roll back where we lead the rise",
          rationale: "Our prices went up in the two months the market's went down; the gap is what shoppers notice.",
          actions: [
            ...(tradeHead
              ? [
                  {
                    type: "price_change",
                    title: `Review the ${m1} and ${mm2} price increases against CBS food, by category`,
                    ownerUserId: tradeHead.id,
                    targetUnitIds: [group.id],
                    dueAt: new Date(now.getTime() + 5 * 86_400_000),
                    estimatedCost: 0,
                    params: { rule: "MK2", gapPts: m2.gapPts },
                  },
                ]
              : []),
            ...(finHead
              ? [
                  {
                    type: "notify_owner",
                    title: `Brief ${finHead.name} on the margin vs volume trade-off`,
                    ownerUserId: finHead.id,
                    targetUnitIds: [group.id],
                    estimatedCost: 0,
                    params: {},
                  },
                ]
              : []),
          ],
        },
      }),
    );
  }

  // ── MK3: a competitor's same-store sales ≤ −5% while ours grow ──
  const comps = await ctx.db.select().from(competitor);
  const figs = await ctx.db.select().from(competitorFigure);
  const day = [
    ...new Set(points.filter((p) => series.find((s) => s.id === p.seriesId)?.source === "basket").map((p) => p.period)),
  ]
    .sort()
    .at(-1);
  const idx = (chain: string, cat: string) => {
    const src = chain === "vector" ? "synthetic" : "basket";
    return pts(src, `${chain}:ALL:${cat}`).find((p) => p.period === day)?.value ?? null;
  };
  for (const c of comps) {
    const sss = figs
      .filter((f) => f.competitorId === c.id && f.metric === "same_store_sales" && f.kind === "reported")
      .sort((a, b) => b.period.localeCompare(a.period))[0];
    const m3 = mk3(sss?.value ?? null, ourGrowth);
    if (!m3 || !sss || !mkt) continue;
    const leads = priceLeads(
      Object.fromEntries(CATEGORIES.map((k) => [k, idx("vector", k)])),
      Object.fromEntries(CATEGORIES.map((k) => [k, idx(c.key, k)])),
    ).slice(0, 3);
    const upside = mk3UpsideIls(weekly);
    const mktHead = await holderOf(ctx, mkt.id, "department_manager");
    const leadText = leads.length
      ? leads.map((l) => `${CATEGORY_NAME[l.category]} (${l.ours.toFixed(1)} vs ${l.theirs.toFixed(1)})`).join(" · ")
      : "no category yet";
    results.push(
      await recordDetection(ctx, {
        signal: {
          type: "competitor_weakness",
          source: "filings+synthetic",
          detector: MARKET_RULES.name,
          detectorVersion: MARKET_RULES.version,
          observedAt: now,
          primaryUnitId: mkt.id,
          measurements: {
            rule: "MK3",
            competitor: c.key,
            period: sss.period,
            ...m3,
            priceLeads: leads.map((l) => `${l.category} ${l.ours}/${l.theirs}`).join(" · "),
          },
          dedupeKey: `market:MK3:${c.key}:${sss.period}`,
        },
        evidence: [
          {
            kind: "market_record",
            title: `${c.name}: reported results, ${sss.period}`,
            sourceRef: `filings:${c.key}`,
            payload: {
              real: true,
              url: sss.url,
              rows: [
                { label: "Same-store sales", value: signed(sss.value) },
                { label: "Source", value: sss.source },
              ],
            },
          },
          {
            kind: "market_record",
            title: `Basket index, ours vs ${c.name} (price files of ${day ?? "—"})`,
            sourceRef: `basket-index-v1:${day ?? ""}`,
            payload: {
              real: true,
              rows: [
                ...leads.map((l) => ({ label: CATEGORY_NAME[l.category], value: `${l.ours} vs ${l.theirs}` })),
                { label: c.name, value: "real (published price files)" },
                { label: "Our prices", value: "synthetic" },
              ],
            },
          },
        ],
        insight: {
          workstream: "opportunity",
          ownerDepartmentId: mkt.id,
          title: `${c.name} is shrinking (same-store ${signed(m3.competitorSss)}); we are growing`,
          whatHappened: `${c.name} reported same-store sales ${signed(m3.competitorSss)} for ${sss.period} (${sss.source}). Our same-store sales are ${signed(m3.ourGrowthPct)} over the last 13 weeks. We are cheaper than ${c.name} in ${leadText}.`,
          whyItMatters: `Their shoppers are looking elsewhere. A ${(SHARE_GAIN_UPLIFT * 100).toFixed(0)}% weekly lift from pushing the categories where we lead on price is worth about ${ils(upside)} a week.`,
          primaryUnitId: mkt.id,
          affectedUnitIds: [group.id, ...(trade ? [trade.id] : [])],
          confidence: 0.6,
          opportunity: {
            valueIls: upside,
            costIls: 25_000,
            reach: "systemic",
            hoursToClose: 24 * 30,
            strategicFit: 0.7,
            confidence: 0.6,
          },
          generatedBy,
        },
        recommendation: {
          statement: `Push the categories where we beat ${c.name} on price`,
          rationale:
            "A competitor losing same-store sales is a share-gain window; price leads are what bring switchers.",
          actions: mktHead
            ? [
                {
                  type: "campaign_change",
                  title: `Price-comparison campaign: ${leads.map((l) => CATEGORY_NAME[l.category]).join(" · ") || "our price leads"}`,
                  ownerUserId: mktHead.id,
                  targetUnitIds: [group.id],
                  dueAt: new Date(now.getTime() + 7 * 86_400_000),
                  estimatedCost: 25_000,
                  params: { rule: "MK3", competitor: c.key, categories: leads.map((l) => l.category) },
                },
              ]
            : [],
        },
      }),
    );
  }

  // ── MK6 (G-E6b): a category where we are ≥ 3% above the market median in a region, against every chain ──
  const chainName = (key: string) => comps.find((x) => x.key === key)?.name ?? key;
  const regionIdx = (chain: string, region: string, cat: string) => {
    const src = chain === "vector" ? "synthetic" : "basket";
    return pts(src, `${chain}:${region}:${cat}`).find((p) => p.period === day)?.value ?? null;
  };
  const chainKeys = [...new Set(series.filter((x) => x.source === "basket").map((x) => x.code.split(":")[0]))];
  for (const region of units.filter((u) => u.type === "region")) {
    for (const cat of CATEGORIES) {
      const m6 = mk6(
        regionIdx("vector", region.code, cat),
        Object.fromEntries(chainKeys.map((k) => [k, regionIdx(k, region.code, cat)])),
      );
      if (!m6 || !trade) continue;
      const regionWeekly = await salesBetween(ctx, sales.id, addDays(asOf, -7), asOf, region.id);
      // Category sales are not modelled per region: its share of the basket weights stands in (stated in the insight).
      const catWeekly = regionWeekly * CATEGORY_WEIGHTS[cat];
      const atRisk = mk6AtRiskIls(catWeekly, m6.gapPct);
      const tradeHead = await holderOf(ctx, trade.id, "department_manager");
      const regionHead = await holderOf(ctx, region.id, "regional_manager");
      const dearer = m6.vsChains.filter((c) => c.gapPct > 0);
      const vsText = m6.vsChains.map((c) => `${chainName(c.chain)}: ${signed(c.gapPct)}`).join(" · ");
      results.push(
        await recordDetection(ctx, {
          signal: {
            type: "market_price_gap",
            source: "basket+synthetic",
            detector: MARKET_RULES.name,
            detectorVersion: MARKET_RULES.version,
            observedAt: now,
            primaryUnitId: trade.id,
            measurements: {
              rule: "MK6",
              region: region.code,
              category: cat,
              ours: m6.ours,
              gapPct: m6.gapPct,
              vsChains: vsText,
              day: day ?? "",
            },
            dedupeKey: `market:MK6:${region.code}:${cat}`,
          },
          evidence: [
            {
              kind: "market_record",
              title: `${cap(CATEGORY_NAME[cat])} in ${region.name}: our price vs every chain (price files of ${day ?? "—"})`,
              sourceRef: `basket-index-v1:${day ?? ""}:${region.code}:${cat}`,
              payload: {
                real: true,
                rows: [
                  { label: "Market median", value: "100" },
                  { label: "Our index", value: m6.ours.toFixed(1) },
                  ...m6.vsChains.map((c) => ({
                    label: chainName(c.chain),
                    value: `${c.index.toFixed(1)} · ${signed(c.gapPct)}`,
                  })),
                  { label: "Chains", value: "real (published price files)" },
                  { label: "Our prices", value: "synthetic" },
                ],
              },
            },
          ],
          insight: {
            workstream: "risk",
            ownerDepartmentId: trade.id,
            title: `${cap(CATEGORY_NAME[cat])} in ${region.name} is ${signed(m6.gapPct)} above the market`,
            whatHappened: `Our ${CATEGORY_NAME[cat]} prices in ${region.name} are ${signed(m6.gapPct)} above the market median of the chains compared. We are dearer than ${dearer.length} of ${m6.vsChains.length} chains: ${vsText}.`,
            whyItMatters: `Shoppers compare. At a price elasticity of ${PRICE_ELASTICITY}, about ${ils(atRisk)} of weekly ${CATEGORY_NAME[cat]} sales in ${region.name} is at risk (category share of sales: ${Math.round(CATEGORY_WEIGHTS[cat] * 100)}%).`,
            primaryUnitId: trade.id,
            affectedUnitIds: [region.id, ...(mkt ? [mkt.id] : [])],
            confidence: 0.8,
            priority: {
              compliance: 0,
              z: Math.min(4, m6.gapPct / 3),
              impactIls: atRisk,
              breadth: "regional",
              hoursToImpact: null,
              strategicWeight: 0.7,
              confidence: 0.8,
            },
            generatedBy,
          },
          recommendation: {
            statement: `Bring ${CATEGORY_NAME[cat]} prices in ${region.name} back to the market`,
            rationale:
              "The gap is measured on the same products in the same region's stores; the cheapest fix is a price move on the items that drive it.",
            actions: [
              ...(tradeHead
                ? [
                    {
                      type: "price_change",
                      title: `Reprice ${CATEGORY_NAME[cat]} in ${region.name} toward the market median`,
                      ownerUserId: tradeHead.id,
                      targetUnitIds: [region.id],
                      dueAt: new Date(now.getTime() + 3 * 86_400_000),
                      estimatedCost: 0,
                      params: { rule: "MK6", region: region.code, category: cat, gapPct: m6.gapPct },
                    },
                  ]
                : []),
              ...(regionHead
                ? [
                    {
                      type: "notify_owner",
                      title: `Brief ${regionHead.name} on the ${CATEGORY_NAME[cat]} price gap`,
                      ownerUserId: regionHead.id,
                      targetUnitIds: [region.id],
                      estimatedCost: 0,
                      params: {},
                    },
                  ]
                : []),
            ],
          },
        }),
      );
    }
  }

  // MK1 and MK4 compare daily snapshots; with one day of price files they cannot fire (market-intelligence.md §7).
  return results;
}
