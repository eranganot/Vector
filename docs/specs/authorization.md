# Permission, authorization, approval, execution and audit

Status: **Approved (Phase 1, 2026-10-04); updated for Phase 2 as built.** Implements charter §19–24. The matrix in
§2 and the rules in §4 are table-driven unit tests (`src/domain/policy/policy.test.ts`); §5 is covered by
integration tests (`tests/integration/lifecycle.test.ts`).

These are four separate checks, in this order, each with its own code path and audit trail:

| Check             | Question                                                   | Where                                                             | Failure                                |
| ----------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| **Permission**    | May this role ever do this kind of thing?                  | `domain/policy/permissions.ts`: static role → capability matrix   | `PermissionDenied`                     |
| **Authorization** | May this actor do this specific thing to this entity, now? | `domain/policy/authorize.ts`: capability + scope + context rules  | `NotAuthorized` (with reason code)     |
| **Approval**      | Has a human explicitly said yes to this exact action?      | `Approval` records, required by `domain/policy/approval-rules.ts` | action cannot leave `pending_approval` |
| **Execution**     | Did it happen?                                             | executor, gated by A7's run-time approval check                   | action `failed` or blocked             |

Every denied permission or authorization check on a **command**, and every illegal transition, is audited
(`<operation>.denied`, with the reason code). Denied reads are not audited: an out-of-scope id simply looks missing.

## 1. Actors and scope

An **actor** is either a signed-in user or a system actor:

- **User:** each `RoleAssignment(role, org_unit)` grants that role over the unit's **subtree**. A user may
  hold several assignments; capabilities are the union, and scope is checked per assignment (a role at Haifa
  does not lend its capabilities to Nazareth).
- **System actors:** named, non-human principals with fixed, minimal capabilities (`SYSTEM_ACTOR_OPERATIONS` in
  `authorize.ts`). They never approve.

| System actor               | Can do                                                                       | Cannot do                             |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| `system:detector`          | create signals and insights; recommend decisions; propose actions            | decide, approve, execute              |
| `system:policy`            | submit actions of `decided` decisions; auto-decide under AD rules            | approve, change rules                 |
| `system:executor`          | execute `ready` actions; complete or fail executions; start outcome watches  | approve, change targets               |
| `system:outcome-evaluator` | evaluate outcomes; resolve insights whose loop has closed                    | review or override verdicts           |
| `system:clock`             | expire approval requests; lapse approvals                                    | anything else                         |
| `system:ai` (P5)           | same as `system:detector`, lower trust: its outputs are always `recommended` | decide, approve, execute, auto-decide |

**Read visibility.** A user can read an insight (and its signals, evidence, decision, actions, approvals,
outcomes, audit) if the primary unit **or any affected unit** is inside one of their scopes. This lets a
Supply Chain manager see branch insights that list Supply Chain as affected. Each insight and action stores
`visible_unit_ids` (its units and all their ancestors); the insight list and trace queries filter on it in SQL
(`visible_unit_ids && <user's scope roots>`), never in the UI. The approvals inbox and the performance dashboards
load the org's rows and filter them in the application layer (by approver eligibility, and by the viewer's position
unit), not in SQL; Phase 3 moves them to SQL filters.

## 2. Roles and permission matrix

| Capability                              | Admin | Executive | Department Manager | Regional / Branch Manager | Viewer |
| --------------------------------------- | :---: | :-------: | :----------------: | :-----------------------: | :----: |
| `insight.read` (in scope)               |   ✓   |     ✓     |         ✓          |             ✓             |   ✓    |
| `insight.acknowledge`                   |       |     ✓     |         ✓          |             ✓             |        |
| `insight.dismiss`                       |       |     ✓     |         ✓          |             ✓             |        |
| `insight.resolve`                       |       |     ✓     |         ✓          |             ✓             |        |
| `decision.decide`                       |       |     ✓     |         ✓          |             ✓             |        |
| `action.propose`                        |       |     ✓     |         ✓          |             ✓             |        |
| `action.approve`                        |       |     ✓     |         ✓          |             ✓             |        |
| `action.execute` (manual trigger/retry) |       |     ✓     |         ✓          |             ✓             |        |
| `action.cancel`                         |       |     ✓     |         ✓          |             ✓             |        |
| `outcome.review`                        |       |     ✓     |         ✓          |             ✓             |        |
| `audit.read` (in scope)                 |   ✓   |     ✓     |         ✓          |             ✓             |        |
| `config.priority_weights.propose`       |   ✓   |     ✓     |                    |                           |        |
| `config.priority_weights.approve`       |       |     ✓     |                    |                           |        |
| `admin.users`, `admin.policy`           |   ✓   |           |                    |                           |        |
| `demo.control` (scenario engine, clock) |   ✓   |           |                    |                           |        |

