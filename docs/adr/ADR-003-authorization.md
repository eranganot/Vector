# ADR-003: Authorization as domain policy, separate from authentication

- Status: Accepted (Phase 1 gate, 2026-10-04)

## Context

The charter requires permission, authorization, approval and execution to stay distinct (§20), backend
enforcement (§21), and no inferred approval (§22). Off-the-shelf RBAC libraries model "role can do X" but not
org-tree scope, separation of duties, or approval as a recorded human act.

## Decision

- **Authentication** (who you are) uses Better Auth: email + password, DB sessions. The demo persona switcher signs in
  as a seeded user, which keeps one code path.
- **Permission and authorization** are pure functions in `src/domain/policy`: a static role → capability
  matrix, plus `authorize(actor, capability, target, context)` applying scope (org subtree) and context rules
  AZ-1..AZ-6.
- **Approval requirements** are pure, versioned rules (AP-1..AP-7) evaluated at submit time, and again when an
  amended action is re-submitted. An approval is an entity with its own state machine, bound to one action revision.
  At execution the approval is re-checked (still granted, same revision, not lapsed), but the rules are not
  re-evaluated yet: the A7b path has no code in Phase 2 and is scheduled for Phase 3.
- Every command calls `authorize` before the domain transition. Insight list and trace queries are scoped in SQL.
- AZ-3 (fresh session for writes) is enforced in Phase 2 by the 12 h session lifetime; the domain rule exists but
  commands do not pass the session age yet.

## Alternatives considered

Casbin / generic RBAC: no natural model for subtree scope or approvals; the policy would be split across a DSL and
code. Row-level security in Postgres: strong, but harder to explain and test at this stage; it can be layered under the
same rules later (Phase 8 option).

## Consequences

Policy is plain TypeScript with table-driven tests, readable by a PM. The rules shown in the UI ("why does
this need Yossi's approval?") are the same objects the backend evaluates.
