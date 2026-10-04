# Security model and threat model (STRIDE-lite)

Status: **Draft for Phase 1 approval**. Security is a product requirement (charter §21). This page lists what
we protect, the threats that matter at prototype stage, the controls and the test that proves each one.
Revisited in Phase 5 (AI) and Phase 8 (hardening).

## Assets

1. **Integrity of decisions, approvals and audit:** the core trust promise.
2. **Scope confidentiality:** a branch manager must not see another region's insights, even with synthetic data,
   because the demo sells "permission-aware".
3. Secrets: database URL, Railway tokens, (P5) the LLM API key.
4. Availability of the demo environment during a pitch.

Out of scope until real customer data exists: PII handling, data residency, SSO. Any real company data is a
new approval gate (charter §30).

## Threats, controls, tests

| STRIDE                 | Threat                                                       | Control                                                                                                           | Test (phase)                                                                                         |
| ---------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Spoofing               | Someone uses the persona switcher outside the demo           | Switcher compiled in only when `DEMO_PERSONAS=on`; lists only `is_seeded` users; all environments behind login    | e2e: switcher absent when flag off (P2)                                                              |
| Spoofing               | Session theft / fixation                                     | Better Auth DB sessions, httpOnly + Secure + SameSite=Lax cookies, rotation on login, 12 h write freshness (AZ-3) | integration: stale session cannot write (P2)                                                         |
| Tampering              | Audit rows edited or deleted                                 | Insert-only grants, trigger, hash chain, doctor verification (ADR-004)                                            | integration: UPDATE/DELETE/TRUNCATE fail as app role **and** owner; doctor detects a forged row (P2) |
| Tampering              | Client sends a forged state or skips a step                  | State changes only through commands; inputs Zod-validated; current state read `FOR UPDATE` in the transaction     | transition-table tests incl. illegal transitions (P2)                                                |
| Tampering              | Approval reused for a modified action                        | Approval bound to an action version; change ⇒ withdrawn                                                           | test case §5.7 of authorization.md (P2)                                                              |
| Repudiation            | "I never approved that"                                      | Audit row with real user id, session id, switcher flag, request id, rationale                                     | trace reconstructed from audit alone (P2)                                                            |
| Information disclosure | IDOR: guessing `/insights/<id>` outside scope                | Every query scoped in SQL by `visible_unit_ids`; 404 (not 403) for out-of-scope ids                               | authz matrix tests over every query (P2–P3)                                                          |
| Information disclosure | Error messages or logs leak data                             | Generic errors to client; structured logs without payload bodies                                                  | review checklist (P2), log audit (P8)                                                                |
| Information disclosure | Secrets in git                                               | `.env` ignored; gitleaks in CI; tokens scoped and revocable                                                       | CI (P0, done)                                                                                        |
| Denial of service      | Demo crashes mid-pitch                                       | Health checks, recorded AI fallback (D8), demo reset, separate demo env                                           | rehearsals (P7); rate limiting (P8)                                                                  |
| Elevation of privilege | Server action or route handler mutates without authorization | Mutations only via `src/application/commands`, which require an `Actor`; lint bans DB imports in UI               | lint (P0, done); command tests (P2)                                                                  |
| Elevation of privilege | Self-approval or admin approval                              | AZ-2; Admin lacks `action.approve`                                                                                | tests (P2)                                                                                           |
| Elevation of privilege | AI or injected text triggers an action                       | `system:ai` can only recommend; untrusted text delimited; no tool can call approve/execute                        | injection eval cases (P5)                                                                            |
| Elevation of privilege | External data manipulates priority                           | External items are evidence + factor inputs, bounded 0–1, recorded with provenance                                | detector tests (P6)                                                                                  |

## Secrets and environments

- Secrets exist only in Railway variables (per environment) and local `.env` files.
- The Dev-scoped Railway token used by Claude lives in the session, never in the repo, and can be revoked at any time.
- Demo and Dev have separate databases; no data flows from Dev to demo except through the seed.

## Security review cadence

- Each PR touching `src/domain/policy`, `src/application/commands` or auth gets a security-focused review pass
  (code-review skill) before merge.
- Phase 5: AI-specific threat review. Phase 8: full review, dependency audit, authorization fuzzing.
