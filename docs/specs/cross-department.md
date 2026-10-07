# Opportunities view, action economics and cross-department initiatives (E3)

Status: **Proposed (E0, 2026-10-06).** Implements FB items #7 (opportunity impact, cost and risk per action item) and
#8 (cross-department tab).

## 1. Opportunities tab

Above the list there is a ₪ header (executive-home.md §6) and a **value map**, one bubble per action item of every
open opportunity in scope:

- **x** = cost to capture (₪);
- **y** = expected impact by end of quarter (₪);
- **bubble size** = execution risk (larger means riskier);
- **colour** = band (O1 solid, O2 outlined, O3 grey), as the bands are drawn today.

A diagonal line marks break-even (impact = cost). Items above and to the left of it are cheap and valuable, and the
map is labelled with that reading. Clicking a bubble opens the action item. The list under the map is sorted by
**net value** (impact − cost) and shows, per action item, impact, cost, risk (low, medium or high, with its factors),
time to value and the window's closing date. The same map is available on Risks, with mitigated ₪ on the y axis.

## 2. Action economics (`economics-v1`, deterministic)

Every action (proposed, seeded, or created in the Action Center) carries the following fields:

| Field                 | Meaning                                                                              |
| --------------------- | ------------------------------------------------------------------------------------ |
| `expected_impact_ils` | ₪ effect expected (per week × weeks in horizon, or one-off), sign as for the KPI     |
| `impact_basis`        | how it was computed: the insight's ₪ at stake / upside × the playbook's capture rate |
| `cost_ils`            | the existing `estimated_cost`, now required                                          |
| `execution_risk`      | 0–1, shown as low (< 0.3), medium (0.3–0.6) or high (> 0.6)                          |
| `risk_factors`        | the terms below, so the score is explainable                                         |

The risk score is:

```text
execution_risk = 0.30 × dependency risk      (open dependencies the action needs; any at risk or blocked)
               + 0.25 × conflict risk        (an open conflict touching its units or budget)
               + 0.25 × track record         (1 − hit rate of past outcomes of the same playbook; 0.5 when none)
               + 0.20 × owner load           (owner's overdue items ÷ open items)
```

### As built (E3a, 2026-10-07)

- `executionRisk` in `src/domain/economics.ts` (economics-v1) is computed at read time by `valueMap`
  (`src/application/queries/value-map.ts`), so it follows the live state; the stored v0 baseline is no longer shown.
- **Dependency risk:** the share of open dependencies at risk or blocked whose waiting unit is one of the action's
  target units or a unit above them (not the group).
- **Conflict risk:** 1 when an open conflict has a plan owned by one of the action's target units. Counting the
  response's owner department as well flagged every action (each department is in some conflict), so it is left out.
- **Track record:** 1 − worked ÷ judged over outcomes of the same action type; 0.5 with no history.
- **Owner load:** the owner's overdue ÷ open action items.
- The map plots each live action item (cancelled and rejected left out); bubbles open the action on its insight page
  (`#action-<id>`). The list beside it ranks by net value (impact − cost) with risk, days to value and the window.

## 3. Initiatives: the Cross-department tab

**Layout v3 (G-E0c, Eran 2026-10-06: "where are the action items for the user?").** The tab is built around what
the viewer must do:

1. **Portfolio:** one progress ring per initiative (colour = status). The selected initiative is highlighted.
2. **Progress map** of the selected initiative: one ring per participating department (% of its part done), linked in
   order of dependency. Under each ring: its current milestone and status. A broken link means waiting.
3. **Your action items:** everything in this initiative that waits on the viewer (approve, decide, settle a conflict,
   send a reminder), each with one button. This panel sits at the top right.
4. **Open deviations:** the M1–M5 flags.
5. **Milestones:** a Gantt across departments, with a "today" line; late milestones in red.
6. **On-time delivery** for the initiative vs the group average.

An **Initiative** is a cross-department project (with an end) or process (recurring, with a cycle). It must have at
least two participating units, at least one of them a department.

