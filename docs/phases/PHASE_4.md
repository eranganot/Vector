# Phase 4 — Operational Intelligence

Status: **In progress** (started 2026-10-04 on Eran's go-ahead with the Phase 3 sign-off, G-P3: "you can continue to
phase 4 (in dev)"). Charter §31 Phase 4, Objective 4 (Organizational Coordination), Objective 5 (Closed-Loop
Intelligence), §36 scenarios "Meeting Commitment", "Conflicting Decision", "Cross-Department Dependency".

## Objective

Take VECTOR from awareness to coordination. Today VECTOR knows that something is wrong and who owns the response.
Phase 4 adds:

- what people **promised each other**;
- **who is waiting on whom**;
- when two units' plans **collide**;
- whether the work that followed actually **worked**.

The charter's chain (event → understanding → decision → action → outcome) closes, with lessons kept for next time.

## Starting point (built in Phases 2–3)

The lifecycle (Signal → Insight → Decision → Action → Approval → Outcome) runs with audited commands, approval
policy v2 and an outcome evaluator.

The scenario catalog already tells commitment, dependency and conflict stories (R2, R4, R5, R7, R9, R12), but only as
seeded insights. There is no commitment or dependency the system can track, so nothing is detected live. The home
"Dependencies" card is built from actions, not from real dependencies.

## Deliverables

1. **Commitments** (new entity, in the approved domain model: "Later phases add Commitment and Dependency (P4)").
   - A commitment is a promise by a unit, owned by a person, to deliver something by a date. Its fields:
     - what was promised;
     - the owner and the owning unit;
     - who it is owed to;
     - the source (for example "Weekly ops meeting · 15 Oct");
     - the due date and the impact if late (₪/week);
     - compliance exposure;
     - optionally the resources it affects in a time window, such as "promote SKU set X at Coast, 1–3 Nov".
   - States:
     - `open` → `done`;
     - `open` → `overdue` (the system, when the due date passes) → `done` (late);
     - `open` or `overdue` → `open` again with a new date (renegotiated, with a rationale);
     - `open` or `overdue` → `cancelled` (with a rationale).
   - Every change goes through a named, audited command.
2. **Dependencies** (new entity). A dependency means a unit needs a commitment by a date, optionally because one of
   its own commitments depends on it.
   - Its status is derived from the commitment and the clock, never stored:
     - `waiting`;
     - `met`;
     - `at risk` (the commitment is overdue, but the need-by date has not passed);
     - `blocked` (the need-by date passed undelivered).
   - **Cascades** follow the chain: a late upstream commitment puts downstream commitments and their own dependents at
     risk.
   - A **bottleneck** is the unit that others are blocked or at risk on, weighted by ₪ impact.
3. **Live detection**, deterministic and versioned, like the KPI detector:
   - **Commitment monitor** (on every clock advance): it marks overdue commitments `overdue`. It also raises a
     `commitment_overdue` insight, scored by priority-v2 from the commitment's impact, its dependents and its
     compliance, and routed to the owner, with a chase-and-mitigate recommendation.
   - **Conflict detector** (whenever a commitment is recorded) applies conflict rules v1. Two open commitments conflict
     when they come from different owner units, share a resource and overlap in time, and their effects oppose each
     other. The opposing pairs are:
     - promote × delist;
     - spend × freeze spend;
     - cut-over × peak trading.

     A conflict raises a `decision_conflict` insight showing both commitments side by side. It also records a Conflict,
     which is resolved when either commitment is cancelled, renegotiated out of the overlap, or the insight resolves.
4. **Commitments tab**, with three lists:
   - what you owe;
   - what is owed to you;
   - overdue in your scope.

   You can record a commitment from a meeting, then complete, renegotiate or cancel it. Each commitment shows its
   dependents.

5. **Dependencies and bottlenecks on every home.** The home's Dependencies card shows real dependencies:
   - "We're waiting on" and "Waiting on us", each with at-risk and blocked counts;
   - for the CEO and regions, the top bottlenecks and the share of commitments delivered on time.
6. **Approval workflow UX.** Each request shows:
   - the rule and why you are asked;
   - who else could approve;
   - the cost, targets and due date;
   - how long until the request expires.

   It also shows the history of your answers. The remaining lifecycle commands move into the UI:
   - acknowledge or dismiss an insight (with a reason);
   - cancel an action (with a reason), amend it (a new revision and a new approval) or retry it.

7. **Action and outcome tracking** (`/actions`, "Actions & outcomes"):
   - every action in scope, with status, owner, department, due and overdue, filterable;
   - outcomes being observed, with their window;
   - a review queue, where an evaluated outcome needs a human lesson;
   - a lessons library.

   Lessons from past outcomes of the same playbook appear on new insights ("Last time we did this").

8. **Scoped audit explorer** (`/audit`): events in your scope, filtered by entity, actor and operation, with chain
   status. Charter Objective 6 asks that what exactly happened be visible.

