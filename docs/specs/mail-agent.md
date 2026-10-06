# Mail agent: Inbox (E7)

Status: **Proposed (E0, 2026-10-06).** Implements FB item #11 and FB-10. The demo uses a synthetic inbox and
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