Admin deliberately has **no business decision or approval rights**: configuring the system and approving its
consequential actions are separated. Having `action.approve` lets a role be considered as an approver; whether
it may approve a given action is decided by the approval rules (§4) and scope.

Assignments in the seed (20 people): Executive at the group root (Dana, CEO); a Department Manager for each of the
8 departments, plus a second manager in Legal & Compliance (Dafna Mor, Senior Legal Counsel) and in Supply Chain (Ben Shalom, Head of DC Operations) (Yael Barak, General Counsel, and Dafna are AP-7 approvers); a Regional
Manager for each of the 5 regions; two Branch Managers (Avi at Haifa Grand Canyon, Lior at Tel Aviv Dizengoff); a
Viewer at the group root (Tal, board observer); and an Admin at the group root. A Branch Manager is the
`regional_manager` role assigned at a branch unit; there is no separate role.

How the UI applies `audit.read` in Phase 2: the group-wide `/audit` page (chain status) is shown to Executive and
Admin only. Department and regional managers see the audit trail of each insight they can read on its trace page.
A scoped audit explorer arrives in Phase 4.

## 3. Authorization rules (context)

| Code | Rule                                                                                                                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AZ-1 | The target entity's primary unit (or, for actions and outcomes, **every** target unit) must be inside the actor's scope for that capability                                                                                                                                    |
| AZ-2 | Separation of duties: approver ≠ action proposer, approver ≠ action owner                                                                                                                                                                                                      |
| AZ-3 | Writes require a fresh session (≤ 12 h). Phase 2 enforces this through the session lifetime: Better Auth sessions expire 12 h after sign-in and are not extended. The domain check (`sessionAgeHours`) exists and is unit-tested, but commands do not pass the session age yet |
| AZ-4 | System actors cannot hold user roles; users cannot act as system actors                                                                                                                                                                                                        |
| AZ-5 | The persona switcher signs in as a seeded user through the normal sign-in path. Every audit row records `via_demo_switcher = true` and the session id. The switcher works only when `DEMO_PERSONAS=on` (checked at run time) and lists the people of the active organization   |
| AZ-6 | Run-time check (A7): when execution starts, the approval must still be granted, for the current action revision, and not lapsed. The approval policy itself is not re-evaluated yet (known gap, Phase 3; see domain-model.md §4.3)                                             |

## 4. Approval policy rules

Evaluated at submit time (A2/A3), and evaluated again whenever an amended action is re-submitted (A12). Each rule
either does not match, or yields a set of **eligible approvers** (role @ scope options). When several rules match,
one approval is enough **only if the approver is eligible under every matched rule**. An Executive (group scope) is
eligible under all rules, so an approver always exists. Multi-step chains, where different people approve different
rules, are deferred: none of the demo scenarios needs them.

| Rule                        | Matches when                                                                                                              | Requires approval by                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| AP-1 External communication | executor is `outbox_message` with `audience = external` (customers, suppliers)                                            | Regional Manager of the target region, the owning department's manager, or Executive                                                       |
| AP-2 Cross-region           | target units span more than one region                                                                                    | Executive                                                                                                                                  |
| AP-3 Cost                   | estimated_cost ≥ ₪10,000                                                                                                  | Department Manager owning the budget, Regional Manager of the target region, or the owning department's manager; **≥ ₪50,000 → Executive** |
| AP-4 Inventory transfer     | type `inventory_transfer`                                                                                                 | Regional Manager of the **receiving** region, or the Supply Chain Department Manager                                                       |
| AP-5 High priority          | the insight is a **risk** in band P1 (opportunity bands never match); internal notifications (`notify_owner`) never match | Regional Manager of the primary unit's region, the owning department's manager, or Executive                                               |
| AP-6 Staffing change        | type `staffing_change`                                                                                                    | Regional Manager of the target region                                                                                                      |
| AP-7 Legal & regulatory     | type `regulatory_notification`, `contract_clause_invocation` or `recall`                                                  | Legal & Compliance Department Manager, or Executive                                                                                        |

**Policy v2 (G3, Eran 2026-10-04).** "The owning department" is the insight's `owner_department_id`: the department
accountable for the response. Its managers may approve that issue's actions under AP-1, AP-3 (below ₪50,000) and AP-5, so a
recall owned by Legal & Compliance is approved inside Legal, and executed by Legal and Supply Chain. Internal notifications
never need approval, so the CEO is informed rather than asked.

