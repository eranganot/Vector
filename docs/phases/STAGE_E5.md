# Stage E5: Reports (plan v2)

Status: **Built and verified on Dev (e5e85d6); awaiting Eran's E5 gate.** Prod promotion is a separate step.

## What shipped

| PR  | What                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------- |
| #51 | E4e (your E4 review): readable dates, Hebrew table spacing, the department map as an ordered relay; G-E4 recorded          |
| #52 | E5a: reports builder, weekly management template, report-v1, immutable versioned snapshots (migration 0013), snapshot page |
| #53 | E5b: board pack template, editable PowerPoint (native charts and tables, Hebrew right to left), PDF from the print view    |

## What to look at in the demo (Dev)

1. **Reports** (sidebar): the builder opens on the weekly management report for the group.
   - **Template** and **Scope** at the top: weekly management or board pack; the group or any department (Noa sees
     only Supply Chain).
   - **Sections** on the left: ↑ ↓ to reorder, × to remove. **Add a chart** below: any of 14 charts.
   - Click a chart's title to **edit** it: chart type (line, bars, table, ring, waterfall), period (last 4 / 8 / 13
     weeks) and, in a group report, narrow it to one department. The canvas is the live numbers.
2. **Generate** stores a snapshot that never changes: version, as-of time, who generated it and a fingerprint
   (sha256). It opens in the language it was generated in.
3. **PowerPoint (editable)** on the snapshot downloads a deck: a cover and one slide per chart, with native charts and
   tables you can edit in PowerPoint or Google Slides. In Hebrew the deck is right to left.
4. **Print or save as PDF** prints the snapshot as it looks on screen (A4 landscape).
5. **Board pack**: summary, P&L, end of month and quarter, health by department and by region, initiatives, top 5
   risks and top 3 opportunities with ₪, decisions, and a KPI appendix.
6. **Your E4 comments (E4e):** dates read "27 Oct" everywhere; in Hebrew the due date no longer touches the next
   step; the Cross-department map says who must act now, the order departments work in, what is held up and the
   blockers.

## Verified

- Local: lint, typecheck, unit 583, integration 127, e2e 52/52, smoke 19/19 (phase 9 added).
- Decks opened: structure checked with python-pptx and rendered with LibreOffice, English and Hebrew; an integration
  test checks the file's charts, tables and right-to-left flags.
- CI green on each PR and on `main`. Dev e5e85d6: health ok, migrations 14/14, smoke 19/19, e2e 52/52 against Dev,
  a weekly deck downloaded from Dev in both languages (14 slides, 7 charts, 6 tables), demo reset after.

## Choices made within the spec (docs/specs/reports.md §5–§6)

- **PDF:** from the browser's print view, not generated on the server. It renders Hebrew right to left exactly;
  server-side Chromium would add a few hundred MB to the deploy for the same output. A server PDF can come with the
  production channels (e.g. scheduled e-mail).
- **Last year:** not shown in "Sales vs budget": the synthetic data holds 52 weeks.
- **Scopes:** the group and departments. Region and branch reports, and the board pack's Market & competitors
  section, follow with E6 data.

## For your decision

1. Accept E5 (or comments).
2. Should people be able to **save their edited layout** as a personal version of a template? (The spec left this
   for the E5 gate.)
3. Whether to promote Prod (`demo`, still Phase 4) now or later.
