# Stage E3: opportunities and cross-department (plan v2)

Status: **Accepted by Eran 2026-10-07 (G-E3)**, with one comment (due-date and ₪ formatting) to fix in E4. Prod
promotion is a separate step.

## What shipped

| PR  | What                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #42 | E3a: G-E2 recorded; store labor budgeted at run-rate 15.3% (G-E2a, seed p5-v2); economics-v1 execution risk; value map on Opportunities and Risks                                                                            |
| #45 | E3c: Eran's review: clear action items (what, who, waiting on, blockers, one button), item cards with analysis and recommendation, clickable status filters and deviations, labelled band filters, fixed top bar and sidebar |
| #43 | E3b: the Cross-department tab: initiative status, M1–M5 and who steps in, your action items, audited milestone, barrier and reminder commands                                                                                |

## What to look at in the demo (Dev)

1. **Opportunities:** the value map (impact by quarter end vs cost; bubble size = execution risk; dashed line =
   break-even) and the action items ranked by net value, with risk, days to value and when the window closes. Hover a
   bubble for the risk factors; click it to open the action on its insight. **Risks** has the same map for responses.
2. **Cross-department (Dana):** eight initiatives; North DC recovery, POS upgrade and holiday readiness need
   management and come first. The selected initiative shows its progress map (one ring per department, red dashes
   where someone is waiting or late), the milestones on a timeline with today, and — top right — **your action
   items**: approve the weekend staffing, settle Marketing ↔ Finance, decide the overtime exception.
3. **Oren (sponsor, COO)** can nudge HR on the late temporary staff ("Send reminder"; the message is editable and
   stays inside VECTOR). **Hila (HR)** then sees the reminder and can mark the milestone done or move it with a reason.
4. **Hila** sees only the four initiatives HR takes part in.
5. **Home:** operating profit now reads about on budget (G-E2a).
6. **עברית:** all of it in Hebrew, right to left.

## Your review, as revised (E3c)

1. **Opportunities / Risks:** the filters now say what they mean ("Show by value band: O1 pursue now · O2 plan · O3
   watch"). Beside the map, **Who needs to act**: how many items wait for a decision, for approval, are blocked or wait
   on you, and each person with what they hold. Below, the **Action plan**: per item what, owner, next step and who it
   waits on, blockers, due date, net value and risk, and one button. Click an item for its analysis and recommendation.
2. **Cross-department:** **What needs to happen** lists every milestone, barrier, conflict, budget issue and linked
   action of the selected initiative, with who acts, due date, next step and what blocks it, problems first.
3. **Click anything** — an item, a deviation, one of your action items, a bar on the timeline — to open its card:
   who acts, the analysis, VECTOR's recommendation and your buttons.
4. **Status tiles filter:** late, blocked or at risk · waiting for a decision · in progress · done · waiting on you.
   Click again to clear.
5. **The top bar and the sidebar stay on screen** while you scroll, on every page.

## Verification

- **Local:** 562 unit, 114 integration and 40 e2e tests pass.
- **Dev (12a6ba6):** health ok, migrations 12/12, seed p5-v2, smoke 17/17. The full e2e suite passed against Dev
  (40/40), and the demo was reset afterwards.

## Notes for the gate

- The rules as built are in cross-department.md (§2 and §3 "As built"). Both readings below were approved (G-E3a):
  - The POS upgrade is also **M1** (blocked): its install-crew barrier has been open 12 days. It shows M1, M3 and M5.
  - **M5** projects spend from the share of work done, not from the calendar. A calendar projection flagged
    healthy initiatives that spend early.
- Execution risk is low for most opportunity actions: no history yet (0.5 × 25%) and no conflict on their units.
  The two that touch Trade (in the Coast conflict) and IT (in the POS conflict) are medium.
- The progress map reads left to right in Hebrew too (dependency order); the rest of the page is right to left.
- **Next:** E4, the Action Center (suggest how and with whom, editable message, approve or decline, send inside
  VECTOR).
