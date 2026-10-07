# Stage E4: Action Center (plan v2)

Status: **Built and verified on Dev (4dc66f0); awaiting Eran's E4 gate.** Prod promotion is a separate step.

## What shipped

| PR  | What                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #49 | E4d (your review): event → action plan rebuilt; Cross-department "How a delay travels between departments" with what-if                                                                                                              |
| #47 | Action Center: queue with one button, selected item (who is involved, steps, "When you approve, VECTOR will…", with whom and why, editable message), Approve and send through the lifecycle, in-app messages; Action plan formatting |

## What to look at in the demo (Dev)

1. **Action Center (Dana, in the sidebar after Waiting on you):** the queue on the left, ranked by ₪ a week × urgency
   × whether it is yours, one button each. The ₪ header: ₪ waiting for a decision, expected impact awaiting approval,
   items you can act on, messages sent this week.
2. **Select an item** (for example "Competitor store near Ramat Gan Ayalon"): the facts and VECTOR's recommendation,
   **who is involved** (one box per department with its part and status), the **steps** with cost, impact, due date and
   who must approve them, and **"When you approve, VECTOR will…"** in plain words.
3. **With whom:** VECTOR suggests the person who owns the first step (Ronit) and copies the heads of the affected
   departments and initiative sponsors, each with the reason. You can change the recipient or untick anyone.
4. **The message** is written for you in your language and is fully editable. **Approve and send** records your
   decision; if a step needs someone else's approval (here Maya, AP-3), the message waits and goes out the moment she
   approves. If the approval is yours (the North stock-out's weekend staffing), it is granted on the same click.
   Nothing leaves VECTOR: the message arrives in the recipient's **Waiting on you → Messages for you**.
5. **Decline** asks for a reason and records it. **History** shows every step, including the message's.
6. **From event to action plan:** the weekly ops meeting and the four tasks it created, with owners, dates and status.
7. **Home:** Decide / Approve / Act in Today's priorities, and the Action plan buttons on Opportunities and Risks,
   now open the item in the Action Center.
8. **Your E3 comment:** the Action plan's Due column reads "24 Oct" with "in 2 d" or "overdue" under it, and Net reads
   "+₪307k" with the risk under it; neither wraps (English and Hebrew).
9. **עברית:** all of it in Hebrew, right to left, including the suggested message.

## Your review, as revised (E4d)

1. **From event to action plan** (Action Center, bottom): what the meeting produced and how many departments depend on
   it; tiles for late / at risk or due soon / on track / done, ₪ a week depending on the open tasks and ₪ lost so far.
   One card per task, late first: a coloured status ("Late · 3 d past 19 Oct" in red), the owner, **Next step** in
   words, **Who waits on it** (department, what, needed by, ₪ a week), and the money: **cost to do**, **at stake if not
   done**, **each week it slips** (and who it would be late for), **lost so far** (with the days of slack left).
2. **Cross-department → How a delay travels between departments** (under the initiative's map): each department's
   commitments in the order they feed each other, arrows for "needs it by", red where something arrives late, with the
   days and ₪. **What if it slips?** +3 / +7 / +14 days on any box shows who gets it late and what it costs; for the
   holiday initiative, a week's slip at Marketing makes Store Operations and the five regions 6 days late, about ₪514k.

## Verified

- Local: format, lint, typecheck, unit 568, integration 119, e2e 43/43, smoke 18/18.
- CI green on the PR and on `main` (4dc66f0) before and after the merge.
- Dev 4dc66f0: health ok, migrations 13/13, smoke 18/18 (phase 8 added), e2e 43/43 against Dev, demo reset after.

## Differences from the proposal (docs/specs/action-center.md §6)

- The suggested recipient is the owner of the first step, not the head of the owning unit (the step owner acts).
- "Edit action" is not in the panel; amending stays on the insight's trace.
- No separate Inbox yet (E7); delivered messages appear in Waiting on you.
- The e2e runs the story on the competitor-closing opportunity; the North stock-out version runs in the integration
  test (the Phase 4 e2e uses the stock-out's staffing action in the same run).

## For your decision

1. Accept E4 (or comments).
2. Whether to promote Prod (`demo`, still Phase 4) now or after a later stage.
