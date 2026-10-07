# Stage E3: opportunities and cross-department (plan v2)

Status: **Built and verified on Dev 2026-10-07; awaiting Eran's E3 gate.** Prod stays on Phase 4 until he asks for a
promotion.

## What shipped

| PR  | What                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| #42 | E3a: G-E2 recorded; store labor budgeted at run-rate 15.3% (G-E2a, seed p5-v2); economics-v1 execution risk; value map on Opportunities and Risks |
| #43 | E3b: the Cross-department tab: initiative status, M1–M5 and who steps in, your action items, audited milestone, barrier and reminder commands     |

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

## Verification

- **Local:** 562 unit, 112 integration and 38 e2e tests pass.
- **Dev (ab6ebf1):** health ok, migrations 12/12, seed p5-v2, smoke 17/17. The full e2e suite passed against Dev
  (38/38), and the demo was reset afterwards.

## Notes for the gate

- The rules as built are in cross-department.md (§2 and §3 "As built"). Two readings to confirm:
  - The POS upgrade is also **M1** (blocked): its install-crew barrier has been open 12 days. It shows M1, M3 and M5.
  - **M5** projects spend from the share of work done, not from the calendar. A calendar projection flagged
    healthy initiatives that spend early.
- Execution risk is low for most opportunity actions: no history yet (0.5 × 25%) and no conflict on their units.
  The two that touch Trade (in the Coast conflict) and IT (in the POS conflict) are medium.
- The progress map reads left to right in Hebrew too (dependency order); the rest of the page is right to left.
- **Next:** E4, the Action Center (suggest how and with whom, editable message, approve or decline, send inside
  VECTOR).
