# Decisions register

Approved product and architecture decisions (charter Priority 3). Newest first. Each entry: what, who, when.
Changing an entry requires Eran's explicit approval.

| Date       | ID   | Decision                                                                                                                                                                            | Approved by |
| ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 2026-10-04 | D-AI | AI provider: Anthropic Claude is the working assumption, but Eran may switch to Google Gemini; final choice at the Phase 5 gate. Phase 5 builds a provider-neutral AI gateway seam. | Eran        |
| 2026-10-04 | D10  | Thin slice first: Phase 2 ships a minimal real UI (trace page, approvals inbox)                                                                                                     | Eran        |
| 2026-10-04 | D9   | External source: Open-Meteo weather forecasts mapped to branch locations (final confirmation at Phase 6 gate)                                                                       | Eran        |
| 2026-10-04 | D8   | AI demo resilience: live generation with fallback to the last recorded generation for identical inputs, shown with a "recorded" badge                                               | Eran        |
| 2026-10-04 | D7   | Action execution is simulated and labelled (internal tasks + visible outbox); optional real email channel in Phase 7                                                                | Eran        |
| 2026-10-04 | D6   | "Learning" in the MVP = recorded outcome verdicts + human lessons + AI-proposed adjustments (priority weights, playbooks) approved by a human. No silent self-tuning                | Eran        |
| 2026-10-04 | D5   | Approval rules and states are built in Phase 2; Phase 4 adds approval workflow UX                                                                                                   | Eran        |
| 2026-10-04 | D4   | Claude holds a Railway token scoped to the Dev environment (session only, never committed)                                                                                          | Eran        |
| 2026-10-04 | D3   | Within an approved phase Claude merges its own PRs on green CI; `main` auto-deploys to Dev; `demo` updates only on phase sign-off                                                   | Eran        |
| 2026-10-04 | D2   | Railway project "Vector" with Dev and demo environments, each web + Postgres (~$10–20/month)                                                                                        | Eran        |
| 2026-10-04 | D1   | Stack: TypeScript modular monolith — Next.js App Router, PostgreSQL 16, Drizzle ORM, Better Auth; framework-free domain core (ADR-001)                                              | Eran        |
| 2026-10-04 | P-8  | Approval cadence: autonomous within a phase; gate at phase end with a demo, plus charter §30 gates mid-phase                                                                        | Eran        |
| 2026-10-04 | P-7  | No hard deadline; quality first                                                                                                                                                     | Eran        |
| 2026-10-04 | P-6  | UI language: English only                                                                                                                                                           | Eran        |
| 2026-10-04 | P-5  | Sign-in: seeded users with real login + demo-only persona switcher                                                                                                                  | Eran        |
| 2026-10-04 | P-4  | Hosting: new Railway project on Eran's existing account                                                                                                                             | Eran        |
| 2026-10-04 | P-3  | Code flow: Claude GitHub App on eranganot/Vector; Claude pushes branches and opens PRs                                                                                              | Eran        |
| 2026-10-04 | P-2  | Primary audiences: investors/fundraising and internal pitch                                                                                                                         | Eran        |
| 2026-10-04 | P-1  | Charter (docs/product/CHARTER.md) adopted as the product vision and development charter                                                                                             | Eran        |
