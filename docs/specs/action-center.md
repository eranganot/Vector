# Action Center (E4)

Status: **Built in E4 (2026-10-07); see §6 "As built" for where it differs from this proposal.** Proposed in E0 (2026-10-06). Implements FB item #9, FB-8 (internal sending in the demo; real channels in
production) and FB-12 (Waiting on you stays its own tab, and the same items also appear here).

## 1. Purpose

The Action Center turns an insight, risk or opportunity into an action item with the right person. For each item it
gives:

- **a suggestion of how to proceed**;
- **with whom**;
- **the relevant message**, which the user can edit;
- **Approve / Decline**. Approving sends the message to the right person.

It is built on the existing lifecycle (Decision → Action → Approval → execution), so every step is authorized,
approved where policy says so, and audited. It does not open a second path around governance.

## 2. Layout

**Layout v3 (G-E0d, "more action-driven").** It supersedes the list below.

- **Action queue:** cards sorted by ₪ × urgency. Each card has a colour stripe (risk, opportunity, conflict), one line,
  ₪, owner and due date, and **one primary button** (Approve & send, Decide, Resolve, Assign).
- **Selected action**, shown in this order:
  1. title and status chip;
  2. a facts strip (owner, department, due, impact);
  3. **who is involved**: a chain of departments, each with its part and a status chip;
  4. steps with their status;
  5. **"When you approve, VECTOR will…"**: a preview of the automatic messages, reminders and escalation;
  6. the editable message;
  7. **Approve and send**, Edit action, Decline;
  8. a history timeline.
- **From event to action plan:** a flow from an event (for example a management meeting summary) through read →
  analyse → assign → track, to the tasks it created per department, each with its status.

1. ₪ header: ₪ at stake waiting for an action · ₪ in actions awaiting approval · ₪ sent this week.
2. **Needs an action**: insights, risks and opportunities in your scope with no decided action yet, ranked by the
   "Where to focus" score (executive-home.md §7).
3. **Waiting on you**: the same rows as the Waiting on you tab (decisions, approvals, your tasks), from the same
   query (FB-12).
4. **Sent and in flight**: messages you approved and the actions they started, with status and outcome.

## 3. "Make it an action" (one panel)

| Part               | Content (deterministic, `action-suggest-v1`)                                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suggested approach | The playbook for the insight's type (`src/application/playbooks.ts`): steps, expected impact, cost, risk (economics-v1), and "Last time we did this" (the lesson)                                                |
| With whom          | Owner: the head (`is_head`) of the owning unit. Informed: the heads of the affected units and the sponsor of a linked initiative. Each person comes with the reason they were picked; any of them can be changed |
| Approval route     | The approval policy evaluated live (AP rules): who must approve, and whether you may approve it yourself                                                                                                         |
| Message            | A template per playbook and audience (owner / informed), in the recipient's language (EN or HE), filled with the insight's facts, ₪, due date and a link. Editable                                               |
| Approve / Decline  | Approve runs the commands: decide → propose action (with the economics fields) → request approval if policy requires → on approval, send. Decline records a reason                                               |

Sending is a step of execution. When the policy requires a second approver, the message waits in `approved_pending`
and is sent only after that approval. A user may never approve their own action (AZ-2).

## 4. Messages and channels

| Entity            | Fields                                                                                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OutboundMessage` | action_id, channel (`in_app`, `email`, `slack`, `sms`, `whatsapp`), to_user_ids[], to_address (production only), subject, body, language, template_id, edited (bool), status (`draft` → `approved` → `sent` / `failed` / `cancelled`), approved_by, sent_at, adapter, simulated |

**Channel seam.** A `ChannelAdapter` interface (`send(message) → receipt`) sits in `src/infra/channels`.

- **Demo (FB-8): internal only.** `InAppAdapter` creates a notification in the recipient's VECTOR inbox (Waiting on
  you and Inbox). The message is also written to the existing visible outbox, labelled "internal: demo". No email,
  Slack or SMS leaves the system.
- **Production** (after the MVP): email, Slack and messaging adapters behind configuration, an allowlist of recipient
  domains and workspaces, and a kill switch per environment (`CHANNELS_LIVE=off` by default). They are delivered with
  their own security review (Phase 8).

Every state change of a message is audited (`message.drafted`, `message.edited` with a diff hash, `message.approved`,
`message.sent`, `message.declined`).

## 5. Acceptance (E4)

- e2e (both languages): Dana makes the North stock-out risk into an action. Noa is suggested as owner, Dana edits
  the message and approves it, Noa sees it in Waiting on you and in her Inbox, and the audit trail shows every step.
- A case where policy requires another approver (AP-3 ≥ ₪50k): the message is not sent until that approver approves.
- No network call to any external channel in Dev or Prod (unit test on the adapter registry, plus smoke).

## 6. As built (E4, 2026-10-07)

- **Route** `/action-center` (`?item=<insight id>` selects an item). Navigation: C-suite after Home and Waiting on you;
  managers next to Waiting on you. Home "Today's priorities" (Decide / Approve / Act) and the Action plan buttons on
  Opportunities and Risks open the item here.
- **Queue** (`src/application/queries/action-center.ts`): open recommendations and actions whose approval is routed to
  you, plus conflicts you are the common manager of; score = ₪ a week × urgency (×1.5 within 72 h, ×1.2 within a week)
  × level (×1.5 when you are accountable or the approval is yours). One button: Approve and send, Approve, Resolve or
  Open.
- **Selected item:** facts, VECTOR's recommendation, who is involved (one node per department with its part and
  status), steps with cost, impact, due and the live approval route, "When you approve, VECTOR will…", with whom
  (To, editable, and Cc, each with the reason), the suggested message (`action-suggest-v1`, editable, in the reader's
  language), Approve and send, Decline with a reason, the item's messages and its history.
- **With whom:** To is the owner of the first step (the proposal said the head of the owning unit; the step owner is
  the one who acts), falling back to that head. Cc: other step owners, heads of affected departments, the sponsor of
  a linked initiative.
- **Approve and send** (`src/application/commands/messages.ts`): decides an open recommendation (existing
  `decision.decide`), grants on the same click any approval routed to the sender (existing approval command; AZ-2 still
  applies), stores the message as `approved` (the proposal's `approved_pending`), and sends it once no action of the
  decision waits for approval: after the decision, after each grant, and on the demo clock. If every action is
  cancelled or rejected, the message is cancelled. Audit: `message.drafted`, `message.edited` (hash), `message.approved`,
  `message.sent`, `message.cancelled`. Decline is the existing `decision.declined` with its reason.
- **Channels:** only the in-app adapter is registered; any other channel is refused unless `CHANNELS_LIVE=on`
  (unit-tested). Delivered messages appear under "Messages for you" in Waiting on you. There is no separate Inbox yet
  (the mail agent is E7).
- **From event to action plan:** the latest meeting or plan in scope that created two or more commitments, with its
  tasks, owners, dates, status and the conflicts it caused.
- **Not built in E4:** "Edit action" from the panel (amending stays on the insight's trace).
- **Acceptance as run:** the integration test covers the North stock-out (Noa suggested; Dana's own AP-3 staffing
  approval granted on the same click; the message held until the AP-4/AP-5 transfer approval, then delivered in-app;
  the audit sequence) and Hebrew. The e2e (EN and HE) runs the same story on the competitor-closing opportunity
  (Ronit suggested, Dana edits and approves, held until Maya's AP-3 approval, then Ronit sees it), because the
  Phase 4 e2e amends and approves the stock-out's staffing action in the same run.
