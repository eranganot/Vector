# Reports (E5)

Status: **Built (E5a–E5b, 2026-10-10): builder, weekly management and board pack templates, snapshots, editable PowerPoint, PDF from the print view; see §5–§6.** Proposed in E0 (2026-10-06). Implements FB item #10 and FB-9: materials for meetings, management and board
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

## 5. As built (E5a, 2026-10-10)

- **Model** `report-v1` (`src/domain/report.ts`, pure, unit-tested): 12 chart blocks (headline, health by department,
  sales vs budget, P&L vs budget, end of month and quarter, costs vs budget, headcount cost, initiatives, KPIs on
  target, blockers, decisions needed, focus for next week), each offering its chart types (line, bars, ring, waterfall,
  table, text) and, where it has a time axis, a period (last 4 / 8 / 13 weeks). Layouts are validated on every request;
  up to 20 blocks.
- **Builder** (`/reports`, wireframe v3 #6): template and scope (the group and departments the viewer may read,
  ADR-008); sections with ↑ ↓ ×; "Add a chart"; click a chart's title to edit its type, period and (in a group report)
  narrow it to one department. The layout lives in the URL, so every edit is a link and the preview is the server's
  numbers. The board pack template, region and branch scopes come in a later step.
- **Numbers** (`src/application/queries/report-data.ts`) come from the screens' read models: the executive home
  (health, money lines, projections, KPIs, focus), initiatives, commitments, dependencies, barriers and open
  recommendations. Sales and headcount cost are weekly actual vs budget from the ledger (trading-day weighted
  budgets). "Last year" is not shown: the synthetic data holds 52 weeks.
- **Snapshot** (`report` table, migration 0013): generating stores the resolved blocks with the layout, the as-of
  clock time, the language, a version per template, scope and language, and a SHA-256 content hash; audited as
  `report.generated` (capability `report.generate`: Executive, Department and Regional managers). `/reports/<id>`
  shows it in the language it was generated in, with a print view ("Print or save as PDF"). Only people who read its
  scope can open it; others get 404.
- **Not yet:** editable PowerPoint, the PDF export, the board pack (E5b–E5c); saving a layout as a personal variant
  (to decide at the E5 gate).

## 6. As built (E5b, 2026-10-10)

- **Board pack** template: executive summary, P&L vs budget, end of month and quarter, health by department and by
  region, strategic initiatives (table), top 5 risks and top 3 opportunities with ₪ and their response, decisions
  needed, KPI appendix (table). The Market & competitors section joins in E6, when that data exists.
- **Editable PowerPoint** (`/reports/<id>/pptx`, `src/infra/export/pptx.ts`, pptxgenjs 3.12): a cover slide and one
  slide per block — native line, bar and doughnut charts and native tables (long tables split across slides), so
  every number can be edited in PowerPoint or Google Slides. Hebrew decks are right to left (`rtl="1"`), Arial for
  Hebrew glyphs. Checked by opening both decks (python-pptx structure, LibreOffice render) and by an integration
  test on the file's charts, tables and RTL flags. Each download is audited (`report.downloaded`).
- **PDF**: from the snapshot's print view ("Print or save as PDF"): the browser renders it, so Hebrew right-to-left
  and mixed numbers are exact; the shell is hidden and the dark theme is kept (`print-color-adjust: exact`, A4
  landscape). **Spike decision:** no server-side PDF in the demo — headless Chromium on Railway would add a few
  hundred MB to the image for the same output the browser already gives. A server-rendered PDF (e.g. for scheduled
  e-mail) can come with the production channels.