| Entity       | Fields                                                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Initiative` | title, kind (`project`, `process`), sponsor_user_id (C-level), owner_unit_id, participating_unit_ids[], visible_unit_ids[] (ADR-008), budget_ils, spent_ils, value_ils, start, end, status (derived), status_note |
| `Milestone`  | initiative_id, title, owner_unit_id, due, done_at, state (`planned`, `at_risk`, `late`, `done`; derived from due date, the dependencies it waits on and owner updates)                                            |
| `Barrier`    | initiative_id, title, kind (`dependency`, `resource`, `budget`, `decision`, `external`), owner_unit_id, since, resolved_at                                                                                        |
| links        | initiative ↔ commitments, dependencies, conflicts, insights and actions (existing Phase 4 entities; no copies)                                                                                                    |

**Status**, derived (never typed in):

- **blocked**: an open barrier older than 5 days, or a blocked dependency on the next milestone;
- **at risk**: the next milestone is at risk or late;
- **on track**: otherwise;
- **done**: all milestones are done.

**"Management needed"** rules. Each match adds a flag with its reason and the level that should step in:

| Rule | When                                                                                         | Who should step in                      |
| ---- | -------------------------------------------------------------------------------------------- | --------------------------------------- |
| M1   | blocked for more than 5 days                                                                 | sponsor                                 |
| M2   | a milestone is late by more than 3 days, or the next one is at risk and is due within 7 days | sponsor                                 |
| M3   | an open conflict between two participating units (Phase 4 K1)                                | the two units' common manager (G4-Q Q1) |
| M4   | a barrier of kind `decision` whose cost exceeds ₪250k or trades off between units            | CEO / COO                               |
| M5   | spent > budget × 1.1, or projected spend at end > budget × 1.1                               | CFO and sponsor                         |

The **tab** shows its ₪ header first, then a table with one row per initiative:

- status;
- participating departments (chips);
- next milestone and its date;
- barriers;
- dependencies (waiting on / waited on by);
- the "management needed" flag with its reason.

Rows with a flag sort first. Each row opens a timeline of milestones across the participating departments, with the
barriers and dependencies drawn on it. Changes to an initiative are commands (`initiative.create`,
`milestone.complete`, `milestone.move`, `barrier.raise`, `barrier.resolve`), authorized and audited like
commitments. Moving a milestone needs a reason, and the level above may move it too, as in G4-Q Q3.

### As built (E3b, 2026-10-07)

Rules: `src/domain/initiatives.ts` (initiative-rules-v1, unit-tested, and a seed test that holds the §5 stories).
Read model: `initiativesView` (`src/application/queries/initiatives.ts`). Tab: `/initiatives`.

- **Milestone state:** done · late (past due) · at risk when its reported progress is more than 20 points behind
  the straight line from start to due · planned otherwise.
- **Blocked** means an open barrier for more than 5 days (M1 uses the same threshold). The POS upgrade's open
  install-crew barrier (12 days) therefore makes it blocked and M1 as well as M5.
- **M3** counts an open conflict when one of its two plans is linked to the initiative and both plans' owner units
  take part in it. The common manager is found with G4-Q Q1 (the CEO for two departments).
- **M4** "trades off between units" means the decision barrier is owned by another unit than the initiative's owner.
- **M5** projects spend at the end as spent ÷ the share of the work done (mean milestone progress). A straight
  calendar projection flagged healthy initiatives that front-load spend.
- **Who steps in** resolves to people: sponsor; CEO and COO by title; CFO and sponsor; the common manager's
  executives or department managers.
- **Your action items** (top right): approvals and decisions on the initiative's linked insights; conflicts to
  settle; decisions to take (resolve the barrier, with what was decided); reminders to send (sponsor, M1/M2; CFO or
  sponsor, M5 re-forecast); reminders received; and the viewer's own open milestones (mark done, move with a reason).
- **Commands** (`initiative.update`: executive, department manager; audited, refusals too): `milestone.complete`,
  `milestone.move` (reason required, history kept), `barrier.raise`, `barrier.resolve` (resolution required),
  `initiative.remind` (inside VECTOR in the demo, FB-7). A milestone or barrier changes by its owner unit's managers,
  anyone above them, or the sponsor; raising and reminding are open to the sponsor and managers in the initiative.
- Migration 0011: `milestone.history`, `barrier.resolution`, `initiative_reminder`.

## 4. Visibility

The CEO, CFO and COO see all initiatives. Every other C-suite member sees the initiatives their department
participates in (FB-1, ADR-008). Region and branch managers see an initiative when one of their units participates.

## 5. Seeded initiatives (v5)

Eight initiatives cover the existing stories:

1. Holiday-season readiness (Store Operations, Supply Chain, Marketing, HR);
2. North DC recovery (Supply Chain, Store Operations, Finance);
3. POS upgrade (IT, Store Operations, Finance);
4. Click-and-collect scale-up in Center (IT, Store Operations, Marketing);
5. Recall-readiness process (Legal & Compliance, Supply Chain, Store Operations);
6. Wage-rule compliance (HR, Legal & Compliance, Finance);
7. Private-label margin programme (Trade & Commercial, Supply Chain, Marketing);
8. Monthly budget review (process; Finance with every department).

At the story day, North DC recovery is M1 + M3, POS upgrade is M5, and holiday readiness is M2.

## 6. Acceptance (E3)

- The map and the list agree, and every bubble opens its action. Unit tests for economics-v1 and the status and M1–M5
  rules use hand-computed fixtures.
- An integration test checks visibility per C-suite persona (ADR-008 matrix).
- e2e: Dana sees 3 flagged initiatives first; Hila (HR) sees only the initiatives HR participates in.
