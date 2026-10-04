# STATUS

Structured state lives in [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md). This file is the shipped log and
the place for root-cause records of fixed bugs (what broke, proven cause, what was ruled out, fix).

## Shipped

| Date | What | PR  |
| ---- | ---- | --- |

## Root-cause records

### 2026-10-04 · Audit chain verification failed on every chain (caught before shipping, P2c)

- **Symptom:** `verifyAuditChain` reported every org's chain broken at seq 1 in the first end-to-end integration run.
- **Proven cause:** the verifier recomputed hashes from the full DB row (`{...row}`), which includes `id`, `hash`,
  `prev_hash` and `recorded_at`; the writer hashes only the 18 audit fields. Probe output showed `prevHash` links intact
  and the extra keys in the hashed payload.
- **Ruled out:** broken `prev_hash` linkage (probe: linkage ok on every row); jsonb round-trip drift of `changes`/`policy`
  (chains verify end to end once only the hashed fields are compared).
- **Fix:** `hashedFields` picks the hashed fields explicitly; regression test `src/application/audit.test.ts`.
- **Blast radius / why silent:** verifier only; stored hashes were always correct. No chain had been verified before this test.
