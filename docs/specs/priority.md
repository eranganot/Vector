# Prioritization models

Status: **Revised 2026-10-04 (v2)** after Eran's scenario review. ADR-005 (deterministic priority), as amended, and
ADR-006 (separate workstreams, local priority). Implemented in `src/domain/priority.ts`; golden fixtures in
`src/domain/priority.test.ts`; calibration report: `pnpm exec tsx scripts/calibrate-priority.ts`.

There are three deterministic, versioned models. All of them store their full breakdown with the insight, so the
"Why am I seeing this?" panel shows exactly what was computed.

| Model               | Used for                                                                  | Bands                                                                           |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `priority-v2`       | Risk workstream, organizational view (Executive, departments)             | P1 ≥ 67 act today · P2 ≥ 51 this week · P3 ≥ 38 plan/monitor · P4 informational |
| `priority-v2-local` | Risk workstream, seen by a regional or branch manager for their own scope | same bands                                                                      |
| `opportunity-v1`    | Opportunity workstream (never ranked against risks)                       | O1 ≥ 60 pursue now · O2 ≥ 33 plan and resource · O3 watch                       |

## Risk priority (priority-v2)

```latex
\text{Priority} = 100 \cdot \Big(\sum_i w_i f_i\Big) \cdot (0.6 + 0.4\,c)
```

| Factor               | Weight | Definition                                                                                                                                                                                 |
| -------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Strategic weight     |   0.30 | How much the executive team says this KPI or area matters (governed configuration)                                                                                                         |
| Impact               |   0.20 | ₪ at stake per week, log scale: ₪5k → 0, ₪1M → 1                                                                                                                                           |
| Magnitude            |   0.15 | `min(                                                                                                                                                                                      | z   | , 4) / 4`, the deviation from the unit's own usual level |
| Urgency              |   0.15 | Hours until impact or due date: ≤ 24 h or overdue 1.0 · ≤ 72 h 0.75 · ≤ 7 d 0.5 · ≤ 30 d 0.25 · later 0.1 · already happening 0.75                                                         |
| Breadth              |   0.10 | isolated 0.25 · local (2–3 branches) 0.5 · regional 0.75 · systemic 1.0                                                                                                                    |
| **Compliance** (new) |   0.10 | Regulatory or contractual exposure if unhandled: 0 none · 0.3 contractual terms · 0.6 internal policy obligation · 0.8 legal/regulatory deadline · 1.0 safety or regulator-mandated action |

c = confidence (0–1); low confidence removes up to 40% of the score but never hides the item.

### Why these weights

Weights and thresholds were searched together over a grid (each weight 0.10–0.30, step 0.05) to reproduce every expected
band with the widest gap between bands. Two constraints came from Eran's review:

- **C4 (wage rule, S14) stays P2.** That caps the compliance weight at 0.10: at 0.15 or more it becomes P1.
- **Urgency stays at 0.15**, because "act today" is the product's promise. The best grid point with urgency at 0.10 had
  slightly wider gaps (5.9 vs. 3.9 points), but it would under-rank imminent items.

### Calibration (14 risk scenarios; all reproduce their expected band)

| Scenario                                 | Score | Band |
| ---------------------------------------- | ----: | ---- |
| R1 Food-safety recall (S12)              |  91.7 | P1   |
| R2 DC delay cascade (S04)                |  77.0 | P1   |
| R3 North stock-outs before holiday (S02) |  72.3 | P1   |
| R4 Promo assets late (S06)               |  68.7 | P1   |
| R5 Wage rule, pay tables overdue (S14)   |  64.8 | P2   |
| R6 Supplier cost vs. planned promo (S11) |  59.4 | P2   |
| R7 Spend freeze vs. campaign (S15)       |  59.4 | P2   |
| R8 Haifa Grand Canyon sales drop (S01)   |  57.8 | P2   |
| R9 POS upgrade inside peak (S13)         |  54.1 | P2   |
| R10 Shrinkage spike (S09)                |  48.5 | P3   |
| R11 Labor cost, Center (S05)             |  46.2 | P3   |
| R12 Promo vs. delisting (S07)            |  43.9 | P3   |
| R13 POS outage, resolved (S10)           |  32.1 | P4   |
| R14 Branch NPS down (S03)                |  30.3 | P4   |

Tightest gaps: P1/P2 3.9 points (68.7 vs. 64.8), which is narrower than v1's 8.4 because the compliance factor lifts R5
toward P1; and P2/P3 5.6 points (54.1 vs. 48.5), slightly wider than v1's 5.4. The live Phase 2 detector scores the
real (synthetic) Haifa data at 64.4, P2, under v2; under v1 it scored 69.3.

## Local priority (priority-v2-local)

The same formula and bands, but **impact** and **breadth** are measured against the viewer's own scope:

- impact = ₪ at stake as a share of the scope's weekly sales, log scale: 0.5% → 0, 10% → 1;
- breadth = share of the scope affected: ≥ 50% → 1.0 · ≥ 25% → 0.75 · ≥ 10% → 0.5 · otherwise 0.25.

The organizational priority stays the reference for the Command Center and department views. Region and branch views
rank by local priority and show both, e.g. "P3 for the group · **P2 for your branch**".

| Scenario                 | Viewer           | Org     | Local                                    |
| ------------------------ | ---------------- | ------- | ---------------------------------------- |
| R8 Haifa sales drop      | Branch manager   | P2 57.8 | **P1 72.7**                              |
| R10 Shrinkage spike      | Branch manager   | P3 48.5 | **P2 60.4**                              |
| R14 Branch NPS down      | Branch manager   | P4 30.3 | P3 39.1                                  |
| R13 POS outage, resolved | Branch manager   | P4 32.1 | P3 40.2                                  |
| R11 Labor cost, Center   | Regional manager | P3 46.2 | P3 40.3 (expected P2: **open question**) |

## Opportunity value (opportunity-v1)

Opportunities answer a different question: what is it worth, and how soon must we move? They are scored and ranked
on their own and never mixed with risks.

| Factor        | Weight | Definition                                             |
| ------------- | -----: | ------------------------------------------------------ |
| Value         |   0.30 | Upside per week (₪), log scale like impact             |
| Window        |   0.25 | Hours until the window closes, same buckets as urgency |
| Strategic fit |   0.20 | Governed configuration                                 |
| Ease          |   0.15 | value / (value + cost to capture)                      |
| Reach         |   0.10 | isolated · local · regional · systemic                 |

× (0.6 + 0.4 × confidence). Calibration: O1 64.0 · O4 55.5 · O3 48.0 · O2 45.7 · O5 19.5. All five reproduce their
expected band (O1 ≥ 60, O2 ≥ 33); the O1/O2 gap is 8.5 points.

## Governance

- Weights, bands and per-KPI strategic weights are versioned configuration (`weights-v2`). Changing them is a proposed,
  Executive-approved, audited operation, and applies only to insights created afterwards.
- AI (Phase 5+) may supply factor inputs (e.g. compliance exposure, relevance of an external event), recorded with their
  `AiGeneration` id; the formulas stay deterministic. AI may propose weight changes from outcome history (D6); a human approves them.
