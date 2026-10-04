# Permission, authorization, approval, execution and audit

Status: **Draft for Phase 1 approval**. Implements charter §19–24. The matrix in §2 and the rules in §4 become
table-driven tests in Phase 2.

These are four separate checks, in this order, each with its own code path and audit trail:

| Check             | Question                                                   | Where                                                             | Failure                                |
| ----------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| **Permission**    | May this role ever do this kind of thing?                  | `domain/policy/permissions.ts`: static role → capability matrix   | `PermissionDenied`                     |
| **Authorization** | May this actor do this specific thing to this entity, now? | `domain/policy/authorize.ts`: capability + scope + context rules  | `NotAuthorized` (with reason code)     |
| **Approval**      | Has a human explicitly said yes to this exact action?      | `Approval` records, required by `domain/policy/approval-rules.ts` | action cannot leave `pending_approval` |
| **Execution**     | Did it happen?                                             | executor, gated by A7's run-time re-authorization                 | action `failed` or blocked             |

Every denied permission or authorization check on a **command** is audited (`*.denied`, with the reason code). Denied
reads are logged, not audited.

## 1. Actors and scope

An **actor** is either a signed-in user or a system actor:

- **User:** each `RoleAssignment(role, org_unit)` grants that role over the unit's **subtree**. A user may
  hold several assignments; capabilities are the union, and scope is checked per assignment (a role at Haifa
  does not lend its capabilities to Nazareth).
- **System actors:** named, non-human principals with fixed, minimal capabilities. They never approve.

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
Supply Chain manager see branch insights that list Supply Chain as affected. Queries enforce this in SQL
(`WHERE` on a precomputed `visible_unit_ids` array), never by filtering in the UI.

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

Assignments in the seed: Executive at the group root; Department Manager at a department; Regional Manager
at a region; Branch Manager (same role) at a branch; Viewer at the group root (read-only board observer).

## 3. Authorization rules (context)

| Code | Rule                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AZ-1 | The target entity's primary unit (or, for actions, **every** target unit) must be inside the actor's scope for that capability                                                                                            |
| AZ-2 | Separation of duties: approver ≠ action proposer, approver ≠ action owner                                                                                                                                                 |
| AZ-3 | Writes require a fresh session (≤ 12 h). Reads accept any valid session                                                                                                                                                   |
| AZ-4 | System actors cannot hold user roles; users cannot act as system actors                                                                                                                                                   |
| AZ-5 | The persona switcher signs in as a seeded user. Every audit row records `via_demo_switcher = true` and the demo session id. The switcher exists only when `DEMO_PERSONAS=on` and only lists users with `is_seeded = true` |
| AZ-6 | Run-time re-authorization (A7): authorization and approval are re-checked when execution starts, not only when approved                                                                                                   |

## 4. Approval policy rules

Evaluated at submit time (A2/A3), and again at execution time (A7). Each rule either does not match, or
yields a set of **eligible approvers** (role @ scope options). When several rules match, one approval is enough
**only if the approver is eligible under every matched rule**. An Executive (group scope) is eligible under all rules,
so an approver always exists. Multi-step chains, where different people approve different rules, are deferred:
none of the demo scenarios needs them.

| Rule                        | Matches when                                                                   | Requires approval by                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| AP-1 External communication | executor is `outbox_message` with `audience = external` (customers, suppliers) | Regional Manager of the target region, or Executive                                                       |
| AP-2 Cross-region           | target units span more than one region                                         | Executive                                                                                                 |
| AP-3 Cost                   | estimated_cost ≥ ₪10,000                                                       | Department Manager owning the budget, or Regional Manager of the target region; **≥ ₪50,000 → Executive** |
| AP-4 Inventory transfer     | type `inventory_transfer`                                                      | Regional Manager of the **receiving** region, or the Supply Chain Department Manager                      |
| AP-5 High priority          | the insight is P1                                                              | Regional Manager of the primary unit's region, or Executive if group-level                                |
| AP-6 Staffing change        | type `staffing_change`                                                         | Regional Manager of the target region                                                                     |
| AP-7 Legal & regulatory     | type `regulatory_notification`, `contract_clause_invocation` or `recall`       | Legal & Compliance Department Manager, or Executive                                                       |

Not matched by any rule means no approval is needed. That applies to, for example, an internal task to a branch
manager within the proposer's own scope. The evaluation result, including the list of rules evaluated and not
matched, is stored on the action and in the audit row, so "why didn't this need approval?" has an answer.

Thresholds and rules are **versioned configuration** (`approval_policy_version`). Changing them is an
`admin.policy` operation that is audited. In the MVP, rule changes ship as code, through a PR.

## 5. Approval is never inferred

Each of these leaves an action in `pending_approval`, and each is a Phase 2 test:

1. No answer for any length of time. Expiry (72 h) returns the action to `proposed`; it never approves.
2. The approver opened or viewed the approval page.
3. The approver approved a different action, even an identical one, or an earlier version of this action.
4. The proposer holds a role that could approve (AZ-2 forbids self-approval).
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
  operation        text        -- e.g. 'action.submitted', 'approval.granted', 'action.denied'
  entity_type      text
  entity_id        uuid
  from_state       text null
  to_state         text null
  reason           text null   -- rationale or denial reason code
  changes          jsonb       -- field-level before/after for changed fields
  policy           jsonb       -- rules evaluated + matched, policy versions
  evidence_ids     uuid[]
  ai_generation_id uuid null   -- P5: model, version, prompt version live on that record
  request_id       text        -- correlates with logs
  prev_hash        bytea
  hash             bytea       -- sha256(prev_hash || canonical_json(all fields above))
```

**Integrity (ADR-004):**

- The app connects as role `vector_app` with `INSERT, SELECT` on `audit_event` and **no** `UPDATE, DELETE, TRUNCATE`.
- A trigger rejects `UPDATE`/`DELETE`/`TRUNCATE` for every role, including the owner.
- Appends take a transaction-scoped advisory lock per org, so `seq` and the hash chain are serial.
- `pnpm run doctor` verifies the chain end to end.
- Corrections are new events that reference the corrected one. History is never rewritten.

The audit trail must be enough on its own to reconstruct an insight's story: who saw what evidence, who
decided, which rules required whose approval, who approved, what executed, and what the outcome was.
The Phase 2 acceptance test rebuilds the trace page from `audit_event` rows alone and compares it with the live page.
