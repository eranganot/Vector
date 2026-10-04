# ADR-003: Authorization as domain policy, separate from authentication

- Status: Proposed (Phase 1 gate)

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
- **Approval requirements** are pure, versioned rules (AP-1..AP-6) evaluated at submit time and again at execution.
  An approval is an entity with its own state machine, bound to one action version.
- Every command calls `authorize` before the domain transition. Read queries are scoped in SQL.

## Alternatives considered

Casbin / generic RBAC: no natural model for subtree scope or approvals; the policy would be split across a DSL and
code. Row-level security in Postgres: strong, but harder to explain and test at this stage; it can be layered under the
same rules later (Phase 8 option).

## Consequences

Policy is plain TypeScript with table-driven tests, readable by a PM. The rules shown in the UI ("why does
this need Yossi's approval?") are the same objects the backend evaluates.
