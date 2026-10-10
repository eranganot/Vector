# Stage E7: Mail agent / Inbox (plan v2)

Status: **Built on Dev (2026-10-10); awaiting Eran's review (G-E7).** Prod stays on E5 until Eran says to promote.

## What shipped

| PR  | What                                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #59 | E7: the Inbox — synthetic email and Slack per C-suite persona (inbox-v1), classification, impact, recommendation, prepared follow-up answers, suggested reply approved and sent in VECTOR only; migration 0016 |

## What to look at in the demo (Dev)

1. Sign in as **Dana Levi** (or any C-suite persona: Michal, Oren, Shira, Noa, Eitan, Ronit, Hila, Yael, Amir).
   **Inbox** sits under Waiting on you, with a badge for what needs you.
2. The top line: how many threads wait for a reply or a decision, and the ₪ a week riding on them.
3. Threads are grouped: **Needs a decision**, **Waiting for your reply** (over 24 h, or 4 h when urgent), **New
   questions**, **For your information**, **Answered**. Each shows age, channel, sender, ₪ at stake and VECTOR's
   recommendation.
4. Open Michal's "Overtime for the North DC second shift": the message, at stake / cost / deadline, the benefit of
   acting now, the recommendation, and a link to the North DC story in VECTOR.
5. **Ask before you decide**: "What if we wait a week?", "What does it cost?", "Who else is affected?" answer from
   VECTOR's data (no free typing in the demo).
6. Edit the suggested reply and **Approve and send**: it joins the thread, the thread moves to Answered, Michal finds
   it in her Waiting on you, and the audit trail records drafted, edited, approved and sent.
7. A reply to an outside party (Eitan's Dairy Co. thread) is recorded and audited but never contacts anyone.
8. Switch to **עברית**: the whole Inbox, threads included, reads right to left.

## Limits

- Threads are synthetic and template-only (FB-10, FB-11). Real Gmail / Microsoft 365 / Slack connections, AI
  classification and free-form questions come after the MVP (mail-agent.md §3).
- New mail does not arrive when the demo clock moves; the inbox is the one seeded at reset.

## Decisions for Eran

1. **Accept E7** (G-E7).
2. **Promote Prod**: to E6, or straight to E7 once accepted?
