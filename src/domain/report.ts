/**
 * Reports (plan v2, E5; reports.md §2, G-E0e): a report is a template's ordered blocks, each {metric, chart kind,
 * period, scope}. Before generating, the user adds, removes, reorders and edits blocks; the snapshot stores the exact
 * layout used. Pure: validation and editing only — the numbers come from the application's read models.
 */
export const REPORT_MODEL = "report-v1";

export const CHART_KINDS = ["line", "bars", "ring", "waterfall", "table", "text"] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

export const PERIODS = ["4w", "8w", "13w"] as const;
export type Period = (typeof PERIODS)[number];

export type Section =
  "headline" | "sales" | "finance" | "hr" | "projects" | "kpis" | "blockers" | "decisions" | "focus";

export type MetricSpec = {
  /** English title; the screen translates it. */
  title: string;
  section: Section;
  kinds: readonly ChartKind[];
  /** Periods the metric can be shown over (null: as of the report's date only). */
  periods: readonly Period[] | null;
};

export const METRICS = {
  headline: { title: "Headline and health", section: "headline", kinds: ["text"], periods: null },
  sales_vs_budget: { title: "Sales vs budget", section: "sales", kinds: ["line", "bars", "table"], periods: PERIODS },
  health_by_department: { title: "Health by department", section: "headline", kinds: ["bars", "table"], periods: null },
  pnl_vs_budget: { title: "P&L vs budget", section: "finance", kinds: ["bars", "waterfall", "table"], periods: null },
  projection: { title: "End of month and quarter", section: "finance", kinds: ["bars", "table"], periods: null },
  opex_vs_budget: { title: "Costs vs budget", section: "finance", kinds: ["bars", "table"], periods: null },
  headcount_cost: { title: "Headcount cost", section: "hr", kinds: ["line", "bars", "table"], periods: PERIODS },
  initiatives_status: { title: "Initiatives", section: "projects", kinds: ["ring", "table"], periods: null },
  kpis_on_target: { title: "KPIs on target", section: "kpis", kinds: ["ring", "table"], periods: null },
  blockers: { title: "Blockers", section: "blockers", kinds: ["table"], periods: null },
  decisions_needed: { title: "Decisions needed", section: "decisions", kinds: ["table"], periods: null },
  focus_next_week: { title: "Focus for next week", section: "focus", kinds: ["text", "table"], periods: null },
  health_by_region: { title: "Health by region", section: "headline", kinds: ["bars", "table"], periods: null },
  top_risks_opportunities: {
    title: "Top risks and opportunities",
    section: "decisions",
    kinds: ["table"],
    periods: null,
  },
} as const satisfies Record<string, MetricSpec>;

export type MetricId = keyof typeof METRICS;
export const METRIC_IDS = Object.keys(METRICS) as MetricId[];

export type Block = {
  id: string;
  metric: MetricId;
  kind: ChartKind;
  period: Period | null;
  /** A unit inside the report's scope; null = the report's scope. */
  scopeUnitId: string | null;
};

export const TEMPLATES = {
  weekly_management: {
    title: "Weekly management",
    metrics: [
      "headline",
      "health_by_department",
      "sales_vs_budget",
      "pnl_vs_budget",
      "projection",
      "headcount_cost",
      "initiatives_status",
      "kpis_on_target",
      "blockers",
      "decisions_needed",
      "focus_next_week",
    ],
  },
  board_pack: {
    title: "Board pack",
    metrics: [
      "headline",
      "pnl_vs_budget",
      "projection",
      "health_by_department",
      "health_by_region",
      "initiatives_status",
      "top_risks_opportunities",
      "decisions_needed",
      "kpis_on_target",
    ],
  },
} as const satisfies Record<string, { title: string; metrics: readonly MetricId[] }>;

export type TemplateId = keyof typeof TEMPLATES;
export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

export type Layout = { template: TemplateId; blocks: Block[] };

export const MAX_BLOCKS = 20;

