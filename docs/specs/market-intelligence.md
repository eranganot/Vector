# Market & competitors (E6)

Status: **E6a–E6c built (2026-10-10): data, basket index, the tab, market-v1 signals → insights, and Eran's review changes; see §7–§9.** Proposed in E0 (2026-10-06); sources checked by fetching on 2026-10-06 and 2026-10-10. Implements FB item #6 and FB-7: real
Israeli sources, real competitor names, real figures where available, and labelled estimates. This stage absorbs v1
Phase 6 (external intelligence, D9). External data runs the full VECTOR flow: **source → signal → insight → priority
→ recommendation → action → outcome → audit** (charter §16).

## 1. Sources (checked)

| Source                                                                                 | What was checked on 2026-10-06                                                                                                                                                                                                                                             | Use in VECTOR                                                                                          | Refresh                                         |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| **CBS price indices API** (`api.cbs.gov.il/index/...`)                                 | Public, no key; JSON or XML. `index/data/price?id=110050` returned "Food, including vegetables and fruit": August 2026 −0.4% m/m, +1.0% y/y (base Avg 2024 = 104.4). Also 120050 (food excluding vegetables and fruit), 120010 (CPI general)                               | Food inflation vs our price change; real (inflation-adjusted) sales growth; cost pressure on suppliers | Monthly (CBS publishes mid-month)               |
| **Price-transparency files: Shufersal** (`prices.shufersal.co.il`)                     | Public listing; per-store daily `PriceFull` files (gz XML) on Azure blob storage, with time-limited links. Store 001's file of 2026-10-06 03:00 had 6,611 items: `ItemCode` (barcode), `ItemName`, `ManufactureName`, `ItemPrice`, `UnitOfMeasurePrice`, `PriceUpdateTime` | Basket price index vs Shufersal by category and region; competitor price moves; store counts           | Daily                                           |
| **Price-transparency files: other chains** (shared portal `url.publishedprices.co.il`) | The portal's sign-in page answers (HTTP 200). Which chains publish there, and how, is **not yet verified**                                                                                                                                                                 | Same basket index for more chains (e.g. Rami Levy, Victory, Yochananof, Osher Ad)                      | Daily                                           |
| **Listed competitors' results** (TASE filings; business press)                         | Globes, 2026-08-27, on Shufersal Q2 2026: revenue NIS 3.4B (−7.5%), same-store sales −8.6%, net profit NIS 125M (−34%); H1 NIS 7.1B ([source](https://en.globes.co.il/en/article-1001553761))                                                                              | Competitor growth, same-store sales and margin vs ours                                                 | Quarterly, curated by hand with the source link |
| **Open-Meteo** (D9, kept)                                                              | Not re-checked (approved in Phase 1)                                                                                                                                                                                                                                       | Weather opportunity O1 (heatwave), demand signals                                                      | Daily                                           |

The shell in Claude's workspace reached CBS and Shufersal directly. The Railway services must also reach them; E6
starts by checking this from Dev.

## 2. Data model

| Entity              | Fields                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `market_series`     | source (`cbs`, `prices:<chain>`, `filings`), code, name, unit, frequency                                                                                                             |
| `market_point`      | series_id, period, value, fetched_at, source_url, raw_hash. Raw files are kept by hash, so a figure can be traced to its file                                                        |
| `competitor`        | name (real), listed (bool), ticker, chain_id (from price files)                                                                                                                      |
| `competitor_figure` | competitor_id, metric (revenue, same-store sales, net profit, store count, basket index), period, value, kind (`reported` or `estimate`), source_url, as_of, method (estimates only) |

Every figure shown carries its **source and date**. Estimates carry an **Estimate** label and a method line, e.g.
"store count: number of stores in the chain's published price files on 2026-10-06" (FB-7).

## 3. Basket index

Each chain's basket price index is computed as follows:

- **Basket**: 150 barcodes sold by every compared chain, weighted by category (dairy, bakery, produce by
  `UnitOfMeasurePrice`, meat, dry goods, drinks, household).
- **Index**: for each chain, Σ weight × median store price, relative to the market median (= 100), by region where the
  chain has stores.
- **Our prices** are synthetic. The v5 generator anchors VECTOR Retail Group's basket on the real market median with
  planted deviations, for example dairy 4% above Shufersal in North. A real comparison then produces real-looking
  signals.

## 4. Signals → insights (rules `market-v1`)

