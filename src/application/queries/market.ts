/**
 * Market & competitors read model (plan v2, E6; market-intelligence.md §5, layout v3). Public market data (CBS, the
 * chains' price files, reported results) next to VECTOR Retail Group's own synthetic prices. Every figure carries its
 * source and date; estimates are labelled.
 */
import { and, arrayOverlaps, desc, eq, gte, inArray, like, lt, sql } from "drizzle-orm";
import { BASKET_MODEL, CATEGORIES, CBS_FOR_CATEGORY, yoy, type Category } from "@/domain/market";
import type { Actor } from "@/domain/types";
import {
  competitor,
  competitorFigure,
  demoClock,
  insight,
  kpi,
  kpiObservation,
  marketPoint,
  marketPriceFile,
  marketSeries,
  orgUnit,
} from "@/infra/db/schema";
import type { DbOrTx } from "../db";
import { readScope } from "./insights";

export const MARKET_REGIONS = ["ALL", "NORTH", "COAST", "CENTER", "JERUSALEM", "SOUTH"] as const;
export type MarketRegion = (typeof MARKET_REGIONS)[number];
const REGION_NAME: Record<MarketRegion, string> = {
  ALL: "All regions",
  NORTH: "North",
  COAST: "Coast",
  CENTER: "Center",
  JERUSALEM: "Jerusalem",
  SOUTH: "South",
};
const CHAIN_ORDER = ["vector", "shufersal", "rami_levy", "yohananof", "osher_ad", "tiv_taam"];

