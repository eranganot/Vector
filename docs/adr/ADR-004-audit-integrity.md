# ADR-004: Transactional, insert-only, hash-chained audit trail

- Status: Accepted (Phase 1 gate, 2026-10-04)

## Context

Charter §23–24: important state changes must be explainable after the fact, and audit records protected from
unauthorized modification. Investors and future customers will ask "how do I know this log is true?"

## Decision

1. Every command writes its entity change and an `audit_event` row in **one database transaction**. A state
   change without an audit row cannot commit.
2. `audit_event` is insert-only. The app's login role `vector_app` gets its privileges from the group role
   `vector_app_rw` (migration 0002), which has `INSERT, SELECT` only on `audit_event`. A trigger raises on
   `UPDATE`, `DELETE` and `TRUNCATE` for all roles. Migrations run as the owner and never touch existing rows.
3. Rows form a per-org **hash chain**: `hash = sha256(prev_hash || canonical_json(fields))` over 18 fields (every
   column except `id`, `recorded_at` and the hashes; `hashedFields` in `src/application/audit.ts`), serialized with a
   transaction-scoped advisory lock. `pnpm run doctor` verifies the chain of every organization epoch.
4. Corrections are new events that reference the original, never edits.

## Alternatives considered

- Event sourcing (state derived from events): a stronger guarantee but a large complexity jump. The
  transactional audit gives the reconstruction property the charter asks for without it.
- An external append-only store / ledger database: premature for a prototype; hashes can be anchored externally later.

## Consequences

- Small write-path cost (advisory lock + hash) is irrelevant at prototype volumes.
- The restricted DB role needs a second connection string (`DATABASE_URL` for migrations as owner,
  `APP_DATABASE_URL` for the app as `vector_app`). Introduced in Phase 2 with the audit table; `pnpm db:roles`
  creates the role, and the app falls back to `DATABASE_URL` when `APP_DATABASE_URL` is unset (local development).
- A demo reset starts a new organization epoch instead of deleting rows, so every epoch keeps its own chain.
