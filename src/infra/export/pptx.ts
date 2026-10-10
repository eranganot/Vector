/**
 * Editable PowerPoint export (plan v2, E5b; reports.md §3): one title slide and one slide per report block, with
 * native charts (line, bars, doughnut) and native tables so every number stays editable in PowerPoint and Google
 * Slides. Right-to-left decks for Hebrew. The caller passes already-translated text; this adapter only lays it out.
 */
import PptxGenJS from "pptxgenjs";

export type DeckSeries = { name: string; values: number[] };
export type DeckSlide =
  | {
      kind: "bullets";
      title: string;
      note?: string;
      big?: { value: string; label: string; color: string };
      bullets: string[];
    }
  | {
      kind: "line" | "bar" | "hbar";
      title: string;
      note?: string;
      categories: string[];
      series: DeckSeries[];
      format: "ils" | "pct" | "num";
      colors?: string[];
    }
  | { kind: "doughnut"; title: string; note?: string; value: number; total: number; label: string; table?: DeckTable }
  | { kind: "table"; title: string; note?: string; table: DeckTable };
export type DeckTable = { columns: string[]; rows: { cells: string[]; tone?: "good" | "watch" | "bad" | null }[] };
export type Deck = {
  rtl: boolean;
  title: string;
  subtitle: string;
  meta: string;
  footer: string;
  slides: DeckSlide[];
};

const INK = "E6EDF7";
const MUTED = "8FA1BC";
const BG = "0B1220";
const PANEL = "111A2B";
const ACCENT = "22D3EE";
const TONE = { good: "34D399", watch: "FBBF24", bad: "F87171" } as const;
const FONT = "Arial"; // has Hebrew glyphs on every platform
const FMT = { ils: "₪#,##0", pct: '0.0"%"', num: "#,##0" } as const;
const ROWS_PER_SLIDE = 11;

