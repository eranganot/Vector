# Mail agent: Inbox (E7)

Status: **E7 built (2026-10-10); see §4.** Proposed in E0 (2026-10-06). Implements FB item #11 and FB-10. The demo uses a synthetic inbox and
templates. The production product integrates real email and Slack and adds AI for free-form questions, after the MVP.

## 1. What it does

The Inbox scans the person's channels (email, Slack, messages) and shows:

- **Waiting for your reply**: threads where the last message is addressed to you, asks something, and has had no
  answer from you for more than 24 h, or less when it is urgent.
- **Needs a business decision**: threads that ask you to choose, approve or commit.
- For each thread: **impact** (₪, units, deadline), **benefit** of acting now, and a **recommendation**. The
  recommendation comes with a suggested reply, which you can edit, approve and send through the Action Center's
  channel seam (internal in the demo).
- **Follow-up questions**, to continue the discussion before deciding.

## 2. Demo design (template-only, FB-10 and FB-11)

- **Synthetic inbox** per C-suite persona: 15–25 threads each, in English and Hebrew. Each thread is a mix of email
  and Slack, seeded deterministically (`inbox-v1`).
- Each thread links to VECTOR entities, for example a supplier email about the North DC delay linked to that insight.
  Its impact and recommendation therefore come from VECTOR's data and stay consistent with every other screen.
- **Classification** is rule-based on thread fields: addressee, question markers, decision tags, age, and links to
  open decisions.
- **Follow-up questions**: three suggested questions per thread with prepared answers, assembled from VECTOR data,
  for example "What happens if we wait a week?" → the projection without the action. **Free-form questions are not
  available in the demo** (FB-10); the input shows the suggestions.
- Replies approved in the Inbox become `OutboundMessage`s (action-center.md §4). They are delivered internally and
  audited.

## 3. Production (after the MVP)

- **Connections**: Gmail or Microsoft 365 via OAuth with read-only mail scopes, plus a Slack app. Each user connects
  their own accounts and can disconnect them; nothing is read without that consent.
- **Classification and answers** by the AI gateway (v1 Phase 5), with evidence citations, and outputs always
  `recommended` (`system:ai`).
- **Requirements carried from now**:
  - Google's verification and security assessment for restricted mail scopes;
  - data minimisation (store derived facts and thread ids, not full bodies, unless the user opts in);
  - retention limits;
  - prompt-injection defences: mail content is data, never instructions;
  - per-user encryption of tokens.

## 4. As built (E7, 2026-10-10)

- **Data**: `inbox_thread` and `inbox_message` (migration 0016, seed `p7-v1`). A thread belongs to one person and only
  that person reads it; another person's thread looks missing, even by id.
- **inbox-v1 seed** (`src/infra/seed/inbox.ts`): 15 threads for each of the 10 C-suite personas, email and Slack:
  three that matter (linked to the VECTOR stories, commitments and initiatives they are about, each with benefit,
  recommendation, a suggested reply and three follow-up questions) and twelve routine ones (updates, meetings,
  answered questions). Hebrew for every string in `src/i18n/messages/he-inbox.ts`, checked by a unit test.
- **inbox-v1 classification** (`src/domain/inbox.ts`, pure, tested): answered (you wrote last) · needs a decision (a
  decision tag, or a linked VECTOR decision waiting for you) · waiting for your reply (a question to you unanswered for
  over 24 h, 4 h when urgent) · new questions · for your information. Order: decisions, replies, new, info, answered;
  within each, ₪ at stake, then the oldest.
- **Impact**: the thread's own figure, else the linked story's weekly ₪ (its priority input) or the commitment's;
  deadline from the thread or the commitment.
- **Follow-ups** (FB-10): prepared answers from data: what if we wait a week (₪ lost, and whether the deadline passes),
  what it costs (payback in days), who else is affected (the story's units), what we did last time (reviewed lessons of
  the same kind of action), who decides. No free-form questions.
- **Reply**: "Approve and send" turns the suggested reply, edited or not, into an `OutboundMessage` (now linked to an
  Inbox thread instead of an insight; a check constraint requires one of the two) sent through the channel seam,
  in-app only. A colleague reads it in Waiting on you; an outside party is named (`to_external`) and never contacted.
  Audited: message.drafted, message.edited (when changed), message.approved, message.sent. The reply joins the thread,
  which becomes answered.
- **Screen** `/inbox` (C-suite; nav badge = decisions + replies): summary and "What it means", threads by class, the
  open thread with messages, at stake / cost / deadline, benefit, recommendation, follow-up chips, and the reply form.
