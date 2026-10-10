/**
 * Market & competitors read model (plan v2, E6; market-intelligence.md §5, layout v3). Public market data (CBS, the
 * chains' price files, reported results) next to VECTOR Retail Group's own synthetic prices. Every figure carries its
 * source and date; estimates are labelled.
 */
import { and, arrayOverlaps, desc, eq, inArray, like } from "drizzle-orm";
import { BASKET_MODEL, CATEGORIES, CBS_FOR_CATEGORY, yoy, type Category } from "@/domain/market";
import type { Actor } from "@/domain/types";
import { competitor, competitorFigure, insight, marketPoint, marketPriceFile, marketSeries } from "@/infra/db/schema";
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