const defaultBlock = (metric: MetricId, id: string): Block => ({
  id,
  metric,
  kind: METRICS[metric].kinds[0],
  period: METRICS[metric].periods ? "8w" : null,
  scopeUnitId: null,
});

/** The template's starting layout. Block ids are stable ("b1", "b2", …) so links can address them. */
/** Chart types a template starts with when they differ from the metric's first (the board pack's appendix tables). */
const TEMPLATE_KINDS: Partial<Record<TemplateId, Partial<Record<MetricId, ChartKind>>>> = {
  board_pack: { initiatives_status: "table", kpis_on_target: "table" },
};

export function templateLayout(template: TemplateId): Layout {
  return {
    template,
    blocks: TEMPLATES[template].metrics.map((m, k) => {
      const b = defaultBlock(m, `b${k + 1}`);
      const kind = TEMPLATE_KINDS[template]?.[m];
      return kind ? { ...b, kind } : b;
    }),
  };
}

const nextId = (l: Layout) => `b${Math.max(0, ...l.blocks.map((b) => Number(b.id.slice(1)) || 0)) + 1}`;

/** Validates untrusted input (a URL or a form): unknown metrics, kinds or periods are dropped or reset, never trusted. */
export function parseLayout(raw: unknown, scopeAllowed: (unitId: string) => boolean = () => false): Layout | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { template?: unknown; blocks?: unknown };
  if (typeof r.template !== "string" || !(r.template in TEMPLATES) || !Array.isArray(r.blocks)) return null;
  const seen = new Set<string>();
  const blocks: Block[] = [];
  for (const x of r.blocks.slice(0, MAX_BLOCKS)) {
    if (!x || typeof x !== "object") continue;
    const b = x as Record<string, unknown>;
    if (typeof b.metric !== "string" || !(b.metric in METRICS)) continue;
    const metric = b.metric as MetricId;
    const spec: MetricSpec = METRICS[metric];
    const id = typeof b.id === "string" && /^b\d{1,3}$/.test(b.id) && !seen.has(b.id) ? b.id : null;
    if (!id) continue;
    seen.add(id);
    blocks.push({
      id,
      metric,
      kind: spec.kinds.includes(b.kind as ChartKind) ? (b.kind as ChartKind) : spec.kinds[0],
      period: spec.periods ? (spec.periods.includes(b.period as Period) ? (b.period as Period) : "8w") : null,
      scopeUnitId: typeof b.scopeUnitId === "string" && scopeAllowed(b.scopeUnitId) ? b.scopeUnitId : null,
    });
  }
  return { template: r.template as TemplateId, blocks };
}

export function addBlock(l: Layout, metric: MetricId): Layout {
  if (l.blocks.length >= MAX_BLOCKS) return l;
  return { ...l, blocks: [...l.blocks, defaultBlock(metric, nextId(l))] };
}

export function removeBlock(l: Layout, id: string): Layout {
  return { ...l, blocks: l.blocks.filter((b) => b.id !== id) };
}

export function moveBlock(l: Layout, id: string, by: -1 | 1): Layout {
  const i = l.blocks.findIndex((b) => b.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= l.blocks.length) return l;
  const blocks = [...l.blocks];
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  return { ...l, blocks };
}

export function editBlock(
  l: Layout,
  id: string,
  change: { kind?: ChartKind; period?: Period; scopeUnitId?: string | null },
): Layout {
  return {
    ...l,
    blocks: l.blocks.map((b) => {
      if (b.id !== id) return b;
      const spec: MetricSpec = METRICS[b.metric];
      return {
        ...b,
        kind: change.kind && spec.kinds.includes(change.kind) ? change.kind : b.kind,
        period: spec.periods && change.period && spec.periods.includes(change.period) ? change.period : b.period,
        scopeUnitId: change.scopeUnitId !== undefined ? change.scopeUnitId : b.scopeUnitId,
      };
    }),
  };
}

export const periodWeeks = (p: Period | null) => (p === "4w" ? 4 : p === "13w" ? 13 : 8);