export async function marketView(db: DbOrTx, actor: Actor, opts: { region?: MarketRegion; orgId?: string } = {}) {
  if (actor.kind !== "user" || readScope(actor).length === 0) return null;
  const region = opts.region ?? "ALL";
  const series = await db.select().from(marketSeries);
  if (!series.length) return null;
  const points = await db
    .select()
    .from(marketPoint)
    .where(
      inArray(
        marketPoint.seriesId,
        series.map((s) => s.id),
      ),
    );
  const pts = (source: string, code: string) => {
    const s = series.find((x) => x.source === source && x.code === code);
    return s ? points.filter((p) => p.seriesId === s.id).sort((a, b) => a.period.localeCompare(b.period)) : [];
  };
  const [comps, figs, files] = await Promise.all([
    db.select().from(competitor),
    db.select().from(competitorFigure),
    db.select().from(marketPriceFile),
  ]);
  const nameOf = (key: string) =>
    key === "vector" ? "VECTOR Retail Group" : (comps.find((c) => c.key === key)?.name ?? key);

  // ── CBS (real) and our price index (synthetic) ──
  const food = pts("cbs", "110050");
  const ours = pts("synthetic", "vector:price_index");
  const lastFood = food.at(-1);
  const rebase = (xs: typeof food) =>
    xs.map((p) => ({ period: p.period, value: Math.round((p.value / xs[0].value) * 1000) / 10 }));
  /** CBS's published y/y for a code, last month. */
  const cbsYoy = (code: string) => pts("cbs", `${code}:yoy`).at(-1)?.value ?? null;
  const momOf = (xs: typeof food) =>
    xs.length > 1 ? Math.round((xs.at(-1)!.value / xs.at(-2)!.value - 1) * 1000) / 10 : null;
  const cbsByCategory = CATEGORIES.filter((c) => CBS_FOR_CATEGORY[c])
    .map((c) => {
      const s = series.find((x) => x.source === "cbs" && x.code === CBS_FOR_CATEGORY[c]);
      const p = pts("cbs", CBS_FOR_CATEGORY[c]!);
      return {
        category: c,
        cbsName: s?.name ?? "",
        yoy: cbsYoy(CBS_FOR_CATEGORY[c]!),
        mom: momOf(p),
        url: p.at(-1)?.sourceUrl ?? "",
      };
    })
    .filter((x) => x.yoy !== null);

  // ── Basket (real chains, synthetic us) ──
  const days = [
    ...new Set(points.filter((p) => series.find((s) => s.id === p.seriesId)?.source === "basket").map((p) => p.period)),
  ].sort();
  const day = days.at(-1) ?? null;
  const chainKeys = [...new Set(series.filter((s) => s.source === "basket").map((s) => s.code.split(":")[0]))];
  const indexOf = (chain: string, reg: string, cat: string, d = day) => {
    const src = chain === "vector" ? "synthetic" : "basket";
    const code = chain === "vector" ? `vector:${reg}:${cat}` : `${chain}:${reg}:${cat}`;
    return pts(src, code).find((p) => p.period === d)?.value ?? null;
  };
  const chains = CHAIN_ORDER.filter((c) => c === "vector" || chainKeys.includes(c)).filter(
    (c) => indexOf(c, region, "all") !== null,
  );
  const basket = chains
    .map((c) => ({ chain: c, name: nameOf(c), synthetic: c === "vector", index: indexOf(c, region, "all")! }))
    .sort((a, b) => a.index - b.index);
  const heatmap = chains.map((c) => ({
    chain: c,
    name: nameOf(c),
    synthetic: c === "vector",
    cells: CATEGORIES.map((cat) => ({ category: cat, index: indexOf(c, region, cat) })),
  }));
  const history = chains.map((c) => ({
    chain: c,
    name: nameOf(c),
    points: days.map((d) => ({ day: d, index: indexOf(c, region, "all", d) })).filter((p) => p.index !== null),
  }));
  const regionFiles = files.filter((f) => f.day === day && (region === "ALL" || f.region === region));

  // ── Competitors (reported, sourced; store counts are estimates) ──
  const fig = (key: string, metric: string) => {
    const c = comps.find((x) => x.key === key);
    const f =
      c &&
      figs
        .filter((x) => x.competitorId === c.id && x.metric === metric)
        .sort((a, b) => b.period.localeCompare(a.period))[0];
    return f
      ? {
          value: f.value,
          unit: f.unit,
          kind: f.kind,
          period: f.period,
          source: f.source,
          url: f.url,
          asOf: f.asOf,
          method: f.method,
        }
      : null;
  };
  const competitors = CHAIN_ORDER.filter((k) => k !== "vector" && comps.some((c) => c.key === k)).map((k) => {
    const c = comps.find((x) => x.key === k)!;
    return {
      key: k,
      name: c.name,
      listed: c.listed,
      ticker: c.ticker,
      revenue: fig(k, "revenue"),
      growth: fig(k, "revenue_growth"),
      sameStore: fig(k, "same_store_sales"),
      netProfit: fig(k, "net_profit"),
      grossMargin: fig(k, "gross_margin"),
      operatingMargin: fig(k, "operating_margin"),
      stores: fig(k, "store_count"),
      basket: indexOf(k, region, "all"),
    };
  });
  // ── What changed outside: market-v1 insights in the viewer's scope (E6b) ──
  const changed = opts.orgId
    ? (
        await db
          .select({
            id: insight.id,
            workstream: insight.workstream,
            title: insight.title,
            whyItMatters: insight.whyItMatters,
            priorityBand: insight.priorityBand,
            flowStatus: insight.status,
            createdAt: insight.createdAt,
            measurements: insight.priorityBreakdown,
          })
          .from(insight)
          .where(
            and(
              eq(insight.orgId, opts.orgId),
              like(insight.generatedBy, "rule:market-v1@%"),
              arrayOverlaps(insight.visibleUnitIds, readScope(actor)),
            ),
          )
          .orderBy(desc(insight.priorityScore))
      ).map(({ measurements, ...r }) => ({
        ...r,
        impactIls:
          (measurements as { input?: { impactIls?: number; valueIls?: number } } | null)?.input?.impactIls ??
          (measurements as { input?: { valueIls?: number } } | null)?.input?.valueIls ??
          null,
      }))
    : [];
  const growth = await growthView(db, opts.orgId, {
    comps,
    figs,
    marketSize: pts("storenext", "barcoded_fnb_2025").at(-1) ?? null,
    marketSizeSeries: series.find((x) => x.source === "storenext") ?? null,
    avgItemPrice: pts("derived", "basket:avg_item_price").at(-1)?.value ?? null,
    ourBasketIndex: indexOf("vector", "ALL", "all"),
  });
  const vectorIdx = indexOf("vector", region, "all");
  const leader = competitors.find((c) => c.key === "shufersal");
  return {
    model: BASKET_MODEL,
    region,
    regionName: REGION_NAME[region],
    regions: MARKET_REGIONS.map((r) => ({ key: r, name: REGION_NAME[r] })),
    day,
    days,
    tiles: {
      foodYoy: cbsYoy("110050"),
      foodMonth: lastFood?.period ?? null,
      cpiYoy: cbsYoy("120010"),
      ourYoy: yoy(ours),
      ourBasket: vectorIdx,
      cheapest: basket.find((b) => !b.synthetic) ?? null,
      leaderSss: leader?.sameStore ?? null,
    },
    foodVsOurs: { food: rebase(food), ours: rebase(ours), foodUrl: food.at(-1)?.sourceUrl ?? "" },
    cbsByCategory,
    basket,
    heatmap,
    history,
    competitors,
    growth,
    changed,
    sources: {
      cbs: {
        url: "https://api.cbs.gov.il/index/",
        month: lastFood?.period ?? null,
        fetchedAt: lastFood?.fetchedAt ?? null,
      },
      priceFiles: {
        day,
        files: regionFiles.length,
        chains: [...new Set(regionFiles.map((f) => f.chain))].map(nameOf),
        stores: regionFiles.map((f) => ({
          chain: nameOf(f.chain),
          store: f.storeName,
          region: f.region,
          url: f.url,
          sha256: f.sha256,
          items: f.items,
        })),
      },
      filings: [
        ...new Map(
          figs.filter((f) => f.kind === "reported").map((f) => [f.url, { source: f.source, url: f.url, asOf: f.asOf }]),
        ).values(),
      ],
    },
  };
}