## Product acceptance

- Recording "Weekend dairy discount, South, 31 Oct–2 Nov" as Marketing raises a conflict with Trade & Commercial's
  delisting of the same items at once. The insight names both commitments, the overlap and the cost, and routes the
  decision.
- Advancing the demo clock past a commitment's due date marks it overdue and raises a scored insight. Its dependents
  appear "at risk" on their dashboards, and the cascade is visible.
- Every home shows real dependencies, with at-risk and blocked counts. The CEO sees the top bottleneck and the share of
  commitments delivered on time.
- An approver sees why they are asked and by when. The action owner can amend after a denial and resubmit. All of it is
  audited.
- Every action and outcome in scope can be found on one page. An evaluated outcome cannot be closed without a lesson,
  and that lesson appears on the next insight of the same kind.

## Technical acceptance

- Commitment and Conflict state changes go only through named commands, which authorize and audit in the same
  transaction. Refusals are audited.
- The state machines are data (`machines.ts`) and are tested row by row.
- Dependency status, cascade and bottleneck are pure domain functions with unit tests.
- The conflict rules and the commitment monitor are pure, deterministic and versioned (`conflict-rules-v1`,
  `commitment-monitor-v1`). Re-running them is idempotent (dedupe keys).
- Migration 0006 is additive (new tables only). The seed version bumps (`p4-v1`) and Dev reseeds on boot.
- Scope: a commitment, conflict or dependency is visible only to the units it touches. Recording a commitment requires
  `commitment.record` over the owning unit.
- All earlier smoke and e2e checks pass, plus new Phase 4 checks. CI is green on the PR **and** on `main`.

## Test strategy

- **Unit:**
  - the commitment state machine;
  - dependency status, cascade and bottleneck;
  - the conflict rules (each opposing pair; no conflict without overlap, on the same owner, or on different resources);
  - the monitor's scoring inputs.
- **Integration:**
  - record, complete, renegotiate and cancel, with audit and refusals;
  - overdue raised once (idempotent);
  - a conflict detected once, and resolved when one side moves;
  - scope;
  - amend → new approval;
  - lessons shown on a matching insight.
- **E2E:**
  - the live conflict (Ronit records the promo);
  - the clock pushes a commitment overdue, and the dependents turn at risk;
  - an approval with why-me and history;
  - review an outcome with a lesson, which then appears on the trace;
  - the audit explorer filters.
- **Smoke:** new routes require sign-in; health reports the seed version.

## Demo scenario

1. Dana's home: "3 commitments overdue", with Marketing as the top bottleneck (the promo signage; 60 branches waiting).
2. Ronit (Marketing) records the weekend dairy discount for South. VECTOR flags the conflict with Trade's delisting
   instantly, and Eitan (Trade) sees it in Waiting on you.
3. Admin advances the clock by a day. Trade's supplier-response commitment goes overdue. Finance's margin forecast,
   which depended on it, turns "at risk" on Michal's home.
4. Shira approves an action. She sees the rule, why she is asked, and when the request expires. A denial leads to an
   amendment and a new approval.
5. After the outcome window, Avi reviews the Haifa outcome with a lesson. The next stock-transfer insight shows "Last
   time we did this: …".

## Risks

- **Scope creep into a project-management tool.** Mitigation: commitments are small promises between units with a date
  and an impact. There are no sub-tasks, comments or Gantt charts.
- **Noise from trivial overdue items.** Mitigation: an insight is raised only when the commitment has dependents, or
  ₪10k+/week at stake, or compliance exposure. Everything else is listed, not escalated.
- **Conflict false positives.** Mitigation: explicit resource keys and opposing-effect pairs only (no fuzzy matching in
  Phase 4; AI interpretation is Phase 5).
- **Nav growth.** Mitigation: Commitments and "Actions & outcomes" are the only new tabs; the audit explorer replaces
  the existing Audit page.

## Choices made by Claude, to confirm at the Phase 4 gate

- **Q1 · Who decides a conflict:** the manager of the unit whose commitment came second (it introduced the
  conflict). The other owner is affected and informed, and approval policy v2 routes any resulting actions.
- **Q2 · When overdue becomes an insight:** only with dependents, ₪10k+/week at stake, or compliance exposure ≥ 0.6.
  Otherwise it is listed only.
- **Q3 · Renegotiating a date:** the owner may move a due date with a rationale. Dependents are notified (an internal
  notice), and no approval is required. Repeated renegotiation is visible in the commitment's history.
- **Q4 · Dependency status is derived, not stored**, so it can never drift from the commitment and the clock.

## Approval gates

- No mid-phase §30 gate is expected:
  - the entities are in the approved domain model (G1);
  - the tables are additive;
  - authorization gains capabilities in the existing model and is not redesigned;
  - there is no new platform, cost or data deletion.

  If that changes, Claude stops and asks.

- **Phase sign-off:** after the demo on Dev; then promotion to Prod.
