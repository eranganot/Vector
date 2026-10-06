# Reports (E5)

Status: **Proposed (E0, 2026-10-06).** Implements FB item #10 and FB-9: materials for meetings, management and board
discussions, in-app, as PDF and as editable PowerPoint. The weekly management report comes first, then the board pack.

## 1. Who can generate what

You can generate a report for **your own scope or any unit below it** (FB #10.1). The CEO can generate for the group,
any region, branch or department. A VP can generate for their department and its regions. The scope selector lists
only units you may read (ADR-008); the read model checks it again on the server.

## 2. Templates

**Editable charts (G-E0e, Eran 2026-10-06).** A template gives a starting set of sections and chart blocks. Before
generating, the user can:

- **add** a chart from a library;
- **remove** a chart;
- **reorder** charts;
- **edit** a chart: its type (line, bars, ring, waterfall, table), period and scope.

Each block is `{metric, chart type, period, scope}`, resolved by the same read models as the screens. Whether the user
can save their layout as a personal variant of the template is to be decided at the E5 gate. The generated snapshot
stores the exact layout used. In the PowerPoint export, each chart is a native, editable chart.

| Template                      | Sections (in order)                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Weekly management** (first) | 1. Headline and health (strip, change, causes). 2. Sales vs budget and last year. 3. Finance: P&L lines vs budget, EOM/EOQ projection. 4. HR: headcount cost, vacancies, training, overtime. 5. Projects: initiatives, milestones, flags. 6. KPIs vs targets. 7. Blockers (barriers, blocked dependencies, overdue commitments). 8. **Decisions needed** (who, by when, ₪). 9. Focus for next week |
| **Board pack** (second)       | 1. Executive summary. 2. Group P&L vs budget, quarter to date and projection. 3. Health by department and region. 4. Strategic initiatives. 5. Market & competitors (E6, cited). 6. Top 5 risks and top 3 opportunities with ₪. 7. Decisions for the board. 8. Appendix: KPI tables                                                                                                                |

Every number in a report comes from the same read models as the screens, as of the report's clock time. Every
generated sentence uses templates (FB-11), in the reader's language.

## 3. Generation and storage

- A report is a **snapshot**: `report` (template, version, scope unit, as-of clock time, generated_by, language,
  content JSON, content hash) plus its files. It never changes after generation. Regenerating creates a new version.
  Generation is audited (`report.generated`, `report.downloaded`).
- **In-app**: a page that renders the snapshot, with a print view.
- **PowerPoint (editable)**: generated server-side with a pure JavaScript PPTX writer. Text boxes, tables and native
  charts are kept editable. Right-to-left text and Hebrew fonts are applied for Hebrew decks.
- **PDF**: rendered from the in-app print view. E5 starts with a one-day spike to choose between headless Chromium
  print and a JavaScript PDF writer. The deciding test is Hebrew right-to-left with mixed numbers, which Chromium
  handles natively. Chromium adds image size and memory on Railway, which the spike measures.

## 4. Acceptance (E5)

- Weekly management report for the group (Dana) and for Supply Chain (Noa), in English and Hebrew, in all three
  formats. Numbers match the screens at the same clock time (integration test).
- The PPTX opens in PowerPoint and in Google Slides, with editable text, tables and charts (checked by opening the file).
- A user cannot generate for a unit outside their scope (integration test).