export type MarketView = NonNullable<Awaited<ReturnType<typeof marketView>>>;
export type { Category };

const QUARTER_DAYS = (q: string) => {
  const [y, n] = q.split("-Q").map(Number);
  const start = Date.UTC(y, (n - 1) * 3, 1);
  return {
    start: new Date(start).toISOString().slice(0, 10),
    end: new Date(Date.UTC(y, n * 3, 1)).toISOString().slice(0, 10),
  };
};
const quarterOf = (d: string) => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
const CHAIN_KEYS = ["shufersal", "rami_levy", "yohananof", "osher_ad", "tiv_taam"];

/**
 * Growth & expansion (G-E6a): reported quarterly results for the listed chains (8 quarters), estimates labelled, and
 * VECTOR Retail Group's own synthetic figures computed from its sales data. A figure a chain does not publish is null
 * ("not reported"), never filled in.
 */
async function growthView(
  db: DbOrTx,
  orgId: string | undefined,
  m: {
    comps: (typeof competitor.$inferSelect)[];
    figs: (typeof competitorFigure.$inferSelect)[];
    marketSize: typeof marketPoint.$inferSelect | null;
    marketSizeSeries: typeof marketSeries.$inferSelect | null;
    avgItemPrice: number | null;
    ourBasketIndex: number | null;
  },
) {
  const series = (key: string, metric: string) => {
    const c = m.comps.find((x) => x.key === key);
    return c
      ? m.figs
          .filter((f) => f.competitorId === c.id && f.metric === metric && /^\d{4}-Q\d$/.test(f.period))
          .sort((a, b) => a.period.localeCompare(b.period))
      : [];
  };
  const latestOf = (key: string, metric: string) => {
    const c = m.comps.find((x) => x.key === key);
    return c
      ? (m.figs
          .filter((f) => f.competitorId === c.id && f.metric === metric)
          .sort((a, b) => b.period.localeCompare(a.period))[0] ?? null)
      : null;
  };
  const quarters = [...new Set(CHAIN_KEYS.flatMap((k) => series(k, "revenue_growth").map((f) => f.period)))]
    .sort()
    .slice(-8);
  const marketIls = m.marketSize?.value ?? null;
  const fig = (f: typeof competitorFigure.$inferSelect | null) =>
    f ? { value: f.value, period: f.period, source: f.source, url: f.url, kind: f.kind, method: f.method } : null;

  const chains = CHAIN_KEYS.filter((k) => m.comps.some((c) => c.key === k)).map((k) => {
    const c = m.comps.find((x) => x.key === k)!;
    const rev = series(k, "revenue");
    const fy2025 = rev.filter((f) => f.period.startsWith("2025-"));
    const fyTotal = fy2025.length === 4 ? fy2025.reduce((a, f) => a + f.value, 0) : null;
    return {
      key: k,
      name: c.name,
      synthetic: false,
      growthByQuarter: quarters.map((q) => series(k, "revenue_growth").find((f) => f.period === q)?.value ?? null),
      revenueLatest: fig(latestOf(k, "revenue")),
      growthLatest: fig(latestOf(k, "revenue_growth")),
      sameStore: fig(latestOf(k, "same_store_sales")),
      grossMargin: fig(latestOf(k, "gross_margin")),
      operatingMargin: fig(latestOf(k, "operating_margin")),
      online: fig(latestOf(k, "online_share")),
      stores: fig(latestOf(k, "store_count")),
      annualRevenue: fyTotal,
      annualPeriod: "2025",
      marketShare: fyTotal !== null && marketIls ? Math.round((fyTotal / marketIls) * 1000) / 10 : null,
      avgBasket: null as number | null,
      itemsPerBasket: null as number | null,
      quartersUp: series(k, "revenue_growth").filter((f) => quarters.includes(f.period) && f.value > 0).length,
      quartersReported: series(k, "revenue_growth").filter((f) => quarters.includes(f.period)).length,
    };
  });

  // ── Ours (synthetic): from the sales and margin data ──
  let ours: (typeof chains)[number] | null = null;
  if (orgId) {
    const [clock] = await db.select().from(demoClock).where(eq(demoClock.orgId, orgId));
    const asOf = (clock?.now ?? new Date()).toISOString().slice(0, 10);
    const kpis = await db.select().from(kpi).where(eq(kpi.orgId, orgId));
    const id = (code: string) => kpis.find((k) => k.code === code)?.id;
    const from = new Date(Date.parse(asOf) - 365 * 86_400_000).toISOString().slice(0, 10);
    const daily = async (code: string, type: "branch" | "department") => {
      const k = id(code);
      if (!k) return [];
      return db
        .select({
          day: kpiObservation.day,
          total: sql<number>`sum(${kpiObservation.value})::float8`,
          n: sql<number>`count(*)::int`,
        })
        .from(kpiObservation)
        .innerJoin(orgUnit, eq(orgUnit.id, kpiObservation.orgUnitId))
        .where(
          and(
            eq(kpiObservation.orgId, orgId),
            eq(kpiObservation.kpiId, k),
            eq(orgUnit.type, type),
            gte(kpiObservation.day, from),
            lt(kpiObservation.day, asOf),
          ),
        )
        .groupBy(kpiObservation.day);
    };
    const [sales, tx, gm] = await Promise.all([
      daily("net_sales", "branch"),
      daily("transactions", "branch"),
      daily("gross_margin", "department"),
    ]);
    const branches = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(orgUnit)
      .where(and(eq(orgUnit.orgId, orgId), eq(orgUnit.type, "branch")));
    const inQ = (q: string, d: string) => {
      const r = QUARTER_DAYS(q);
      return d >= r.start && d < r.end;
    };
    const fullQuarters = [...new Set(sales.map((d) => quarterOf(d.day)))].filter((q) => {
      const r = QUARTER_DAYS(q);
      const days = (Date.parse(r.end) - Date.parse(r.start)) / 86_400_000;
      return sales.filter((d) => inQ(q, d.day)).length === days;
    });
    const sum = (xs: { total: number }[]) => xs.reduce((a, x) => a + x.total, 0);
    const lastQ = fullQuarters.at(-1);
    const salesTtm = sum(sales);
    const recent = sum(
      sales.filter((d) => d.day >= new Date(Date.parse(asOf) - 91 * 86_400_000).toISOString().slice(0, 10)),
    );
    const priorFrom = new Date(Date.parse(asOf) - 182 * 86_400_000).toISOString().slice(0, 10);
    const priorTo = new Date(Date.parse(asOf) - 91 * 86_400_000).toISOString().slice(0, 10);
    const prior = sum(sales.filter((d) => d.day >= priorFrom && d.day < priorTo));
    const growth13 = prior > 0 ? Math.round((recent / prior - 1) * 1000) / 10 : null;
    const avgBasket = sum(tx) > 0 ? Math.round((salesTtm / sum(tx)) * 10) / 10 : null;
    const qGm = lastQ ? gm.filter((d) => inQ(lastQ, d.day)) : [];
    const syn = (value: number | null, period: string, method: string) =>
      value === null ? null : { value, period, source: "synthetic", url: "", kind: "synthetic", method };
    ours = {
      key: "vector",
      name: "VECTOR Retail Group",
      synthetic: true,
      growthByQuarter: quarters.map(() => null),
      revenueLatest: lastQ
        ? syn(
            Math.round(sum(sales.filter((d) => inQ(lastQ, d.day)))),
            lastQ,
            "net sales of all branches in the quarter",
          )
        : null,
      growthLatest: syn(growth13, "13w", "last 13 weeks vs the 13 before (one year of history: no year-on-year yet)"),
      sameStore: syn(growth13, "13w", "every branch traded in both periods, so same-store equals total"),
      grossMargin: syn(
        qGm.length ? Math.round((qGm.reduce((a, d) => a + d.total / d.n, 0) / qGm.length) * 10) / 10 : null,
        lastQ ?? "",
        "average daily gross margin in the quarter",
      ),
      operatingMargin: null,
      online: null,
      stores: syn(branches[0]?.n ?? 0, asOf, "branches in the organization"),
      annualRevenue: Math.round(salesTtm),
      annualPeriod: "last 12 months",
      marketShare: marketIls ? Math.round((salesTtm / marketIls) * 1000) / 10 : null,
      avgBasket,
      itemsPerBasket:
        avgBasket !== null && m.avgItemPrice && m.ourBasketIndex
          ? Math.round((avgBasket / (m.avgItemPrice * (m.ourBasketIndex / 100))) * 10) / 10
          : null,
      quartersUp: 0,
      quartersReported: 0,
    };
  }
  return {
    quarters,
    chains,
    ours,
    market: m.marketSize
      ? {
          value: m.marketSize.value,
          period: m.marketSize.period,
          name: m.marketSizeSeries?.name ?? "",
          url: m.marketSize.sourceUrl,
        }
      : null,
    avgItemPrice: m.avgItemPrice,
  };
}
