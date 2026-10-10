# Market & competitors (E6)

Status: **Proposed (E0, 2026-10-06); sources checked by fetching on 2026-10-06.** Implements FB item #6 and FB-7: real
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
