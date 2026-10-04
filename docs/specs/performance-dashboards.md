# Performance dashboards

Status: **Built in Phase 2 (Eran's G2 request, 2026-10-04)**: "add a performance dashboard (differentiate between
positions)". Visual reference: Eran's dashboard images (dark navy, cyan accent, KPI cards with target and change, an
organization pulse). Route `/performance`; read model `performanceView` in `src/application/queries/performance.ts`.

Everything is computed at read time from stored KPI observations, insights and actions; the page writes nothing.

## Which dashboard you get

Your **position** is the scope you manage, taken from your role assignments that grant `insight.read`, in this order:

| Position   | Who (seeded)                                   | Dashboard                                                                                                                       |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Group      | CEO, board observer, admin                     | Group KPIs · health by region · organization pulse (8 departments) · both workstreams                                           |
| Region     | Regional managers                              | Region KPIs · its 12 branches (health and KPIs) · "Needs handling" ranked by local priority                                     |
| Branch     | Branch managers (regional_manager at a branch) | Branch KPIs · 4-week daily sales vs usual · "Needs handling" (local) · dependencies on other departments                        |
| Department | Department managers                            | Department health · the KPIs the department owns · what it owns · what it must act on · who it depends on and who depends on it |

Every dashboard starts with the same four summary cards for the viewer's scope: open risks (P1 count and ₪/week at stake),
opportunities (O1 count and ₪/week upside), actions waiting for approval, and actions by state (done, awaiting a decision,
overdue). It ends with the risk and opportunity workstreams by band.

## KPI cards

- **Value:** last 7 complete days before the demo clock. Net sales and transactions are summed; percentages and scores
  are averaged across the scope's branches (or read from the department unit for department KPIs).
- **Change:** versus the 7 days before, in % for sales and transactions, in points otherwise; green when it moves the right
  way for that KPI.
- **Usual level:** for each day, the mean of the same weekday in the four weeks before (the detector's baseline).
- **Target:** the KPI's target where one is set (synthetic-data.md); otherwise the card compares with the usual level.
- **Status dot:** gap to target (or usual), signed so that "worse" is negative: ≥ −1% good · ≥ −5% watch · worse bad.
- **Sparkline:** 28 days of actual (cyan) against target or usual (dashed).

## Health

**Region or branch row** (group and region dashboards):

- **At risk**: a P1 or P2 risk specific to that unit, or two KPIs in "bad";
- **Watch**: any other specific risk, or any KPI off target;
- **On track**: otherwise.

"Specific" means the risk is listed at that unit or inside it and not at every sibling. A group-wide item, such as the
recall that touches all regions, counts once in the scope totals rather than making every row red.

**Department health** (organization pulse and the department dashboard) = 100 − the open risks it owns (P1 20 · P2 10 ·
P3 4 · P4 1) − the open risks it must act on but doesn't own (P1 6 · P2 3 · P3 1), floored at 0. 80+ healthy · 60+ watch ·
below 60 at risk. Ownership is the insight's `owner_department_id`; "must act on" is the department listed among its
affected units.

## Dependencies

- **Branch:** every open action on the branch's insights, labelled with the owner's department ("Your branch" for the
  branch's own people) and state, so a store manager sees what they are waiting on.
- **Department, "We depend on":** actions on insights this department owns that other departments own.
- **Department, "Others depend on us":** actions this department owns on insights other departments own.

## Local priority on dashboards

Region and branch dashboards rank "Needs handling" by local priority (priority-v2.1-local, raise-only; see
[priority.md](priority.md)) and show the group-wide band beside it where they differ.

## Not yet (Phase 3+)

Unit drill-down pages (`/units/[id]`), date range selection, plan-vs-actual budgets per month, and the Time-to-Understanding
test with real users.