**Routing.** The Executive is always added as an eligible approver of every matched rule (a fallback and an escalation
path), but the inbox only **asks** the Executive when nobody else may approve (e.g. spend ≥ ₪50,000); otherwise a request is
routed to the other eligible people, never to the action's owner or proposer (`routeApproval` in
`src/application/queries/insights.ts`).

The Executive is always added as an eligible approver of every matched rule. "Regional Manager of the target region"
applies only when all targets sit in one region; otherwise only the Executive qualifies. The department that owns
the budget for AP-3 comes from the action type's playbook (`src/application/playbooks.ts`).

Not matched by any rule means no approval is needed. That applies to, for example, an internal task to a branch
manager within the proposer's own scope. The evaluation result, including the list of rules evaluated and not
matched, is stored on the action and in the audit row, so "why didn't this need approval?" has an answer.

Thresholds and rules are **versioned configuration** (`approval-policy-v2`, stored with every evaluation; v1 before 2026-10-04). In the
MVP, rule changes ship as code, through a PR; an audited `admin.policy` operation to change them arrives later.

## 5. Approval is never inferred

Each of these leaves an action in `pending_approval`. All eight are tested in `tests/integration/lifecycle.test.ts`
(test names start with the case number):

1. No answer for any length of time. Expiry (72 h) returns the action to `proposed`; it never approves.
   Tested at 71 h (still pending) and after 72 h (expired, back to `proposed`, can no longer be granted).
2. The approver opened or viewed the approval page (trace and inbox queries are run; nothing changes).
3. The approver approved a different action, even an identical one, or an earlier version of this action.
4. The proposer or owner holds a role that could approve (AZ-2 forbids self-approval). The integration test covers
   the owner; the proposer case is unit-tested in `guards.test.ts` (in Phase 2 every action is proposed by
   `system:detector`).
5. The recommendation's confidence is high, or the insight is low priority (no "auto-approve" path exists).
6. A persona switch to an approver persona without an explicit grant command.
7. The action's params changed after approval: the approval is withdrawn and re-requested.
8. A `system:*` actor attempting `grantApproval`.

## 6. Audit event

```text
audit_event
  id               uuid
  seq              bigint      -- strictly increasing per org (gapless within a chain)
  org_id           uuid
  occurred_at      timestamptz -- domain clock (may be the demo clock)
  recorded_at      timestamptz -- database now(); always real time
  actor_type       'user' | 'system'
  actor_id         text        -- user id or 'system:executor' etc.
  session_id       text null
  via_demo_switcher boolean
  operation        text        -- e.g. 'action.submitted', 'approval.granted', 'approval.grant.denied'
  entity_type      text
  entity_id        uuid
  from_state       text null
  to_state         text null
  reason           text null   -- rationale or denial reason code
  changes          jsonb       -- field-level changes for the event
  policy           jsonb       -- rules evaluated + matched, policy version
  evidence_ids     uuid[]
  ai_generation_id uuid null   -- P5: model, version, prompt version live on that record
  request_id       text        -- correlates with logs
  prev_hash        bytea
  hash             bytea       -- sha256(prev_hash || canonical_json(hashed fields))
```

The hash covers 18 fields: every column above except `id`, `recorded_at` (set by the database) and the two hash
columns (`hashedFields` in `src/application/audit.ts`). Canonical JSON sorts object keys recursively. The first row
of each org chains from 32 zero bytes.

**Integrity (ADR-004):**

- The app connects as login role `vector_app`, a member of group role `vector_app_rw` (migration 0002,
  `scripts/db-roles.ts`). The group has `INSERT, SELECT` on `audit_event` and **no** `UPDATE, DELETE, TRUNCATE`.
- A trigger rejects `UPDATE`/`DELETE`/`TRUNCATE` for every role, including the owner.
- Appends take a transaction-scoped advisory lock per org, so `seq` and the hash chain are serial.
- `pnpm run doctor` verifies the chain of every organization epoch end to end; `/audit` shows the active epoch's
  chain status.
- Corrections are new events that reference the corrected one. History is never rewritten.

The audit trail must be enough on its own to reconstruct an insight's story: who saw what evidence, who
decided, which rules required whose approval, who approved, what executed, and what the outcome was.
The trace page shows the insight's audit rows next to the live records. The Phase 2 integration test checks that
those rows contain every step of the story (created, recommended, proposed, decided, submitted, requested, granted,
approved, executed, watch started, evaluated, resolved, reviewed) with the approver's identity, session and
switcher flag; rebuilding the whole trace page from audit rows alone and comparing it is not automated yet.
