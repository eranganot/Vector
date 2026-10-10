# Stage E6: Market & competitors (plan v2)

Status: **Built on Dev (2026-10-10); first review done (G-E6r), changes shipped in E6c; awaiting sign-off (G-E6).** Prod stays on E5 until sign-off.

## What shipped

| PR  | What                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #56 | E6a: real CBS price indices, 47 real price files from 5 chains, basket-index-v1 on 154 barcodes, reported competitor results with sources, the Market tab (migration 0015)                                |
| #57 | E6b: market-v1 rules → insights (MK2 risk, MK3 opportunity), "What changed outside", the board pack's market block, Hebrew for all generated text                                                         |
| #58 | E6c (your review): "What it means" on every card, clearer CBS and heatmap cards, us among competitors, centred numbers, Growth & expansion, MK6 price gap vs every chain, Reports "Ask your data" preview |

## What to look at in the demo (Dev)

1. **Market & competitors** (sidebar, group and C-suite):
   - Tiles: food prices y/y (CBS), our prices y/y (synthetic), our basket vs the market (100 = market median),
     Shufersal same-store sales (reported).
   - **What changed outside**: the two market signals, with ₪ at stake or upside; each opens its insight.
   - Food prices vs ours (CBS real, ours synthetic); food prices by CBS category.
   - Basket price vs competitors (VECTOR highlighted) and a chains × categories heatmap; the region filter on the
     right changes both (North shows the planted dairy gap: ours 4% above Shufersal).
   - Competitors: revenue and growth bars; a table with each figure's source and date; store counts marked
     **Estimate**. Sources at the bottom list every price file with its SHA-256.
2. **The MK2 insight** "Our prices rose while food prices fell (July and August)": P2 risk, Trade decides (Eitan's
   Waiting on you). Evidence shows CBS vs ours month by month, marked real or synthetic, with a link to CBS.
3. **The MK3 insight** "Shufersal is shrinking (same-store −8.6%); we are growing": opportunity, Marketing decides
   (Ronit). The campaign names the categories where we beat Shufersal on price; the evidence links to Globes.
4. **Reports → Board pack**: a "Market & competitors" block (basket vs market by chain).
5. Switch to **עברית**: chain names, categories, months and both insights read in Hebrew.

## What is real and what is synthetic

- Real: CBS indices (as published; chained across CBS's January 2025 re-base), the chains' price files of
  2026-10-10, Shufersal's and Rami Levy's reported Q2 2026 results (with links).
- Estimates (labelled): store counts, from each chain's published stores file.
- Synthetic (labelled): everything about VECTOR Retail Group, including the planted North dairy gap and the MK2 story.

## Limits

- Price files are one day: the basket's lines per chain grow as daily snapshots are collected (`pnpm market:fetch`).
  MK1 (a competitor cuts prices ≥ 3% in 14 days) and MK4 (a store closes) are built and tested but cannot fire yet.
- Railway serves the committed snapshot; fetching runs from Claude's workspace.

## Decisions for Eran

1. **Accept E6** (G-E6) and promote Prod.
2. **The ₪ assumptions** shown in the insights: price elasticity 1.5 (MK2, MK6), a 1% weekly lift (MK3), and for MK6 a
   category's share of sales = its basket weight (dairy 20%). Keep or change.
