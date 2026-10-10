/**
 * Market model (plan v2, E6; market-intelligence.md §3). Pure.
 *
 * basket-index-v1: for each item of the basket, the market price is the median of the chains' prices; a chain's index
 * in a category is the mean of (its price ÷ market price) over the items every chain sells there, × 100. The overall
 * index weights the categories (CATEGORY_WEIGHTS, roughly the food basket's mix). 100 = the market median; 105 = 5%
 * dearer than the market.
 */
export const BASKET_MODEL = "basket-index-v1";

export const CATEGORIES = ["dairy", "bakery", "meat_fish", "drinks", "pantry", "snacks", "household"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Category weights for the overall index (sum 1). */
export const CATEGORY_WEIGHTS: Record<Category, number> = {
  dairy: 0.2,
  bakery: 0.15,
  meat_fish: 0.15,
  drinks: 0.1,
  pantry: 0.2,
  snacks: 0.1,
  household: 0.1,
};

/** CBS index codes behind each of our categories (the closest CBS group). */
export const CBS_FOR_CATEGORY: Partial<Record<Category, string>> = {
  dairy: "120230",
  bakery: "120060",
  meat_fish: "120130",
  drinks: "120340",
  pantry: "120200",
  snacks: "120370",
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;

export type BasketItem = { code: string; category: Category };
/** prices[chain][itemCode] in one region. */
export type ChainPrices = Record<string, Record<string, number>>;

export type BasketIndex = {
  byCategory: Record<string, Partial<Record<Category, number>>>;
  overall: Record<string, number>;
  /** Items compared per category (sold by every chain). */
  items: Partial<Record<Category, number>>;
};

export function basketIndex(basket: BasketItem[], prices: ChainPrices): BasketIndex {
  const chains = Object.keys(prices);
  const byCategory: BasketIndex["byCategory"] = Object.fromEntries(chains.map((c) => [c, {}]));
  const items: BasketIndex["items"] = {};
  for (const cat of CATEGORIES) {
    const ratios: Record<string, number[]> = Object.fromEntries(chains.map((c) => [c, []]));
    let n = 0;
    for (const it of basket.filter((b) => b.category === cat)) {
      const ps = chains.map((c) => prices[c][it.code]);
      if (ps.some((p) => !(p > 0))) continue; // compare like with like: only items every chain sells
      const m = median(ps)!;
      chains.forEach((c, k) => ratios[c].push(ps[k] / m));
      n++;
    }
    if (!n) continue;
    items[cat] = n;
    for (const c of chains) byCategory[c][cat] = Math.round(mean(ratios[c]) * 1000) / 10;
  }
  const overall: Record<string, number> = {};
  for (const c of chains) {
    const cats = CATEGORIES.filter((k) => byCategory[c][k] !== undefined);
    const w = cats.reduce((a, k) => a + CATEGORY_WEIGHTS[k], 0);
    if (w)
      overall[c] = Math.round((cats.reduce((a, k) => a + byCategory[c][k]! * CATEGORY_WEIGHTS[k], 0) / w) * 10) / 10;
  }
  return { byCategory, overall, items };
}

/** Year-on-year change in % of a monthly index series, for its last month (null without a year of history). */
export function yoy(points: { period: string; value: number }[]): number | null {
  const last = points.at(-1);
  if (!last) return null;
  const [y, m] = last.period.split("-");
  const prev = points.find((p) => p.period === `${Number(y) - 1}-${m}`);
  return prev ? Math.round((last.value / prev.value - 1) * 1000) / 10 : null;
}
