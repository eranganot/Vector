/**
 * Loads the committed market snapshots (data/market/, written by scripts/market-fetch.ts) into the market tables
 * (plan v2, E6). Idempotent: upserts by series and period. Runs with the seed, so the demo never needs the network.
 *
 * Real: CBS indices, the chains' basket indices (basket-index-v1), store counts (labelled estimates), reported results.
 * Synthetic and labelled so: VECTOR Retail Group's own prices — anchored on the real market median with planted
 * deviations (market-intelligence.md §3), and its monthly price index following CBS food with a planted rise in the
 * last two months (the MK2 story).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { basketIndex, CATEGORIES, type BasketItem, type Category } from "@/domain/market";
import { competitor, competitorFigure, marketPoint, marketPriceFile, marketSeries } from "@/infra/db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/** A database or a transaction (the seed passes its transaction). */
type DbLike = Pick<NodePgDatabase<Record<string, unknown>>, "insert" | "execute">;
const DIR = join(process.cwd(), "data", "market");
const REGIONS = ["NORTH", "COAST", "CENTER", "JERUSALEM", "SOUTH"] as const;

export const CHAIN_NAMES: Record<string, { name: string; listed: boolean; ticker: string | null }> = {
  shufersal: { name: "Shufersal", listed: true, ticker: "TASE:SAE" },
  rami_levy: { name: "Rami Levy", listed: true, ticker: "TASE:RMLI" },
  osher_ad: { name: "Osher Ad", listed: false, ticker: null },
  yohananof: { name: "Yohananof", listed: true, ticker: "TASE:YHNF" },
  tiv_taam: { name: "Tiv Taam", listed: false, ticker: null },
};

/** VECTOR Retail Group's synthetic price position vs the market median (index points), by category; North dairy is planted. */
const OUR_INDEX: Record<Category, number> = {
  dairy: 101.5,
  bakery: 99.5,
  meat_fish: 100.5,
  drinks: 98.5,
  pantry: 100,
  snacks: 99,
  household: 101,
};
/** Planted (market-intelligence.md §3): our dairy in the North sits 4% above Shufersal's. */
const PLANTED = { region: "NORTH", category: "dairy" as Category, overChain: "shufersal", pct: 4 };
/** Our monthly price index vs CBS food: the same path, then +0.3% and +0.4% in the last two months while CBS falls. */
const OUR_LAST_MONTHS = [0.3, 0.4];

type Snapshot = {
  day: string;
  fetchedAt: string;
  cbs: {
    code: string;
    key: string;
    name: string;
    url: string;
    points: { period: string; index: number; mom: number; yoy: number }[];
  }[];
  chains: string[];
  storeCounts: Record<string, { total: number; byRegion: Record<string, number>; file: string }>;
  stores: {
    chain: string;
    storeId: string;
    name: string;
    city: string;
    region: string;
    url: string;
    fetchedAt: string;
    sha256: string;
    items: number;
  }[];
  basket: (BasketItem & { name: string })[];
  prices: Record<string, Record<string, Record<string, number>>>;
};
type Filings = {
  figures: {
    chain: string;
    period: string;
    metric: string;
    value: number;
    unit: string;
    kind: string;
    source: string;
    url: string;
    asOf: string;
  }[];
};

/**
 * CBS re-bases its indices (e.g. from "2022 average" to "2024 average" in January 2025), so raw values step at the
 * change. Chain the series on the current base from CBS's own monthly changes, backwards from the latest value.
 */
export function chainCbs(points: { period: string; index: number; mom: number }[]) {
  const out = points.map((p) => ({ ...p }));
  for (let k = out.length - 2; k >= 0; k--)
    out[k].index = Math.round((out[k + 1].index / (1 + out[k + 1].mom / 100)) * 100) / 100;
  return out;
}

const hashOf = (xs: string[]) =>
  [...xs]
    .sort()
    .join(",")
    .slice(0, 64 * 3);

export function readSnapshots(dir = DIR): { snapshots: Snapshot[]; filings: Filings } {
  const files = readdirSync(dir)
    .filter((f) => /^snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  return {
    snapshots: files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Snapshot),
    filings: JSON.parse(readFileSync(join(dir, "filings.json"), "utf8")) as Filings,
  };
}

