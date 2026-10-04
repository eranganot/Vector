# Synthetic data plan — VECTOR Retail Group

Status: **Draft for Phase 1 approval**. All data is synthetic (charter §17). It grows by phase, only as far as
that phase needs.

## Principles

1. **Deterministic.** One seeded generator (`seed = "vector-v1"`): every reset produces identical data, so demos and
   tests are reproducible.
2. **Plausible to a retail executive.** Israeli retail calendar and geography, store size classes, weekday
   shape, holidays, noise. Investors notice fake-looking data immediately.
3. **Planted stories are ground truth.** Every anomaly a demo relies on is injected deliberately, with a known cause,
   and recorded in `seed/stories.json`. Detectors are tested against it: each planted story must be found, and there
   must be no P1/P2 on unplanted noise.
4. **Fictional organization, real places.** Branch cities are real (needed for live weather in Phase 6).
   Names of people and the company are invented.

## Scale by phase

|                 | Phase 2                                       | Phase 3+                                                                                        |
| --------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Regions         | 2 (North, Center)                             | 5 (North, Haifa & Coast, Center, Jerusalem, South)                                              |
| Branches        | 6                                             | 60 (8–16 per region)                                                                            |
| Departments     | 3 (Store Operations, Supply Chain, Marketing) | 8 (+ Trade & Commercial, Finance, HR, Legal & Compliance, IT); see [scenarios.md](scenarios.md) |
| Users           | 8                                             | ~25                                                                                             |
| KPIs            | 4                                             | ~10                                                                                             |
| History         | 12 weeks daily                                | 52 weeks daily                                                                                  |
| Planted stories | 1 (Haifa sales drop)                          | 5 charter scenarios + 3–4 decoys                                                                |

## Phase 2 contents

**Branches:**

- North: Haifa Grand Canyon (L), Haifa Downtown (M), Nazareth (M)
- Center: Tel Aviv Dizengoff (L), Ramat Gan Ayalon (L), Petah Tikva (M)

**KPIs (daily, per branch):**

| Code           | KPI                   | Unit  | Better | Strategic weight |
| -------------- | --------------------- | ----- | ------ | ---------------- |
| `net_sales`    | Net sales             | ₪     | higher | 0.8              |
| `transactions` | Transactions          | count | higher | 0.6              |
| `osa`          | On-shelf availability | %     | higher | 0.9              |
| `labor_pct`    | Labor cost % of sales | %     | lower  | 0.5              |

**Personas (seeded users):**

| Name          | Title                              | Role @ scope                        |
| ------------- | ---------------------------------- | ----------------------------------- |
| Dana Levi     | CEO                                | Executive @ Group                   |
| Yossi Cohen   | Regional Manager, North            | Regional Manager @ North            |
| Maya Azulay   | Regional Manager, Center           | Regional Manager @ Center           |
| Avi Mizrahi   | Branch Manager, Haifa Grand Canyon | Branch Manager @ Haifa Grand Canyon |
| Noa Friedman  | VP Supply Chain                    | Department Manager @ Supply Chain   |
| Ronit Shapiro | VP Marketing                       | Department Manager @ Marketing      |
| Tal Ben-David | Board observer                     | Viewer @ Group                      |
| Ops Admin     | System administrator               | Admin @ Group                       |

## Generator model (per branch, per KPI, per day)

```text
value = base(size_class) × weekday_shape × holiday_factor × trend(t) × regional_factor × (1 + noise)
        + planted_story_delta(t)
```

- **Weekday shape** (net sales): Sun 0.95 · Mon 0.9 · Tue 0.9 · Wed 1.0 · Thu 1.25 · Fri 1.1 (short day) · Sat 0.35
  (most branches closed; malls partly open).
- **Holidays:** Rosh Hashanah, Yom Kippur, Sukkot and Passover eves spike, holy days close.
- **Noise:** Gaussian, σ = 4% of daily sales. KPI correlations are kept: transactions follow sales, OSA dips
  precede sales dips, labor % rises when sales fall.
- **Planted story P2-S1:** Haifa Grand Canyon net sales fall 18% from day −7. Cause: an OSA drop in two top
  categories after a DC routing change. OSA falls 3 days earlier, and both KPIs recover after a transfer action.

## Phase 3+ planted stories

The full catalog, with departments, dependency chains and approvals, is in [scenarios.md](scenarios.md). There are 11
cross-department stories (C1–C5 plus the six earlier ones), covering all five charter §36 scenario types, plus 3–4 decoys
(noise spikes, a resolved outage) that prove VECTOR doesn't cry wolf.

Each department gets a manager persona in Phase 3: Store Operations, Supply Chain (Noa Friedman), Trade & Commercial,
Marketing (Ronit Shapiro), Finance, HR, Legal & Compliance, IT.
