# Phase 3 — Organizational Intelligence Experience

Status: **Built and verified locally; awaiting Dev verification and Eran's Phase 3 gate** (started 2026-10-04 after the
Phase 2 sign-off, G-P2, and Eran's go-ahead, P3-go). Charter §31 Phase 3, §18 Product
experience, §32 Phase management.

## Objective

Make the organization understandable at a glance for each role. A person opening VECTOR should know, within a minute,
what needs attention in their part of the organization, how bad it is, why, and what should happen next. They should
get there without browsing data.

## Already in place from Phase 2 (G2)

60-branch organization with 8 departments; both workstreams live; local priority; a performance dashboard per position;
the trace page ("Why am I seeing this?"); the Waiting on you inbox; dark theme (Eran's visual direction, G2).

## Deliverables

1. **Executive Command Center** (home for the Executive and the board observer). It shows:
   - a one-sentence health headline;
   - what changed since yesterday;
   - top priorities;
   - decisions and approvals waiting;
   - recommended actions;
   - health by region and the department pulse;
   - the opportunity lane.
2. **Unit views** at `/units/[id]`: one template for the group, a department, a region and a branch. Each view shows:
   - health and KPIs, each KPI linked to the insights that explain it;
   - risks and opportunities, ranked by local priority where it applies;
   - actions and their owners;
   - dependencies on other departments;
   - child units (a region's branches).
3. **Organizational hierarchy:**
   - breadcrumbs (Group › North › Haifa Grand Canyon);
   - an Organization page with the tree;
   - every region, branch and department name on every screen links to its unit view.
4. **Role-routed home:**
   - Executive and Viewer → Command Center;
   - managers → their own unit view;
   - Admin → Command Center.
5. **Actionable insight cards** everywhere. Each card carries:
   - band and score;
   - a one-line "why" built from the strongest priority drivers;
   - the recommended action;
   - who it is waiting on.
6. **Input validation**: every server action's input is validated with Zod before it reaches a command.
7. **Time-to-Understanding test**: a protocol for a live test with five people, plus an automated check that each role's home
   answers _what · how bad · what to do_ above the fold at 1440×900.

## Product acceptance

- For each role (CEO, a VP, a regional manager, a branch manager), the home page shows, without scrolling:
  - what is wrong, in a headline or the top card;
  - how bad it is (band, ₪ at stake, time to impact);
  - what to do (the recommended action, or the decision or approval waiting on them).
- From any screen, any unit is at most two clicks away, through breadcrumbs, the hierarchy or the inline links.
- A KPI in red always shows the insight that explains it, or says that no insight explains it yet.
- Nobody can open a unit outside their scope (it returns 404, as insights do).

## Technical acceptance

- The unit view's read model is scope-checked in the application layer and covered by integration tests.
- Every server action's input is validated with Zod; there is a test for invalid input on each.
- All earlier smoke and e2e checks still pass; new Phase 3 smoke checks are added.
- CI is green on the PR **and** on `main` after the merge.

## Test strategy

- **Unit:**
  - the "why" line builder;
  - the "what changed" diff;
  - home routing by role.
- **Integration:**
  - unit read model and scope;
  - KPI ↔ insight links;
  - Command Center read model.
- **E2E:**
  - each role's home and drill-downs;
  - 404 for an out-of-scope unit;
  - the above-the-fold Time-to-Understanding check at 1440×900;
  - every page renders.
- **Live:** the Time-to-Understanding protocol (docs/specs/time-to-understanding.md), run by Eran with real people.

## Demo scenario

1. Dana opens VECTOR and reads, in one sentence, that North and Center need attention.
2. Below it, the recall (P1), with the reason and that Legal is handling it.
3. She drills from North to Haifa Grand Canyon in two clicks.
4. Avi's home is his branch: the sales drop is P1 for him, with what he is waiting on from Supply Chain.
5. Noa's home is Supply Chain: what she owns, and who depends on her.

## Risks

- **Too many screens; VECTOR turns into BI.** Mitigation: every unit view leads with insights, and KPIs appear only as
  evidence and context.
- **Performance of read models on 60 branches × 84 days.** Mitigation: aggregate in SQL where it matters, and measure.
- **Overlap with the existing Performance page.** Mitigation: the unit view absorbs it, and `/performance` redirects to your
  own unit.

## As built (2026-10-04)

| Deliverable           | Where                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Command Center        | `/` for Executive, Viewer, Admin; read model `commandCenter()` (headline, what changed in 24 h, biggest moves, health, pulse)    |
| Unit views            | `/units/[id]`; read model `performanceView(…, unitId)`, scope-checked (`canReadUnit`), `null` → 404; one band per item (local)   |
| Hierarchy             | breadcrumbs on unit views; `/org` (tree, departments: owns / involved in); unit names link everywhere                            |
| Role-routed home      | managers → `/units/<own unit>`; `/performance` redirects there                                                                   |
| Actionable cards      | `InsightCard`: band · score, "Why:" (`explainPriority`), recommendation or play, waiting on, owner; "Recently resolved" per unit |
| Input validation      | `src/application/inputs.ts` (Zod) on every server action; `appPath` closes the open redirect on persona switch                   |
| Time-to-Understanding | protocol `docs/specs/time-to-understanding.md`; automated `tests/e2e/00-time-to-understanding.spec.ts` (1440×900, four roles)    |

Tests: `src/domain/priority.test.ts` (explainPriority), `src/application/inputs.test.ts`, `tests/integration/phase3.test.ts`
(scope, KPI links, band consistency, Command Center, org tree), e2e role homes + 404 for an out-of-scope unit, smoke P3 checks.
Screens: `docs/specs/screens/command-center-ceo.png`, `unit-region.png`, `unit-branch.png`, `unit-department.png`,
`organization.png`.

## Approval gates

- **Visual direction:** set by Eran's G2 (dark theme, reference images). No separate mid-phase gate unless the layout
  departs from it.
- **Phase sign-off:** after a demo on Dev, then promotion to Prod.
