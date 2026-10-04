# Security model and threat model (STRIDE-lite)

Status: **Approved (Phase 1, 2026-10-04); updated for Phase 2 as built.** Security is a product requirement
(charter §21). This page lists what we protect, the threats that matter at prototype stage, the controls and the
test that proves each one. Revisited in Phase 5 (AI) and Phase 8 (hardening).

## Assets

1. **Integrity of decisions, approvals and audit:** the core trust promise.
2. **Scope confidentiality:** a branch manager must not see another region's insights, even with synthetic data,
   because the demo sells "permission-aware".
3. Secrets: database URLs, `BETTER_AUTH_SECRET`, the seeded-user password, Railway tokens, (P5) the LLM API key.
4. Availability of the demo environment during a pitch.

Out of scope until real customer data exists: PII handling, data residency, SSO. Any real company data is a
new approval gate (charter §30).

## Threats, controls, tests

"Done" means the test exists and runs in CI today. Anything else names the phase it arrives in.

| STRIDE                 | Threat                                                       | Control                                                                                                                                                                                                                                                                | Test (phase)                                                                                                        |
| ---------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Spoofing               | Someone uses the persona switcher outside the demo           | Run-time check: the switcher list and the switch action work only when `DEMO_PERSONAS=on`; it signs in through the normal path with the seeded password; every switched session is flagged in audit                                                                    | e2e uses the switcher with the flag on (done); a test that it is absent with the flag off is not written yet (P3)   |
| Spoofing               | Session theft / fixation                                     | Better Auth DB sessions in httpOnly cookies (Secure in production), new session on every sign-in, sign-up disabled, sessions expire 12 h after sign-in (AZ-3)                                                                                                          | domain unit test of the AZ-3 rule (done); integration test that an expired session cannot write (P3)                |
| Tampering              | Audit rows edited or deleted                                 | Insert-only grants via `vector_app_rw`, trigger, hash chain, doctor verification of every epoch (ADR-004)                                                                                                                                                              | integration: UPDATE/DELETE/TRUNCATE fail as app role **and** owner; a forged row breaks chain verification (done)   |
| Tampering              | Client sends a forged state or skips a step                  | State changes only through commands; the current state is read `FOR UPDATE` and the transition table rejects anything unlisted. Inputs are checked by type and by explicit guards in the commands; Zod validation at the command boundary arrives with the Phase 3 API | every transition row and every illegal pair, unit-tested (done)                                                     |
| Tampering              | Approval reused for a modified action                        | Approval bound to an action revision; amend ⇒ withdrawn and re-requested; execution checks the revision                                                                                                                                                                | authorization.md §5.7 (done)                                                                                        |
| Tampering              | Policy or org changes after approval, before execution       | Not yet controlled: the approval policy is not re-evaluated at execution (A7b)                                                                                                                                                                                         | Phase 3                                                                                                             |
| Repudiation            | "I never approved that"                                      | Audit row with real user id, session id, switcher flag, request id, rationale                                                                                                                                                                                          | integration: the approval's audit row carries the approver, session and switcher flag (done)                        |
| Information disclosure | IDOR: guessing `/insights/<id>` outside scope                | Insight list and trace queries scoped in SQL by `visible_unit_ids`; out-of-scope ids return 404 (not 403)                                                                                                                                                              | integration: scope of the story insight (done); e2e: out-of-scope trace is 404 (done); matrix over every query (P3) |
| Information disclosure | Error messages or logs leak data                             | Domain errors are shown as short messages; other errors are not passed to the client; structured logs (pino) without payload bodies                                                                                                                                    | review checklist (P2), log audit (P8)                                                                               |
| Information disclosure | Secrets in git                                               | `.env` ignored; gitleaks in CI; tokens scoped and revocable; the seeded password has a default only in `local`/`test`                                                                                                                                                  | CI (P0, done)                                                                                                       |
| Denial of service      | Demo crashes mid-pitch                                       | Health check, `pnpm run doctor`, demo reset (new epoch), separate demo env, recorded AI fallback (D8, P5)                                                                                                                                                              | smoke after deploy (done); rehearsals (P7); rate limiting (P8)                                                      |
| Elevation of privilege | Server action or route handler mutates without authorization | Mutations only via `src/application/commands`, which require an `Actor` re-derived from the session; lint bans DB imports in UI components                                                                                                                             | lint (P0, done); command tests (done)                                                                               |
| Elevation of privilege | Self-approval or admin approval                              | AZ-2; Admin lacks `action.approve`; only people can approve (AZ-4)                                                                                                                                                                                                     | integration: owner, admin, viewer, ineligible manager and system actor are refused and audited (done)               |
| Elevation of privilege | Demo controls used to rewrite history                        | `demo.control` is Admin-only; `DEMO_CONTROLS=off` disables it; a reset creates a new epoch and never deletes audit rows                                                                                                                                                | integration: only Admin may drive the demo (done)                                                                   |
| Elevation of privilege | AI or injected text triggers an action                       | `system:ai` can only recommend; untrusted text delimited; no tool can call approve/execute                                                                                                                                                                             | injection eval cases (P5)                                                                                           |
| Elevation of privilege | External data manipulates priority                           | External items are evidence + factor inputs, bounded 0–1, recorded with provenance                                                                                                                                                                                     | detector tests (P6)                                                                                                 |

## Secrets and environments

- Secrets exist only in Railway variables (per environment) and local `.env` files.
- The Dev-scoped Railway token used by Claude lives in the session, never in the repo, and can be revoked at any time.
- Demo and Dev have separate databases; no data flows from Dev to demo except through the seed.
- Integration tests forge audit rows on purpose, so they refuse to run against a database whose name lacks "test"
  (`tests/integration/helpers.ts`); CI gives them their own `vector_test` database.

## Security review cadence

- Each PR touching `src/domain/policy`, `src/application/commands` or auth gets a security-focused review pass
  (code-review skill) before merge.
- Phase 5: AI-specific threat review. Phase 8: full review, dependency audit, authorization fuzzing.
