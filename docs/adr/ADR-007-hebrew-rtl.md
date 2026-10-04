# ADR-007: Hebrew and right-to-left

- Status: accepted (implementation choice by Claude; the requirement is Eran's, G-P4a, 2026-10-05)
- Context: "before phase 5 — I want to add Hebrew as a language → translate everything to Hebrew and make the
  dashboard also RTL (let the user choose the language)". P-6 (English only) is amended by G-P4a.

## Decision

1. **The reader chooses.** A cookie `vector_lang` (`en` | `he`, default `en`), set by the EN / עברית switch in the
   header and on the sign-in page. The root layout sets `<html lang dir>` from it, so every screen mirrors.
2. **Layout mirrors through logical CSS** (`ms`/`me`, `ps`/`pe`, `start`/`end`, `border-s`/`border-e`). Charts, codes
   (`font-mono`) and numbers (`.num`) stay left-to-right inside right-to-left text. "Go on" arrows point ← in Hebrew.
3. **Screen text:** `t("English text", { params })`, the English sentence is the key (no key catalogue to drift from
   the UI). Hebrew lives in `src/i18n/messages/he.ts` and `he-screens.ts`. Whole sentences are keys, never fragments,
   because Hebrew word order differs. A unit test fails on any `t("…")` without a Hebrew entry or with a lost
   placeholder.
4. **Data text** (unit, people and KPI names; seeded insights and commitments; sentences the detector, monitors and
   conflict rules generate) stays **English in the database**: the audit trail and frozen evidence are never
   rewritten, and generation stays deterministic. The reader's language is applied when a view is shown:
   `src/app/_lib/api.ts` wraps the facade and `localize()` walks each result — exact strings from `HE_CONTENT`,
   generated sentences by template (`HE_TEMPLATES`, whose parts are translated in turn), lists part by part.
   Identifier and code fields (ids, statuses, operations, bands, resources) are never translated. Text people type
   (lessons, notes, reasons) is shown as written.
5. **Dates** follow the locale (`he-IL` / `en-GB`).

## Consequences

- English output is unchanged (the full English e2e suite passes untouched); `tests/e2e/hebrew-rtl.spec.ts` covers
  the Hebrew path.
- New generated text needs a template in `he-content.ts`; `I18N_MISSES=1` logs every untranslated data string while
  browsing in Hebrew (how the dictionary was completed: a crawl of every persona and page found none left).
- Audit operation codes, payload keys and generator ids stay as technical identifiers in both languages.
- Phase 5 AI text: generate in the reader's language at request time, or translate the stored English the same way —
  decided with the Phase 5 design.
