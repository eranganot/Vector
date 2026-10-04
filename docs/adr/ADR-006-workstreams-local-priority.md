# ADR-006: Separate risk and opportunity workstreams; scope-relative local priority

- Status: Accepted (Eran, 2026-10-04, scenario review)

## Context

In the first calibration a heatwave _opportunity_ was ranked on the same scale as stock-out _risks_. Eran's review: opportunities
must be managed in a different workstream, and an issue that is minor for management (a single-branch shrinkage spike) must
rank higher for the store manager whose whole scope it is.

## Decision

1. **Two workstreams.** Every insight carries `workstream: risk | opportunity`. Risks are scored with `priority-v2` (bands P1–P4).
   Opportunities are scored with `opportunity-v1` (value, window, reach, strategic fit, ease; bands O1–O3). They share the
   lifecycle, approval rules and audit, but are never ranked against each other, and every view gives each its own lane.
2. **Local priority.** For region and branch viewers, the same risk model is evaluated with impact and breadth measured
   against the viewer's own scope (`priority-v2-local`). The organizational priority remains the reference for the Command
   Center and departments, and both are shown where they differ.
3. **Compliance factor.** `priority-v2` adds compliance exposure (weight 0.10, capped so that the wage-rule scenario stays P2).

## Alternatives considered

- One scale with an "opportunity" flag: mixes incomparable things, which is the problem Eran raised.
- Per-role weight sets: harder to explain and calibrate. A relative scope keeps one formula and one explanation.

## Consequences

- Each insight stores the organizational breakdown; local priority is computed deterministically at read time from the stored
  inputs and the viewer's scope (no extra state, always consistent with the formula version).
- Calibration covers all three models (`scripts/calibrate-priority.ts`), and golden fixtures pin them.