export async function buildDeck(deck: Deck): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 in
  pptx.rtlMode = deck.rtl;
  pptx.title = deck.title;
  pptx.company = "VECTOR | Organizational Intelligence";
  const align = deck.rtl ? "right" : "left";
  const text = { fontFace: FONT, color: INK, rtlMode: deck.rtl, align } as const;

  pptx.defineSlideMaster({
    title: "VECTOR",
    background: { color: BG },
    objects: [
      { rect: { x: 0, y: 7.1, w: 13.33, h: 0.4, fill: { color: PANEL } } },
      {
        text: {
          text: deck.footer,
          options: {
            x: 0.4,
            y: 7.12,
            w: 12.5,
            h: 0.32,
            fontSize: 9,
            color: MUTED,
            fontFace: FONT,
            rtlMode: deck.rtl,
            align,
          },
        },
      },
    ],
  });

  const cover = pptx.addSlide({ masterName: "VECTOR" });
  cover.addText("VECTOR", {
    ...text,
    x: 0.6,
    y: 1.2,
    w: 12,
    h: 0.5,
    fontSize: 16,
    bold: true,
    color: ACCENT,
    charSpacing: 4,
  });
  cover.addText(deck.title, { ...text, x: 0.6, y: 2.0, w: 12, h: 1.0, fontSize: 36, bold: true });
  cover.addText(deck.subtitle, { ...text, x: 0.6, y: 3.1, w: 12, h: 0.6, fontSize: 20, color: MUTED });
  cover.addText(deck.meta, { ...text, x: 0.6, y: 4.0, w: 12, h: 0.5, fontSize: 12, color: MUTED });

  for (const s of deck.slides) {
    const pages = s.kind === "table" ? Math.max(1, Math.ceil(s.table.rows.length / ROWS_PER_SLIDE)) : 1;
    for (let page = 0; page < pages; page++) {
      const slide = pptx.addSlide({ masterName: "VECTOR" });
      slide.addText(pages > 1 ? `${s.title} (${page + 1}/${pages})` : s.title, {
        ...text,
        x: 0.5,
        y: 0.3,
        w: 12.3,
        h: 0.6,
        fontSize: 24,
        bold: true,
      });
      if (s.note) slide.addText(s.note, { ...text, x: 0.5, y: 0.9, w: 12.3, h: 0.4, fontSize: 12, color: MUTED });
      const top = 1.45;
      switch (s.kind) {
        case "bullets": {
          if (s.big) {
            slide.addShape(pptx.ShapeType.roundRect, {
              x: deck.rtl ? 10.9 : 0.5,
              y: top,
              w: 1.9,
              h: 1.6,
              fill: { color: PANEL },
              line: { color: s.big.color, width: 2 },
              rectRadius: 0.1,
            });
            slide.addText(s.big.value, {
              ...text,
              align: "center",
              x: deck.rtl ? 10.9 : 0.5,
              y: top + 0.15,
              w: 1.9,
              h: 0.9,
              fontSize: 40,
              bold: true,
              color: s.big.color,
            });
            slide.addText(s.big.label, {
              ...text,
              align: "center",
              x: deck.rtl ? 10.9 : 0.5,
              y: top + 1.0,
              w: 1.9,
              h: 0.4,
              fontSize: 12,
              color: MUTED,
            });
          }
          slide.addText(
            s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
            {
              ...text,
              x: s.big && !deck.rtl ? 2.7 : 0.5,
              y: top,
              w: s.big ? 10.1 : 12.3,
              h: 5.2,
              fontSize: 18,
              valign: "top",
              paraSpaceAfter: 8,
            },
          );
          break;
        }
        case "line":
        case "bar":
        case "hbar": {
          const type = s.kind === "line" ? pptx.ChartType.line : pptx.ChartType.bar;
          slide.addChart(
            type,
            s.series.map((x) => ({ name: x.name, labels: s.categories, values: x.values })),
            {
              x: 0.5,
              y: top,
              w: 12.3,
              h: 5.4,
              barDir: s.kind === "hbar" ? "bar" : "col",
              barGrouping: "clustered",
              chartColors: s.colors ?? [ACCENT, MUTED],
              lineSize: 3,
              lineDataSymbolSize: 7,
              showLegend: s.series.length > 1,
              legendPos: "t",
              legendColor: INK,
              legendFontFace: FONT,
              catAxisLabelColor: INK,
              valAxisLabelColor: MUTED,
              catAxisLabelFontFace: FONT,
              valAxisLabelFontFace: FONT,
              valAxisLabelFormatCode: FMT[s.format],
              dataLabelFormatCode: FMT[s.format],
              showValue: s.kind !== "line",
              dataLabelColor: INK,
              valGridLine: { color: "22334F", size: 0.5 },
              catGridLine: { style: "none" },
              catAxisOrientation: (s.kind === "hbar" || deck.rtl ? "maxMin" : "minMax") as "minMax",
              catAxisLabelPos: "low",
              valAxisLabelFontSize: 11,
              catAxisLabelFontSize: 11,
            },
          );
          break;
        }
        case "doughnut": {
          slide.addChart(
            pptx.ChartType.doughnut,
            [{ name: s.label, labels: [s.label, "—"], values: [s.value, Math.max(0, s.total - s.value)] }],
            {
              x: deck.rtl ? 9.3 : 0.5,
              y: top,
              w: 3.5,
              h: 3.5,
              holeSize: 65,
              chartColors: [ACCENT, "22334F"],
              showLegend: false,
              showPercent: false,
              showValue: false,
              dataLabelColor: INK,
            },
          );
          slide.addText(`${s.total ? Math.round((s.value / s.total) * 100) : 0}%`, {
            ...text,
            align: "center",
            x: deck.rtl ? 9.3 : 0.5,
            y: top + 1.35,
            w: 3.5,
            h: 0.6,
            fontSize: 28,
            bold: true,
          });
          slide.addText(`${s.value} / ${s.total} · ${s.label}`, {
            ...text,
            align: "center",
            x: deck.rtl ? 9.3 : 0.5,
            y: top + 3.6,
            w: 3.5,
            h: 0.4,
            fontSize: 12,
            color: MUTED,
          });
          if (s.table)
            addTable(slide, s.table.columns, s.table.rows.slice(0, 8), { x: deck.rtl ? 0.5 : 4.3, y: top, w: 8.5 });
          break;
        }
        case "table":
          addTable(slide, s.table.columns, s.table.rows.slice(page * ROWS_PER_SLIDE, (page + 1) * ROWS_PER_SLIDE), {
            x: 0.5,
            y: top,
            w: 12.3,
          });
          break;
      }
    }
  }

  function addTable(
    slide: PptxGenJS.Slide,
    columns: string[],
    rows: DeckTable["rows"],
    at: { x: number; y: number; w: number },
  ) {
    const head = columns.map((c, k) => ({
      text: c,
      options: { bold: true, color: MUTED, fill: { color: PANEL }, align: k === 0 ? align : "right" },
    }));
    const body = rows.map((r) =>
      r.cells.map((c, k) => ({
        text: c,
        options: { color: k === 0 && r.tone ? TONE[r.tone] : INK, align: k === 0 ? align : "right" },
      })),
    );
    const first = Math.min(0.5, 0.25 + 0.05 * columns.length);
    const colW = columns.map((_, k) => (k === 0 ? at.w * first : (at.w * (1 - first)) / (columns.length - 1 || 1)));
    slide.addTable(
      [head, ...body] as PptxGenJS.TableRow[],
      {
        x: at.x,
        y: at.y,
        w: at.w,
        colW,
        fontFace: FONT,
        fontSize: 11,
        color: INK,
        border: { type: "solid", color: "22334F", pt: 0.5 },
        rowH: 0.42,
        valign: "middle",
        rtlMode: deck.rtl,
        autoPage: false,
      } as PptxGenJS.TableProps,
    );
  }

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}
