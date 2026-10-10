# Stage E1: foundation (plan v2)

Status: **Signed off by Eran 2026-10-06 (G-E1).** Built and verified on Dev. Prod promotion is a separate step.

## What shipped

| PR  | What                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| #34 | E1a: the product name "VECTOR \| Organizational Intelligence" / "VECTOR \| אינטליגנציה ארגונית" on every screen, tab title and sign-in (FB-2)        |
| #35 | E1b: C-suite flag, COO persona (Oren Halevi), CFO and COO read the whole group (ADR-008), C-suite navigation; a root-cause fix for commitment owners |
| #36 | E1c: synthetic data v5: 52 weeks, money lines and monthly budgets (gross margin 26%, G-E0g), action economics, 8 initiatives                         |

## What to look at in the demo (Dev)

1. **Sign-in page and any tab:** the full name, in English and in Hebrew (switch EN / עברית).
2. **Michal Golan (CFO) and Oren Halevi (COO):** both land on the group Command Center. "Waiting on you" is second in
   the navigation. Approve and Decide buttons still appear only in their own departments.
3. **Hila Dahan (VP HR):** lands on HR. She sees only what touches HR.
4. **Eitan Rosen (VP Trade & Commercial):** gross margin now reads 26.0% against a 26.0% target.
5. **Not visible yet, by design:** the money lines, budgets, action economics and initiatives are in the database and
   covered by tests. E2 (C-suite home) and E3 (opportunities, cross-department) put them on screen.

## Verification

- **Local:** 530 unit, 89 integration and 29 e2e tests pass; `doctor` passes, including the new "budgets cover actuals"
  check (13 months, all budgeted).
- **Dev (0ad0ea1):** health ok, migrations 10/10, seed p5-v1. Smoke passes 14/14, including three new E1 checks. The
  full e2e suite passed against Dev (29/29), and the demo was reset afterwards. Persona sign-ins checked: Dana, Michal,
  Oren and Hila.

## Notes for the gate

- **Measured P&L** (52 weeks, financials.md §1): net sales ₪2.57B; gross margin 25.9%; store labor 15.3%; operating
  profit 3.5%. Store labor comes from the existing KPI model, so the approved labor stories keep their numbers.
- **Boot time:** with four times the history, a demo reset takes about 8 s locally. Dev reseeded on boot within the
  health-check window.
- **Next:** E2, the C-suite home v2 (wireframes v3, screen 1), with health-v2 and projection-v1.
