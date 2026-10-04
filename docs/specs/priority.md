# Priority model v1

Status: **Draft for Phase 1 approval**. Implements charter §14: transparent, consistent, reproducible,
explainable, auditable.

## Formula

```latex
\text{Priority} = 100 \cdot \Big(\sum_i w_i f_i\Big) \cdot (0.6 + 0.4\,c)
```

Each factor f is in [0, 1]; the weights w sum to 1; c is the insight's confidence in [0, 1]. Low confidence can remove up to
40% of the score but never zeroes it: an uncertain, important signal still surfaces, labelled as uncertain.

| Factor           | Weight v1 | Definition                                                                                                                                                              |
| ---------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Magnitude        | 0.20      | `min(                                                                                                                                                                   | z   | , 4) / 4`, where z is the deviation from the unit's own trailing 28-day same-weekday baseline |
| Business impact  | 0.30      | Revenue or margin at stake per week, log-scaled: `log10(x / ₪5k) / log10(₪1M / ₪5k)`, clamped to [0, 1]                                                                 |
| Breadth          | 0.15      | isolated (1 branch) 0.25 · local (2–3 branches, one region) 0.5 · regional (≥ 4 branches or a whole region) 0.75 · systemic (≥ 2 regions, or group/department-wide) 1.0 |
| Urgency          | 0.20      | Hours until impact or due date: ≤ 24 h 1.0 · ≤ 72 h 0.75 · ≤ 7 d 0.5 · ≤ 30 d 0.25 · later 0.1 · already happening 0.75                                                 |
| Strategic weight | 0.15      | Per-KPI weight set by the executive team (governed configuration)                                                                                                       |

## Bands

| Band | Score     | Meaning                        |
| ---- | --------- | ------------------------------ |
| P1   | ≥ 70      | Act today; executive attention |
| P2   | 55 – 69.9 | Act this week                  |
| P3   | 40 – 54.9 | Plan or monitor                |
| P4   | < 40      | Informational                  |

## Calibration (how the thresholds were set, not invented)

Ten scenarios ([priority-scenarios.json](priority-scenarios.json)) were written with an expected band **before**
any score was computed. `pnpm exec tsx scripts/calibrate-priority.ts` scores them:

| Scenario                                                    | Score | Expected | Result |
| ----------------------------------------------------------- | ----: | -------- | ------ |
| S04 DC delay → 14 branches, 2 regions, < 24 h               |  85.4 | P1       | P1     |
| S02 Top-SKU stock-outs, 9 North branches, holiday in 2 days |  79.3 | P1       | P1     |
| S06 Promo assets late for all 60 branches, launch in 2 days |  76.1 | P1       | P1     |
| S01 Haifa Grand Canyon sales −18% WoW                       |  60.2 | P2       | P2     |
| S08 Heatwave forecast, 8 South branches, 3 days             |  58.1 | P2       | P2     |
| S05 Labor cost +6%, Center region                           |  52.7 | P3       | P3     |
| S09 Single-branch shrinkage spike                           |  52.5 | P3       | P3     |
| S07 Promo vs. delisting conflict, 5 branches                |  44.8 | P3       | P3     |
| S10 2-hour POS outage, resolved                             |  33.7 | P4       | P4     |
| S03 Single-branch NPS −4                                    |  28.1 | P4       | P4     |

All ten land in their expected band. **Caveats:**

- The P2/P3 boundary is the tightest (58.1 vs. 52.7). Phase 3's larger dataset will re-run calibration with
  more scenarios before the investor demo.
- S10 shows why magnitude alone is not priority: the largest statistical deviation (z = 4) ranks near the bottom,
  because almost nothing is at stake and it is already over.

## Explainability

Each insight stores `priority_breakdown`: factor values, their inputs (e.g. z = 2.8 vs. baseline ₪41.2k/day),
weights, the confidence multiplier, the model version (`priority-v1`) and the weights version. The UI's "Why am I
seeing this?" panel renders exactly this object. The same inputs and versions always produce the same score
(golden-fixture test in Phase 2).

## Governance

- Weights and per-KPI strategic weights are versioned configuration. A change is proposed (`config.priority_weights.propose`),
  approved by an Executive, audited, and applied only to insights created afterwards. Existing insights keep the version
  they were scored with; a re-score is an explicit, audited operation.
- This is the main lever for "learning" (D6): from Phase 5, AI may _propose_ weight changes from outcome history.
  A human approves them like any other consequential change.
- AI may supply a **factor input** (e.g. how relevant a weather event is to a branch). It is recorded with its
  `AiGeneration` id and bounded to [0, 1]. The formula stays deterministic.