| Rule | Signal                                                                                    | Insight (workstream)                                                                             |
| ---- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| MK1  | A competitor's basket index in a category drops ≥ 3% over 14 days in a region we trade in | Risk: price gap on {category} in {region}; ₪ at stake from our category sales × price elasticity |
| MK2  | Food CPI m/m falls while our average price rises (two months running)                     | Risk: pricing out of line with the market                                                        |
| MK3  | A competitor reports same-store sales ≤ −5% while ours grow                               | Opportunity: share gain; push the categories where we lead on price                              |
| MK4  | A competitor's store count in a city drops (closure)                                      | Opportunity: local demand (like O2 "competitor closes near Ramat Gan")                           |
| MK5  | Heatwave forecast (Open-Meteo)                                                            | Opportunity O1 (existing)                                                                        |

## 5. The tab

**Layout v3 (G-E0f, Eran 2026-10-06: competitors in charts, not only a table):**

- KPI tiles: food prices y/y (CBS), our price y/y, our basket index, our growth vs the market leader.
- **Food prices vs ours:** two lines (CBS real, ours).
- **Basket price vs competitors:** 12-week lines per chain, with VECTOR highlighted.
- **Competitors:** revenue bars and growth bars, Q2 2026. The real figures are Shufersal (Globes, 2026-08-27) and Rami Levy
  (investor presentation, Aug 2026: revenue NIS 2.07B, +3%; gross margin 23.6%; operating margin 4.7%).
- **Basket price index by category:** a heatmap of chains × categories.

The list that follows is the E0 v2 version:

1. ₪ header: market growth (food CPI y/y) vs our real growth · our basket index vs market · ₪ at stake from market
   risks.
2. **What changed outside** (last 30 days): cards tied to the rules above, each with "how it hits us" (₪, KPIs,
   regions) and a link to its insight.
3. **Competitors**: a table of real chains with reported and estimated figures, sources and dates.
4. **Trends**: food CPI vs our average price (12 months); basket index by chain over time.

## 6. Risks and conduct

- The chains publish this data by law, and CBS data is public. We store the raw files we use (by hash) for
  traceability, and fetch politely (daily, sequentially).
- Chains' file formats differ, so there is one parser per chain, each with a fixture test.
- Competitor figures are shown as published, never adjusted silently.

## 7. As built (E6a, 2026-10-10)

