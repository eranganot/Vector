# Stage E2: C-suite home v2 (plan v2)

Status: **Built and verified on Dev 2026-10-07; awaiting Eran's E2 gate.** Prod stays on Phase 4 until he asks for a
promotion.

## What shipped

| PR  | What                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ |
| #38 | E2a: health-v2 and projection-v1 (pure, hand-computed tests); the home read model; money lines follow the demo clock; migration 0010 |
| #39 | E2b: the C-suite home on screen (wireframes v3 screen 1), department drill-down, VP home, EN/HE, Time-to-Understanding e2e           |
| #40 | E2c: a ₪ header on Risks, Opportunities, Commitments and Actions & outcomes                                                          |

## What to look at in the demo (Dev)

1. **Dana, Michal or Oren → Home.** Four tiles, the organization pulse (eight department rings; links show dependencies
   and conflicts), today's priorities next to October revenue vs budget with its month-end projection and range.
   Below: why health moved, risks & opportunities, outside / inside, the VECTOR insight, departments and regions,
   money vs budget, Waiting on you, Dependencies. "How this is calculated" is at the bottom; hover any mark for its
   value.
2. **Click a department ring** (Supply Chain): its regions as rings and a region × measure heat map, its money lines,
   its measures. "Regions" in the pulse header switches the group view to regions.
3. **Noa (VP Supply Chain) and Hila (VP HR):** they land on their own department. HR has no region split, so its
   measures are the main picture.
4. **Risks, Opportunities, Commitments, Actions & outcomes:** each opens with four ₪ figures for what the page shows;
   the band filter narrows them.
5. **עברית:** everything above in Hebrew, right to left.

## Verification

- **Local:** 545 unit, 103 integration and 34 e2e tests pass. The Time-to-Understanding check shows the four answers
  above the fold at 1440×900 for Dana, Michal and Noa, in English and in Hebrew.
- **Dev (209bc25):** health ok, migrations 11/11, seed p5-v1, smoke 16/16. The full e2e suite passed against Dev
  (34/34), and the demo was reset afterwards.

## The story day in numbers (22 Oct)

Company health 74 ("watch"), ▼12 in a week. Legal & Compliance (40) and Marketing (54) are at risk; Supply Chain (70)
is on watch. October revenue is −1.9% to budget so far and projected −3.4% at month end. Four P1 risks put ₪1.5M a
week at stake.

## For your decision

- **Operating profit reads +16% vs budget.** Store labor runs at 15.3% of sales in the data, but is budgeted at the
  KPI target of 15.8% (approved with G1-c). Together with the marketing freeze, profit looks ahead of budget even
  though revenue is behind. Options: (a) budget store labor at the run-rate (15.3%), which puts operating profit about
  on budget and makes revenue the story; (b) keep it as is: labor efficiency offsets the sales miss. I recommend (a);
  the labor KPI target stays 15.8%, so the labor stories are unchanged.
- **Prod promotion** of E1 + E2, when you want it.

## Notes

- The 7-day change excludes open-risk load, because the catalog stamps every story insight on the story day
  (executive-home.md §4.5).
- Risk drag and action lift move the P&L lines only (net sales, gross margin and operating profit). Cost lines
  project from their run-rate alone.
- **Next:** E3 (opportunities economics view, cross-department tab with the user's action items).
