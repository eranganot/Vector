/**
 * inbox-v1 (plan v2, E7; mail-agent.md §2): a synthetic inbox per C-suite persona, seeded deterministically. Each
 * persona gets three threads that matter, linked to the VECTOR stories they are about (so impact and recommendation
 * agree with every other screen), plus twelve routine threads (updates, meetings, answered questions). Times are hours
 * before the demo clock. Hebrew for every string is in src/i18n/messages/he-inbox.ts.
 */
import type { FollowUp } from "@/domain/inbox";

export type Party = { user: string } | { name: string; role: string };
export type Link =
  { type: "insight"; catalog: string } | { type: "commitment"; key: string } | { type: "initiative"; key: string };

export type ThreadSeed = {
  id: string;
  owner: string;
  channel: "email" | "slack";
  subject: string;
  with: Party;
  /** Oldest first. "them" is the counterpart; "owner" the persona; a user key is a third colleague. */
  messages: { from: "them" | "owner" | string; hoursAgo: number; body: string; toOwner?: boolean }[];
  asks?: boolean;
  decision?: boolean;
  urgent?: boolean;
  link?: Link;
  impactIls?: number;
  costIls?: number;
  deadlineHours?: number;
  benefit?: string;
  recommendation?: string;
  reply?: string;
  followUps: FollowUp[];
};