- **Fetcher** `pnpm market:fetch` (`scripts/market-fetch.ts`) writes `data/market/snapshot-<day>.json`, committed, so
  the demo never needs the network. The seed loads it (`src/infra/market/load.ts`, migration 0015, seed `p6-v1`).
  - **CBS** (`api.cbs.gov.il`): CPI 120010, food 110050 and the food groups (milk & dairy 120230, bread & cereals
    120060, meat & fish 120130, drinks 120340, oils 120200, sugar & sweets 120370, vegetables & fruit 120040),
    24 months. CBS re-based to "2024 average" in January 2025, so the series are chained from CBS's own monthly
    changes on the current base; the y/y shown is CBS's published figure.
  - **Price files** (published by law): Shufersal (its site; its "Deal" stores first, so a premium urban format does
    not skew it) and Rami Levy, Osher Ad, Yohananof and Tiv Taam (the shared portal's public accounts, no password).
    Up to 2 stores per chain and region, mapped to our regions by CBS locality code (or city name). 47 files on
    2026-10-10, each recorded with URL, time and SHA-256 (`market_price_file`). The files are UTF-8 or UTF-16.
  - **Basket**: 154 barcodes sold by every chain, 22 per category (dairy, bread & cereals, meat & fish, drinks,
    pantry, snacks, household), chosen by how many stores carry them; weighted and chain-internal codes excluded.
    Shelf prices (promotions excluded).
  - **Competitors**: reported Q2 2026 figures, curated with their source (`data/market/filings.json`): Shufersal
    (Globes, 27 Aug 2026) and Rami Levy (investor presentation, Aug 2026). Store counts are **estimates**: stores in
    each chain's published stores file that day.
- **basket-index-v1** (`src/domain/market.ts`, pure, unit-tested): per item the market price is the chains' median; a
  chain's category index is the mean of its price ÷ market price × 100; the overall index weights the categories.
- **Ours (synthetic, labelled)**: our category indices sit near the market median; planted: North dairy 4% above
  Shufersal's. Our monthly price index follows CBS food, then rises +0.3% and +0.4% in the last two months while CBS
  falls (the MK2 story).
- **Tab** `/market`: tiles (food y/y from CBS, ours, our basket vs the market, Shufersal same-store sales), food prices
  vs ours, CBS by category, basket vs competitors (VECTOR highlighted), a chains × categories heatmap, competitors
  (revenue and growth bars, a table with sources and labelled estimates), sources with file hashes; region filter.
- **History**: the chains publish only today's files, so the basket's lines per chain grow as daily snapshots are
  collected (one day so far). CBS has real monthly history.
- Fetching runs from Claude's workspace; Railway serves the committed snapshot (no network needed in the demo).

## 8. As built (E6b, 2026-10-10): signals → insights

- **market-v1** (`src/domain/detection/market-v1.ts`, pure, unit-tested) runs inside the detector
  (`src/application/market-rules.ts`), so it fires on every demo reset and day advance and writes through the same
  audited path (signal → frozen evidence → insight → decision → proposed actions). Re-runs attach to the open insight.
  - **MK2 (fires)**: CBS food −0.4% in July and August while our synthetic price index rose +0.3% and +0.5%.
    Risk owned by Trade & Commercial (Eitan decides); ₪ at risk = weekly sales × the 1.6-point gap × elasticity 1.5
    (stated in the insight). Actions: review the two months' price increases (Eitan), brief the CFO.
  - **MK3 (fires)**: Shufersal reported same-store sales −8.6% (Q2 2026, Globes) while ours grew (+1.5%, the last 13
    weeks vs the 13 before, synthetic). Opportunity owned by Marketing (Ronit decides); upside = 1% of weekly sales;
    the campaign names the categories where we are cheaper than Shufersal in the price files.
  - **MK1, MK4 (dormant)**: they compare daily snapshots (a 3% basket drop over 14 days; a store-count drop). With one
    day of price files they cannot fire; the rules are tested and switch on as snapshots accumulate.
- Evidence from real sources is marked real, with a link to the source; our figures are labelled synthetic.
- **What changed outside**: a card on the Market tab listing the market-v1 insights in the viewer's scope, with ₪ at
  stake or upside and a link to the insight.
- **Board pack**: a "Market & competitors" block (basket vs market by chain; a table adds same-store sales and revenue
  growth), also available in any report.
- Hebrew: chain, category and month names and every generated sentence are translated (templates in
  `he-content.ts`). Category fields are codes and never translated (`localize` skips `category`).

## 9. As built (E6c, 2026-10-10): Eran's review (G-E6r, G-E6a–d)

- **Every card ends with "What it means"**: a sentence computed from the card's numbers (food vs ours, CBS by
  category, basket vs competitors, heatmap, competitors, growth, share, margins, baskets).
- **CBS by category** now says what it compares (the last published month vs the same month a year earlier) and what the
  colours mean: red = dearer than a year ago (supplier cost pressure), green = cheaper (room to lead on price).
- **Heatmap** explains a cell (the chain's shelf price for the same products vs the market median, 100) with a legend.
- **We are in the comparison**: VECTOR Retail Group (synthetic, highlighted) in the competitor bars and table; numbers
  are centred under their headers.
- **Growth & expansion** (G-E6a): revenue growth y/y over 8 quarters for Shufersal, Rami Levy and Yohananof (company
  filings via StockAnalysis/S&P Global; `data/market/quarterly.json`, cross-checked with Globes and Rami Levy's
  investor presentation for Q2 2026; Yohananof's Q2 2026 was not yet in the source); market share **estimate** =
  2025 revenue ÷ the barcoded food & beverage market (₪52B in 2025, StoreNext via Strauss Group's 2025 report; overstated
  because chain revenue includes fresh food and non-food); gross and operating margins; stores (estimates); online share
  (Shufersal 19.8% in Q1 2025, IFI Today); average basket and items per basket (ours only: net sales ÷ transactions;
  items = basket ÷ the basket items' market-median shelf price × our index). What a chain does not publish reads "not
  reported". Ours: last full quarter, 13-week growth (one year of history, so no year-on-year yet).
- **MK6 price gap** (G-E6b): a category where we are ≥ 3% above the market median in a region becomes a risk owned by
  Trade, with our gap to **every** chain listed (North dairy fires: +13.2% vs the market; dearer than all 5 chains, from
  +3.4% vs Tiv Taam to +17.1% vs Osher Ad). ₪ at risk = the region's weekly sales × the category's basket weight × the
  gap × elasticity 1.5.
- **Reports: Ask your data** (G-E6d): a preview of the free-text chat (an AI agent answering with read-only
  text-to-SQL), disabled and labelled; not developed.