export async function loadMarket(tx: DbLike, dir = DIR) {
  const { snapshots, filings } = readSnapshots(dir);
  if (!snapshots.length) return { series: 0, points: 0 };
  const seriesIds = new Map<string, string>();
  const series = async (source: string, code: string, name: string, unit: string, frequency: string) => {
    const key = `${source}:${code}`;
    if (seriesIds.has(key)) return seriesIds.get(key)!;
    const [row] = await tx
      .insert(marketSeries)
      .values({ source, code, name, unit, frequency })
      .onConflictDoUpdate({ target: [marketSeries.source, marketSeries.code], set: { name, unit, frequency } })
      .returning({ id: marketSeries.id });
    seriesIds.set(key, row.id);
    return row.id;
  };
  let points = 0;
  const point = async (
    seriesId: string,
    period: string,
    value: number,
    fetchedAt: string,
    sourceUrl: string,
    rawHash: string | null,
  ) => {
    await tx
      .insert(marketPoint)
      .values({ seriesId, period, value, fetchedAt: new Date(fetchedAt), sourceUrl, rawHash })
      .onConflictDoUpdate({
        target: [marketPoint.seriesId, marketPoint.period],
        set: { value, fetchedAt: new Date(fetchedAt), sourceUrl, rawHash },
      });
    points++;
  };

  // CBS (real): every snapshot carries 24 months; the latest wins.
  const latest = snapshots.at(-1)!;
  for (const c of latest.cbs) {
    const id = await series("cbs", c.code, c.name, "index", "monthly");
    for (const p of chainCbs(c.points)) await point(id, p.period, p.index, latest.fetchedAt, c.url, null);
    // CBS's own published year-on-year change, shown as published (not recomputed from the chained series).
    const yid = await series("cbs", `${c.code}:yoy`, `${c.name} (y/y %)`, "pct", "monthly");
    for (const p of c.points) await point(yid, p.period, p.yoy, latest.fetchedAt, c.url, null);
  }
  // Our monthly price index (synthetic): CBS food's path, with the planted last two months.
  const food = latest.cbs.find((c) => c.key === "food");
  if (food) {
    const id = await series(
      "synthetic",
      "vector:price_index",
      "VECTOR Retail Group average price (synthetic)",
      "index",
      "monthly",
    );
    const pts = chainCbs(food.points);
    let v = pts[0].index;
    for (let k = 0; k < pts.length; k++) {
      const fromEnd = pts.length - k;
      if (k > 0)
        v =
          v *
          (1 +
            (fromEnd <= OUR_LAST_MONTHS.length ? OUR_LAST_MONTHS[OUR_LAST_MONTHS.length - fromEnd] : pts[k].mom) / 100);
      await point(
        id,
        pts[k].period,
        Math.round(v * 10) / 10,
        latest.fetchedAt,
        "synthetic: CBS food path with planted deviation",
        null,
      );
    }
  }

  // Basket indices per snapshot day (real chains) and ours (synthetic), by region and for all regions.
  for (const snap of snapshots) {
    const basket = snap.basket;
    const files = snap.stores;
    for (const f of files)
      await tx
        .insert(marketPriceFile)
        .values({
          chain: f.chain,
          storeId: f.storeId,
          day: snap.day,
          storeName: f.name,
          city: f.city,
          region: f.region,
          url: f.url,
          fetchedAt: new Date(f.fetchedAt),
          sha256: f.sha256,
          items: f.items,
        })
        .onConflictDoNothing();
    const scopes: [string, Record<string, Record<string, number>>][] = REGIONS.map((r) => [
      r,
      Object.fromEntries(snap.chains.filter((c) => snap.prices[c]?.[r]).map((c) => [c, snap.prices[c][r]])),
    ]);
    // All regions: each chain's median price per item across its regions.
    const all: Record<string, Record<string, number>> = {};
    for (const c of snap.chains) {
      all[c] = {};
      for (const b of basket) {
        const ps = REGIONS.map((r) => snap.prices[c]?.[r]?.[b.code])
          .filter((x): x is number => !!x)
          .sort((a, z) => a - z);
        if (ps.length) all[c][b.code] = ps[Math.floor((ps.length - 1) / 2)];
      }
    }
    scopes.push(["ALL", all]);
    for (const [region, prices] of scopes) {
      if (Object.keys(prices).length < 2) continue;
      const idx = basketIndex(basket, prices);
      const hash = hashOf(files.filter((f) => region === "ALL" || f.region === region).map((f) => f.sha256));
      const url = files.find((f) => region === "ALL" || f.region === region)?.url ?? "";
      for (const chain of Object.keys(prices)) {
        for (const cat of CATEGORIES) {
          const v = idx.byCategory[chain]?.[cat];
          if (v === undefined) continue;
          const id = await series(
            "basket",
            `${chain}:${region}:${cat}`,
            `${CHAIN_NAMES[chain]?.name ?? chain} ${cat} ${region}`,
            "index",
            "daily",
          );
          await point(id, snap.day, v, snap.fetchedAt, url, hash);
        }
        const id = await series(
          "basket",
          `${chain}:${region}:all`,
          `${CHAIN_NAMES[chain]?.name ?? chain} basket ${region}`,
          "index",
          "daily",
        );
        await point(id, snap.day, idx.overall[chain], snap.fetchedAt, url, hash);
      }
      // Ours (synthetic), placed against this day's real market.
      let total = 0;
      let weight = 0;
      for (const cat of CATEGORIES) {
        if (idx.items[cat] === undefined) continue;
        let v = OUR_INDEX[cat];
        if (region === PLANTED.region && cat === PLANTED.category) {
          const ref = idx.byCategory[PLANTED.overChain]?.[cat];
          if (ref) v = Math.round(ref * (1 + PLANTED.pct / 100) * 10) / 10;
        }
        const id = await series(
          "synthetic",
          `vector:${region}:${cat}`,
          `VECTOR Retail Group ${cat} ${region} (synthetic)`,
          "index",
          "daily",
        );
        await point(id, snap.day, v, snap.fetchedAt, "synthetic: anchored on the real market median", null);
        const w = { dairy: 0.2, bakery: 0.15, meat_fish: 0.15, drinks: 0.1, pantry: 0.2, snacks: 0.1, household: 0.1 }[
          cat
        ];
        total += v * w;
        weight += w;
      }
      const id = await series(
        "synthetic",
        `vector:${region}:all`,
        `VECTOR Retail Group basket ${region} (synthetic)`,
        "index",
        "daily",
      );
      await point(
        id,
        snap.day,
        Math.round((total / weight) * 10) / 10,
        snap.fetchedAt,
        "synthetic: anchored on the real market median",
        null,
      );
    }
  }

  // Competitors: names (real), reported figures (curated, sourced), store counts (estimate, from the stores files).
  const compIds = new Map<string, string>();
  for (const [key, c] of Object.entries(CHAIN_NAMES)) {
    const [row] = await tx
      .insert(competitor)
      .values({ key, name: c.name, listed: c.listed, ticker: c.ticker })
      .onConflictDoUpdate({ target: competitor.key, set: { name: c.name, listed: c.listed, ticker: c.ticker } })
      .returning({ id: competitor.id });
    compIds.set(key, row.id);
  }
  const figure = async (f: {
    chain: string;
    metric: string;
    period: string;
    value: number;
    unit: string;
    kind: string;
    source: string;
    url: string;
    asOf: string;
    method?: string;
  }) => {
    const competitorId = compIds.get(f.chain);
    if (!competitorId) return;
    await tx
      .insert(competitorFigure)
      .values({
        competitorId,
        metric: f.metric,
        period: f.period,
        value: f.value,
        unit: f.unit,
        kind: f.kind,
        source: f.source,
        url: f.url,
        asOf: f.asOf,
        method: f.method ?? null,
      })
      .onConflictDoUpdate({
        target: [
          competitorFigure.competitorId,
          competitorFigure.metric,
          competitorFigure.period,
          competitorFigure.kind,
        ],
        set: { value: f.value, source: f.source, url: f.url, asOf: f.asOf, method: f.method ?? null },
      });
  };
  for (const f of filings.figures) await figure(f);
  for (const [chain, s] of Object.entries(latest.storeCounts ?? {}))
    await figure({
      chain,
      metric: "store_count",
      period: latest.day,
      value: s.total,
      unit: "count",
      kind: "estimate",
      source: "The chain's published stores file",
      url: s.file,
      asOf: latest.day,
      method: "Stores listed in the chain's price-transparency stores file on that day",
    });
  await tx.execute(sql`select 1`);
  return { series: seriesIds.size, points };
}