export const KEY_THREADS: ThreadSeed[] = [
  // ── Dana Levi, CEO ──
  {
    id: "dana-1",
    owner: "dana",
    channel: "email",
    subject: "Overtime for the North DC second shift: exception to the freeze?",
    with: { user: "michal" },
    messages: [
      {
        from: "them",
        hoursAgo: 26,
        body: "Dana, Noa asks for an exception to the spend freeze: a second DC shift on overtime for two weeks, ₪180k. Without it the North delays continue. Can you approve it, capped at two weeks?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "insight", catalog: "R2" },
    costIls: 180_000,
    deadlineHours: 10,
    benefit: "North deliveries recover about a week sooner, which protects the 14 branches' weekly sales.",
    recommendation: "Approve as an exception, capped at ₪180k and two weeks, with a review on day 7.",
    reply: "Michal, approved as an exception to the freeze: ₪180k cap, two weeks, and a review with Noa on day 7. Dana",
    followUps: ["wait_week", "cost", "who_affected"],
  },
  {
    id: "dana-2",
    owner: "dana",
    channel: "slack",
    subject: "Run the Q4 campaign at ₪220k instead of ₪350k?",
    with: { user: "ronit" },
    messages: [
      {
        from: "them",
        hoursAgo: 30,
        body: "Dana, Finance's freeze blocks the ₪350k campaign. I can launch on time with ₪220k (fewer TV spots, same in-store). Are you OK with that?",
      },
    ],
    asks: true,
    link: { type: "insight", catalog: "R7" },
    benefit: "The launch keeps its date; the cut comes from TV, which drives the least store traffic.",
    recommendation: "Agree to ₪220k and ask Michal to confirm the reallocation by tomorrow 12:00.",
    reply:
      "Ronit, ₪220k works for me if the launch date holds. Michal, please confirm the reallocation by tomorrow 12:00.",
    followUps: ["wait_week", "who_decides", "who_affected"],
  },
  {
    id: "dana-3",
    owner: "dana",
    channel: "email",
    subject: "Recall: press statement ready for your review",
    with: { user: "yael" },
    messages: [
      {
        from: "them",
        hoursAgo: 6,
        body: "Dana, the regulator acknowledged our notice. The press statement on batch 4471 is ready; Legal has checked it. Can you approve it before 14:00 today?",
      },
    ],
    asks: true,
    urgent: true,
    link: { type: "insight", catalog: "R1" },
    deadlineHours: 6,
    benefit: "A statement out before the evening news keeps the story about our quick recall, not about silence.",
    recommendation: "Approve the statement as drafted.",
    reply: "Yael, approved as drafted. Please send it out before 14:00 and share the coverage tonight. Dana",
    followUps: ["who_affected", "last_time", "who_decides"],
  },
  // ── Michal Golan, CFO ──
  {
    id: "michal-1",
    owner: "michal",
    channel: "email",
    subject: "POS wave 3 needs ₪400k more",
    with: { user: "amir" },
    messages: [
      {
        from: "them",
        hoursAgo: 30,
        body: "Michal, the vendor's change order for POS wave 3 is ₪400k over budget (new payment terminals). Can Finance release it this week so wave 3 starts on 26 October?",
      },
    ],
    asks: true,
    link: { type: "initiative", key: "I-POS" },
    costIls: 400_000,
    deadlineHours: 72,
    benefit: "Wave 3 starts on time and the old terminals are out before the holiday peak.",
    recommendation: "Ask for a phased plan: release ₪150k for the terminals now, the rest after the holiday.",
    reply:
      "Amir, I can release ₪150k now for the terminals. Please send a phased plan for the remaining ₪250k after the holiday.",
    followUps: ["cost", "wait_week", "who_affected"],
  },
  {
    id: "michal-2",
    owner: "michal",
    channel: "slack",
    subject: "Q4 labor re-forecast for the wage rule: sign off today?",
    with: { user: "hila" },
    messages: [
      {
        from: "them",
        hoursAgo: 20,
        body: "Michal, the new wage rule adds about ₪120k a week to labor cost from next month. Can Finance sign off the Q4 re-forecast today so payroll can load the new tables?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "insight", catalog: "R5" },
    impactIls: 120_000,
    deadlineHours: 30,
    benefit: "Payroll loads compliant tables in time; the board sees the cost in the Q4 forecast, not as a surprise.",
    recommendation: "Sign off the re-forecast and flag the ₪120k a week in the board pack.",
    reply: "Hila, signed off: the Q4 re-forecast includes the ₪120k a week. I am adding it to the board pack. Michal",
    followUps: ["wait_week", "who_affected", "who_decides"],
  },
  {
    id: "michal-3",
    owner: "michal",
    channel: "email",
    subject: "Q3 review: inventory count date",
    with: { name: "Orly Shani", role: "Audit partner, external auditors" },
    messages: [
      {
        from: "them",
        hoursAgo: 50,
        body: "Michal, for the Q3 review we need to observe one inventory count. Can you confirm 3 November at the Center DC?",
      },
    ],
    asks: true,
    benefit: "Confirming now keeps the review on schedule for the board meeting.",
    recommendation: "Confirm 3 November and copy Noa, who runs the Center DC.",
    reply: "Orly, 3 November at the Center DC is confirmed. Noa Friedman (Supply Chain) will host. Michal",
    followUps: ["who_affected", "wait_week", "who_decides"],
  },
  // ── Oren Halevi, COO ──
  {
    id: "oren-1",
    owner: "oren",
    channel: "email",
    subject: "Reroute two trucks via the Center DC for three days?",
    with: { user: "noa" },
    messages: [
      {
        from: "them",
        hoursAgo: 28,
        body: "Oren, rerouting two trucks via the Center DC for three days would cover the 14 branches while the North DC recovers. It costs about ₪24k. Do I have your OK?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "insight", catalog: "R2" },
    costIls: 24_000,
    deadlineHours: 20,
    benefit: "Shelves in 14 branches are refilled within a day instead of waiting for the North DC.",
    recommendation: "Approve the reroute for three days; Noa reports the fill rate daily.",
    reply:
      "Noa, approved: reroute two trucks via the Center DC for three days. Please send me the fill rate daily. Oren",
    followUps: ["cost", "wait_week", "last_time"],
  },
  {
    id: "oren-2",
    owner: "oren",
    channel: "slack",
    subject: "Weekend staffing uplift for 9 North branches",
    with: { user: "shira" },
    messages: [
      {
        from: "them",
        hoursAgo: 14,
        body: "Oren, with the stock-outs before the holiday weekend I want 2 extra people per shift in the 9 North branches, Thursday to Saturday. OK to go ahead?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "insight", catalog: "R3" },
    deadlineHours: 26,
    benefit: "Restocking keeps pace with the incoming transfer, so the holiday weekend sales are not lost.",
    recommendation: "Approve for this weekend only and review after the holiday.",
    reply: "Shira, approved for this weekend only. Let's review the numbers on Sunday. Oren",
    followUps: ["wait_week", "who_affected", "cost"],
  },
  {
    id: "oren-3",
    owner: "oren",
    channel: "email",
    subject: "Driver shortage next week",
    with: { name: "Avner Golan", role: "Fleet contractor" },
    messages: [
      {
        from: "them",
        hoursAgo: 40,
        body: "Oren, we are short of 6 drivers next week because of reserve duty. Can you move two delivery waves from Sunday to Monday?",
      },
    ],
    asks: true,
    benefit: "An early answer lets Supply Chain replan the waves instead of losing them.",
    recommendation: "Ask Noa to replan Sunday's two waves to Monday and confirm with the contractor.",
    reply:
      "Avner, thanks for the warning. Noa Friedman will confirm the new plan for the two Sunday waves by tomorrow. Oren",
    followUps: ["who_affected", "wait_week", "who_decides"],
  },
  // ── Shira Katz, VP Store Operations ──
  {
    id: "shira-1",
    owner: "shira",
    channel: "email",
    subject: "Evening security guard at Dizengoff for two weeks?",
    with: { user: "lior" },
    messages: [
      {
        from: "them",
        hoursAgo: 33,
        body: "Shira, shrinkage at Dizengoff is still rising, mostly health & beauty in the evenings. An evening guard for two weeks costs ₪16k. Can I book one from Sunday?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "insight", catalog: "R10" },
    costIls: 16_000,
    deadlineHours: 48,
    benefit: "Stops the evening losses while the stock audit finds the cause.",
    recommendation: "Approve two weeks and ask for the stock audit results before extending.",
    reply: "Lior, approved for two weeks from Sunday. Send me the stock audit results before we extend. Shira",
    followUps: ["cost", "wait_week", "last_time"],
  },
  {
    id: "shira-2",
    owner: "shira",
    channel: "slack",
    subject: "Autumn rosters for 12 Center branches",
    with: { user: "maya" },
    messages: [
      {
        from: "them",
        hoursAgo: 22,
        body: "Shira, the new autumn rosters bring Center labor back to plan (about −6%). They need your approval before Thursday's publish. Can you approve?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "insight", catalog: "R11" },
    deadlineHours: 40,
    benefit: "Labor cost in the Center returns to plan from next week.",
    recommendation: "Approve the rosters.",
    reply: "Maya, approved. Please publish on Thursday as planned. Shira",
    followUps: ["wait_week", "who_affected", "who_decides"],
  },
  {
    id: "shira-3",
    owner: "shira",
    channel: "email",
    subject: "Holiday opening hours in the North",
    with: { user: "yossi" },
    messages: [
      {
        from: "them",
        hoursAgo: 52,
        body: "Shira, three North branches want to open an hour later on the holiday eve because of staffing. Can we agree on that before the website is updated?",
      },
    ],
    asks: true,
    link: { type: "commitment", key: "IT-HOURS" },
    benefit: "The website and the stores show the same hours on the holiday eve.",
    recommendation: "Agree for the three branches and ask IT to update the website today.",
    reply: "Yossi, agreed for the three branches. I've asked IT to update the website today. Shira",
    followUps: ["who_affected", "wait_week", "who_decides"],
  },
  // ── Noa Friedman, VP Supply Chain ──
  {
    id: "noa-1",
    owner: "noa",
    channel: "email",
    subject: "Temporary DC staff 4 days late: second agency at +15%?",
    with: { user: "ben" },
    messages: [
      {
        from: "them",
        hoursAgo: 27,
        body: "Noa, the first agency is 4 days late with the temporary DC staff. A second agency can start Sunday at +15% on the hourly rate. Shall I sign?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "initiative", key: "I-NORTH-DC" },
    costIls: 35_000,
    deadlineHours: 24,
    benefit: "The North DC gets back to full waves four days sooner.",
    recommendation: "Sign with the second agency for two weeks and claim the delay penalty from the first.",
    reply:
      "Ben, sign with the second agency for two weeks. Please also claim the delay penalty from the first agency. Noa",
    followUps: ["cost", "wait_week", "who_affected"],
  },
  {
    id: "noa-2",
    owner: "noa",
    channel: "email",
    subject: "When will the replenishment reach Haifa Grand Canyon?",
    with: { user: "avi" },
    messages: [
      {
        from: "them",
        hoursAgo: 31,
        body: "Noa, our dairy and bakery shelves are half empty. When will the replenishment I asked for arrive?",
      },
    ],
    asks: true,
    link: { type: "commitment", key: "B-HFA-REQUEST" },
    benefit: "Avi can plan staff and tell customers when the shelves are full again.",
    recommendation: "Give Avi a delivery window and confirm the transfer from Haifa Carmel.",
    reply: "Avi, the transfer from Haifa Carmel arrives tomorrow before 10:00. I'll confirm when the truck leaves. Noa",
    followUps: ["wait_week", "who_affected", "last_time"],
  },
  {
    id: "noa-3",
    owner: "noa",
    channel: "email",
    subject: "Dairy Co.: delivery slots change from Sunday",
    with: { name: "Rafi Ezra", role: "Logistics manager, Dairy Co." },
    messages: [
      {
        from: "them",
        hoursAgo: 8,
        body: "Noa, from Sunday our trucks reach your DCs at 05:00 instead of 06:30. Please confirm your docks can receive them.",
      },
    ],
    asks: true,
    benefit: "Earlier dairy deliveries reach the shelves before the morning rush.",
    recommendation: "Confirm and ask Ben to move the dock shift.",
    reply: "Rafi, confirmed for Sunday. Ben Shalom will move the dock shift to 05:00. Noa",
    followUps: ["who_affected", "wait_week", "who_decides"],
  },
  // ── Eitan Rosen, VP Trade & Commercial ──
  {
    id: "eitan-1",
    owner: "eitan",
    channel: "email",
    subject: "Price increase of 7% on 120 SKUs from 1 November",
    with: { name: "Gadi Levin", role: "Sales director, Dairy Co." },
    messages: [
      {
        from: "them",
        hoursAgo: 46,
        body: "Eitan, as announced, our prices rise by 7% on 120 SKUs from 1 November. Please confirm by Friday so we can update your price lists.",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "insight", catalog: "R6" },
    deadlineHours: 54,
    benefit:
      "Holding the old prices for 30 days protects the margin on the promotion already planned on 30 of the SKUs.",
    recommendation: "Invoke the 30-day price-protection clause and negotiate the increase on the other 90 SKUs.",
    reply:
      "Gadi, we are invoking the 30-day price-protection clause in our agreement. We are ready to discuss the other 90 SKUs next week. Eitan",
    followUps: ["wait_week", "last_time", "who_decides"],
  },
  {
    id: "eitan-2",
    owner: "eitan",
    channel: "email",
    subject: "Overstock offer: 25% off two categories, 5 days",
    with: { name: "Dror Sasson", role: "Key account manager, Snackworks" },
    messages: [
      {
        from: "them",
        hoursAgo: 49,
        body: "Eitan, we can offer 25% off our snacks and cereal bars for a full truckload each, if you order within 5 days. Interested?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "insight", catalog: "O3" },
    deadlineHours: 72,
    benefit: "Cheaper stock in two categories where we already lead on price.",
    recommendation: "Counter at half the volume, so the stock sells before its date.",
    reply: "Dror, thanks for the offer. We can take half a truckload of each at 25% off, delivered next week. Eitan",
    followUps: ["wait_week", "last_time", "who_decides"],
  },
  {
    id: "eitan-3",
    owner: "eitan",
    channel: "slack",
    subject: "Hold the Coast delisting a week?",
    with: { user: "ronit" },
    messages: [
      {
        from: "them",
        hoursAgo: 25,
        body: "Eitan, our Coast promotion includes 14 items you are delisting. Can you hold the delisting one week so the promotion runs as printed?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "insight", catalog: "R12" },
    deadlineHours: 48,
    benefit: "The promotion runs as printed and the delisting follows a week later, with no empty shelf tags.",
    recommendation: "Swap the 14 items for their replacements instead of holding the delisting.",
    reply:
      "Ronit, I'd rather not hold it: let's swap the 14 items for their replacements in the promo. My team sends the list today. Eitan",
    followUps: ["who_affected", "wait_week", "who_decides"],
  },
  // ── Ronit Shapiro, VP Marketing ──
  {
    id: "ronit-1",
    owner: "ronit",
    channel: "email",
    subject: "Holiday assets: full set Friday 10:00, or a reduced set now?",
    with: { name: "Keren Avital", role: "Account director, Studio North (creative agency)" },
    messages: [
      {
        from: "them",
        hoursAgo: 18,
        body: "Ronit, the full asset set will be ready Friday at 10:00. We can send a reduced set for in-house printing today. Which do you want?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "insight", catalog: "R4" },
    deadlineHours: 12,
    benefit: "Signage reaches all 60 branches before the launch.",
    recommendation: "Take the reduced set now for in-house printing, and the full set Friday for the second week.",
    reply:
      "Keren, please send the reduced set today for in-house printing, and the full set on Friday for the second week. Ronit",
    followUps: ["wait_week", "who_affected", "last_time"],
  },
  {
    id: "ronit-2",
    owner: "ronit",
    channel: "slack",
    subject: "Campaign budget: can you live with ₪220k?",
    with: { user: "michal" },
    messages: [
      {
        from: "them",
        hoursAgo: 28,
        body: "Ronit, I can reallocate ₪220k from IT phase 2 to the Q4 campaign, not ₪350k. Can you work with that?",
      },
    ],
    asks: true,
    link: { type: "insight", catalog: "R7" },
    benefit: "The campaign is funded and launches on time.",
    recommendation: "Accept ₪220k and cut TV spots, not in-store.",
    reply: "Michal, yes, ₪220k works. I'll cut TV spots and keep in-store as planned. Ronit",
    followUps: ["who_decides", "who_affected", "wait_week"],
  },
  {
    id: "ronit-3",
    owner: "ronit",
    channel: "email",
    subject: "Competitor closing near Ramat Gan: a welcome campaign?",
    with: { user: "dana" },
    messages: [
      {
        from: "them",
        hoursAgo: 12,
        body: "Ronit, the competitor store near Ramat Gan Ayalon closes in three weeks. Can you propose a welcome campaign for their shoppers by Sunday?",
      },
    ],
    asks: true,
    link: { type: "insight", catalog: "O2" },
    benefit: "We reach their shoppers before they settle on another chain.",
    recommendation: "Propose a local loyalty offer and leaflets within 3 km, ready by Sunday.",
    reply: "Dana, I'll send a proposal by Sunday: a local loyalty offer and leaflets within 3 km of the store. Ronit",
    followUps: ["wait_week", "cost", "who_affected"],
  },
  // ── Hila Dahan, VP HR ──
  {
    id: "hila-1",
    owner: "hila",
    channel: "email",
    subject: "Updated pay tables: Legal needs them by Thursday",
    with: { user: "yael" },
    messages: [
      {
        from: "them",
        hoursAgo: 7,
        body: "Hila, to clear the new pay tables before the wage rule starts, Legal needs them by Thursday. Can you send them today?",
      },
    ],
    asks: true,
    urgent: true,
    link: { type: "commitment", key: "H-PAY" },
    deadlineHours: 30,
    benefit: "The pay tables are cleared before the rule starts, so payroll is compliant on day one.",
    recommendation: "Send today's draft and agree a review slot with Legal for Wednesday.",
    reply: "Yael, sending today's draft now. Can we review it together on Wednesday at 11:00? Hila",
    followUps: ["wait_week", "who_affected", "who_decides"],
  },
  {
    id: "hila-2",
    owner: "hila",
    channel: "slack",
    subject: "POS training for the 5 pilot branches next week?",
    with: { user: "amir" },
    messages: [
      {
        from: "them",
        hoursAgo: 26,
        body: "Hila, if the POS cut-over moves after the holiday, we pilot in 5 branches first. Can HR book the training for next week?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "insight", catalog: "R9" },
    deadlineHours: 72,
    benefit: "Pilot staff are trained before the cut-over, so tills keep running.",
    recommendation: "Book two training sessions per pilot branch next week.",
    reply: "Amir, booked: two sessions per pilot branch next week. I'll send the schedule tomorrow. Hila",
    followUps: ["who_affected", "wait_week", "last_time"],
  },
  {
    id: "hila-3",
    owner: "hila",
    channel: "email",
    subject: "20 DC workers from Monday at +15%",
    with: { name: "Tamar Ohana", role: "Account manager, StaffPlus (temp agency)" },
    messages: [
      {
        from: "them",
        hoursAgo: 23,
        body: "Hila, we can supply 20 DC workers from Monday at +15% on the standard rate, for two weeks. Shall we prepare the contract?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "initiative", key: "I-NORTH-DC" },
    costIls: 35_000,
    deadlineHours: 30,
    benefit: "The North DC has the people it needs four days sooner.",
    recommendation: "Prepare a two-week contract and align the start date with Noa.",
    reply: "Tamar, please prepare a two-week contract from Monday. Noa Friedman will confirm the shifts. Hila",
    followUps: ["cost", "wait_week", "who_affected"],
  },
  // ── Yael Barak, General Counsel ──
  {
    id: "yael-1",
    owner: "yael",
    channel: "email",
    subject: "Recall of batch 4471: final report due in 48 h",
    with: { name: "Dr. Nili Barak", role: "Food-safety regulator, recall unit" },
    messages: [
      {
        from: "them",
        hoursAgo: 30,
        body: "Ms Barak, please submit the final recall report for batch 4471 within 48 hours, including the quantities recovered per branch.",
      },
    ],
    asks: true,
    link: { type: "insight", catalog: "R1" },
    deadlineHours: 18,
    benefit: "A complete report on time closes the recall with the regulator.",
    recommendation: "Confirm receipt now and submit tomorrow with Supply Chain's per-branch figures.",
    reply:
      "Dr. Barak, thank you. We will submit the final report tomorrow, with the quantities recovered in each of our 60 branches. Yael Barak",
    followUps: ["wait_week", "who_affected", "last_time"],
  },
  {
    id: "yael-2",
    owner: "yael",
    channel: "slack",
    subject: "Can we invoke price protection with Dairy Co.?",
    with: { user: "eitan" },
    messages: [
      {
        from: "them",
        hoursAgo: 29,
        body: "Yael, does our Dairy Co. agreement let us hold the old prices for 30 days on the 7% increase?",
      },
    ],
    asks: true,
    link: { type: "insight", catalog: "R6" },
    benefit: "Eitan can answer the supplier before Friday with a clear legal position.",
    recommendation: "Confirm the 30-day clause applies and send Eitan the wording.",
    reply:
      "Eitan, yes: clause 9.2 gives us 30 days of price protection on notified increases. Wording follows by email. Yael",
    followUps: ["who_decides", "wait_week", "last_time"],
  },
  {
    id: "yael-3",
    owner: "yael",
    channel: "email",
    subject: "Recall notice templates approved: publish to branches?",
    with: { user: "dafna" },
    messages: [
      {
        from: "them",
        hoursAgo: 21,
        body: "Yael, the new recall notice templates are approved by our team. Shall I publish them to all branches today?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "commitment", key: "L-RECALL-TEMPLATES" },
    deadlineHours: 48,
    benefit: "Every branch has a ready notice for the next recall, in Hebrew and Arabic.",
    recommendation: "Publish today and ask Store Operations to confirm each branch has them.",
    reply: "Dafna, yes, publish today, and ask Store Operations to confirm every branch has received them. Yael",
    followUps: ["who_affected", "last_time", "who_decides"],
  },
  // ── Amir Klein, CIO ──
  {
    id: "amir-1",
    owner: "amir",
    channel: "email",
    subject: "Move the POS cut-over after the holiday?",
    with: { user: "shira" },
    messages: [
      {
        from: "them",
        hoursAgo: 35,
        body: "Amir, the POS cut-over falls inside the holiday peak in all 60 branches. Can we move it after the holiday and pilot in 5 branches first?",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "insight", catalog: "R9" },
    deadlineHours: 60,
    benefit: "No till outage during the busiest weeks of the year.",
    recommendation: "Move the cut-over after the holiday and pilot in 5 branches.",
    reply:
      "Shira, agreed: the 60-branch cut-over moves after the holiday, with a 5-branch pilot first. I'll share dates tomorrow. Amir",
    followUps: ["wait_week", "who_affected", "last_time"],
  },
  {
    id: "amir-2",
    owner: "amir",
    channel: "email",
    subject: "Wave 3 change order: ₪400k",
    with: { name: "Itay Ronen", role: "Project manager, POS vendor" },
    messages: [
      {
        from: "them",
        hoursAgo: 44,
        body: "Amir, attached is the change order for wave 3 (new payment terminals, ₪400k). We need your signature this week to keep 26 October.",
      },
    ],
    asks: true,
    decision: true,
    link: { type: "initiative", key: "I-POS" },
    costIls: 400_000,
    deadlineHours: 72,
    benefit: "Wave 3 keeps its date.",
    recommendation: "Ask the vendor to split the order: terminals now, the rest after the holiday.",
    reply:
      "Itay, please split the change order: the terminals now and the rest after the holiday. Finance is reviewing the first part. Amir",
    followUps: ["cost", "wait_week", "who_decides"],
  },
  {
    id: "amir-3",
    owner: "amir",
    channel: "slack",
    subject: "Self-checkout firmware fix at Center branches: ETA?",
    with: { user: "maya" },
    messages: [
      {
        from: "them",
        hoursAgo: 27,
        body: "Amir, the self-checkouts in 4 Center branches still freeze at peak hours. When does the firmware fix arrive?",
      },
    ],
    asks: true,
    link: { type: "commitment", key: "IT-SCO" },
    benefit: "Queues at peak hours shorten in 4 Center branches.",
    recommendation: "Give Maya a date and a workaround until then.",
    reply:
      "Maya, the firmware fix goes out on Tuesday night. Until then, restart the self-checkouts at 16:00 to avoid the freeze. Amir",
    followUps: ["wait_week", "who_affected", "who_decides"],
  },
];

/**
 * Routine threads, the same twelve for every persona with a colleague as the other party: updates, meetings, answered
 * questions. They make the inbox realistic and show what VECTOR leaves out of "needs you".
 */
export type RoutineSeed = Omit<ThreadSeed, "id" | "owner" | "with" | "followUps"> & {
  key: string;
  /** Index into the persona's colleagues (round-robin), or an outside party. */
  with: number | { name: string; role: string };
};

export const ROUTINE_THREADS: RoutineSeed[] = [
  {
    key: "weekly-summary",
    channel: "email",
    subject: "Weekly summary from your team",
    with: 0,
    messages: [
      {
        from: "them",
        hoursAgo: 60,
        body: "Hi, here is this week's summary: targets on track, two open items carried to next week.",
      },
    ],
  },
  {
    key: "holiday-schedule",
    channel: "slack",
    subject: "#announcements: holiday office hours",
    with: { name: "Office management", role: "Head office" },
    messages: [
      {
        from: "them",
        hoursAgo: 70,
        body: "Head office closes at 13:00 on the holiday eve and reopens after the holiday.",
        toOwner: false,
      },
    ],
  },
  {
    key: "meeting-tuesday",
    channel: "email",
    subject: "Meeting on Tuesday at 10:00?",
    with: 1,
    messages: [
      { from: "them", hoursAgo: 80, body: "Can we meet on Tuesday at 10:00 to go over next quarter's plan?" },
      { from: "owner", hoursAgo: 78, body: "Tuesday at 10:00 works. See you then." },
    ],
    asks: true,
  },
  {
    key: "quick-question",
    channel: "slack",
    subject: "Quick question on next week's plan",
    with: 2,
    messages: [{ from: "them", hoursAgo: 5, body: "Do you want the plan in the usual format, or one page this time?" }],
    asks: true,
  },
  {
    key: "newsletter",
    channel: "email",
    subject: "Retail trends this week",
    with: { name: "Retail Insights newsletter", role: "Newsletter" },
    messages: [
      {
        from: "them",
        hoursAgo: 30,
        body: "This week: discount chains keep gaining share; shoppers buy smaller baskets more often.",
        toOwner: false,
      },
    ],
  },
  {
    key: "expense",
    channel: "email",
    subject: "Expense approval: team workshop",
    with: 3,
    messages: [
      { from: "them", hoursAgo: 96, body: "Can you approve ₪2,400 for next month's team workshop?" },
      { from: "owner", hoursAgo: 90, body: "Approved. Thanks for organising it." },
    ],
    asks: true,
  },
  {
    key: "review-moved",
    channel: "email",
    subject: "Quarterly review moved to Thursday",
    with: { name: "CEO's office", role: "Head office" },
    messages: [
      {
        from: "them",
        hoursAgo: 44,
        body: "The quarterly review moves to Thursday at 09:00, same room.",
        toOwner: false,
      },
    ],
  },
  {
    key: "join-call",
    channel: "slack",
    subject: "Can you join the 15:00 call?",
    with: 4,
    messages: [
      {
        from: "them",
        hoursAgo: 2,
        body: "We're discussing the holiday weekend at 15:00. Can you join for ten minutes?",
      },
    ],
    asks: true,
  },
  {
    key: "press",
    channel: "email",
    subject: "Press clippings: food prices",
    with: { name: "Communications team", role: "Head office" },
    messages: [
      {
        from: "them",
        hoursAgo: 20,
        body: "Today's coverage: food prices fell for the second month; analysts expect discount chains to keep growing.",
        toOwner: false,
      },
    ],
  },
  {
    key: "interview",
    channel: "email",
    subject: "Interview feedback for the analyst role",
    with: 5,
    messages: [
      { from: "them", hoursAgo: 100, body: "Could you send your feedback on yesterday's candidate?" },
      { from: "owner", hoursAgo: 98, body: "Strong analytical skills; I'd move her to the final round." },
    ],
    asks: true,
  },
  {
    key: "it-policy",
    channel: "email",
    subject: "Reminder: password policy",
    with: { name: "IT service desk", role: "IT" },
    messages: [
      { from: "them", hoursAgo: 120, body: "Please update your password before the end of the month.", toOwner: false },
    ],
  },
  {
    key: "thanks",
    channel: "slack",
    subject: "Thanks for the support last week",
    with: 6,
    messages: [
      { from: "them", hoursAgo: 36, body: "Thanks for the support last week, it made a real difference to the team." },
    ],
  },
];
