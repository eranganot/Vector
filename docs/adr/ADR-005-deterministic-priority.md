# ADR-005: Priority is a deterministic, versioned weighted score

- Status: Accepted (Phase 1 gate, 2026-10-04); amended 2026-10-04 to priority-v2 (compliance factor) and extended by ADR-006

## Context

Charter §14: priority must be transparent, consistent, reproducible and must not depend primarily on unconstrained LLM
judgment. Executives must be able to see why something is P1.

## Decision

A weighted score with a confidence multiplier (docs/specs/priority.md), versioned weights, and bands calibrated against a
written scenario set. v2 has six factors: strategic weight, impact, magnitude, urgency, breadth and compliance. AI can contribute recorded factor inputs and can propose weight changes;
it never sets a priority directly.

## Alternatives considered

- LLM-ranked priority: not reproducible, hard to audit, and violates §14.
- A learned ranking model: there is no outcome history to train on yet. Revisit once Phase 4–5 data exists.
- Fixed rules per signal type: simple, but cannot compare across types (a stock-out vs. a labor overrun).

## Consequences

The formula is easy to explain and test. Its quality depends on calibration, which must be re-run as scenarios grow
(Phase 3) and whenever weights change.
