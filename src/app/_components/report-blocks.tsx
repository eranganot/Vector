/**
 * Report blocks (plan v2, E5; reports.md §2): one renderer for the builder's preview and the generated snapshot. Each
 * block draws its data as the chosen chart: line, bars, ring, waterfall, table or text. Server-rendered SVG; the same
 * numbers go to the PowerPoint export.
 */
import type { BlockData, ResolvedBlock } from "@/application/facade";
import type { T } from "@/i18n/t";
import { day } from "./format";
import { ils } from "./money-header";

const C = {
  good: "#34d399",
  watch: "#fbbf24",
  bad: "#f87171",
  accent: "#22d3ee",
  muted: "#8fa1bc",
  line: "#22334f",
  ink: "#e6edf7",
};
const TONE: Record<string, string> = { good: C.good, watch: C.watch, bad: C.bad };

const fmt = (v: number | string | null, money: boolean) =>
  v === null
    ? "—"
    : typeof v === "string"
      ? v
      : money
        ? ils(v)
        : Number.isInteger(v)
          ? v.toLocaleString("en-US")
          : v.toFixed(1);

/** Columns whose numbers are ₪ (by header). */
const MONEY_COL = /₪|Actual|Budget|Month to date|End of|at stake/;

function Series({ d, kind, t }: { d: Extract<BlockData, { type: "series" }>; kind: string; t: T }) {
  const W = 520;
  const H = 190;
  const L = 52;
  const B = 24;
  const vals = d.points.flatMap((p) => [p.actual, p.budget]);
  const max = Math.max(...vals) * 1.05;
  const min = kind === "bars" ? 0 : Math.min(...vals) * 0.95;
  const x = (i: number) => L + ((W - L - 8) * (i + 0.5)) / d.points.length;
  const y = (v: number) => 8 + (H - B - 8) * (1 - (v - min) / (max - min || 1));
  const bw = ((W - L - 8) / d.points.length) * 0.32;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={d.line}>
      {[min, (min + max) / 2, max].map((v, k) => (
        <g key={k}>
          <line x1={L} x2={W - 8} y1={y(v)} y2={y(v)} stroke={C.line} />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill={C.muted}>
            {ils(v)}
          </text>
        </g>
      ))}
      {kind === "bars" ? (
        d.points.map((p, i) => (
          <g key={p.label}>
            <rect x={x(i) - bw - 1} y={y(p.budget)} width={bw} height={y(min) - y(p.budget)} fill={C.line} />
            <rect
              x={x(i) + 1}
              y={y(p.actual)}
              width={bw}
              height={y(min) - y(p.actual)}
              fill={p.actual >= p.budget ? C.good : C.bad}
            >
              <title>{`${p.label}: ${ils(p.actual)} / ${ils(p.budget)}`}</title>
            </rect>
          </g>
        ))
      ) : (
        <>
          <polyline
            points={d.points.map((p, i) => `${x(i)},${y(p.budget)}`).join(" ")}
            fill="none"
            stroke={C.muted}
            strokeDasharray="5 4"
            strokeWidth="1.5"
          />
          <polyline
            points={d.points.map((p, i) => `${x(i)},${y(p.actual)}`).join(" ")}
            fill="none"
            stroke={C.accent}
            strokeWidth="2.5"
          />
          {d.points.map((p, i) => (
            <circle key={p.label} cx={x(i)} cy={y(p.actual)} r="3" fill={p.actual >= p.budget ? C.good : C.bad}>
              <title>{`${p.label}: ${ils(p.actual)} / ${ils(p.budget)}`}</title>
            </circle>
          ))}
        </>
      )}
      {d.points.map((p, i) => (
        <text key={p.label} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill={C.muted}>
          {p.label}
        </text>
      ))}
      <text x={W - 8} y={14} textAnchor="end" fontSize="10" fill={C.muted}>
        {`— ${t("actual")}  - - ${t("budget")}`}
      </text>
    </svg>
  );
}

function Bars({ d }: { d: Extract<BlockData, { type: "bars" }> }) {
  const row = 24;
  const W = 440;
  const LABEL = 150;
  const VALUE = 56;
  const H = d.rows.length * row + 8;
  const signed = d.unit === "pct" && d.rows.some((r) => r.reference === undefined);
  const maxAbs = Math.max(1, ...d.rows.map((r) => Math.abs(r.value)), ...d.rows.map((r) => r.reference ?? 0));
  const span = W - LABEL - VALUE - 8;
  const zero = signed ? LABEL + span / 2 : LABEL;
  const scale = signed ? span / 2 / maxAbs : span / (d.unit === "score" ? 100 : maxAbs * 1.05);
  const label = (v: number) => (d.unit === "pct" ? `${v > 0 && signed ? "+" : ""}${v}%` : String(v));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {signed && <line x1={zero} x2={zero} y1={0} y2={H} stroke={C.muted} strokeDasharray="3 3" />}
      {d.rows.map((r, i) => {
        const w = Math.abs(r.value) * scale;
        const x0 = signed && r.value < 0 ? zero - w : zero;
        const yy = 4 + i * row;
        return (
          <g key={`${r.label}${i}`}>
            <title>{`${r.label}: ${label(r.value)}`}</title>
            <text x={LABEL - 8} y={yy + 15} textAnchor="end" fontSize="12" fill={C.ink}>
              {r.label.length > 22 ? `${r.label.slice(0, 21)}…` : r.label}
            </text>
            <rect x={x0} y={yy + 4} width={Math.max(2, w)} height={row - 9} rx="3" fill={TONE[r.tone] ?? C.accent} />
            {r.reference !== undefined && (
              <line
                x1={zero + r.reference * scale}
                x2={zero + r.reference * scale}
                y1={yy}
                y2={yy + row - 2}
                stroke={C.ink}
                strokeWidth="1.5"
              />
            )}
            <text x={W - 4} y={yy + 15} textAnchor="end" fontSize="12" fontWeight="600" fill={TONE[r.tone] ?? C.muted}>
              {label(r.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Ring({ d, t }: { d: Extract<BlockData, { type: "ring" }>; t: T }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const share = d.total ? d.value / d.total : 0;
  const color = share >= 0.75 ? C.good : share >= 0.5 ? C.watch : C.bad;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={t(d.label)}>
        <circle cx="60" cy="60" r={r} fill="none" stroke={C.line} strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${share * c} ${c}`}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="58" textAnchor="middle" fontSize="20" fontWeight="700" fill={C.ink}>
          {`${Math.round(share * 100)}%`}
        </text>
        <text x="60" y="76" textAnchor="middle" fontSize="10" fill={C.muted}>
          {`${d.value} / ${d.total}`}
        </text>
      </svg>
      <div className="min-w-0 grow">
        <p className="mb-1 text-xs text-muted">{t(d.label)}</p>
        <Table d={{ type: "table", columns: d.columns, rows: d.rows }} t={t} compact />
      </div>
    </div>
  );
}

function Waterfall({ d }: { d: Extract<BlockData, { type: "waterfall" }> }) {
  const all = [...d.steps, d.end];
  const W = 520;
  const H = 200;
  // Cumulative position of each step (computed, not reassigned: lint react-hooks/immutability).
  const ends = d.steps.map((_, i) => d.steps.slice(0, i + 1).reduce((acc, x) => acc + x.value, 0));
  const bars = d.steps.map((s, i) => ({ ...s, from: i ? ends[i - 1] : 0, to: ends[i] }));
  const lo = Math.min(0, ...bars.map((b) => Math.min(b.from, b.to)));
  const hi = Math.max(0, ...bars.map((b) => Math.max(b.from, b.to)));
  const y = (v: number) => 12 + (H - 50) * (1 - (v - lo) / (hi - lo || 1));
  const bw = (W - 20) / all.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <line x1={10} x2={W - 10} y1={y(0)} y2={y(0)} stroke={C.muted} strokeDasharray="3 3" />
      {bars.map((b, i) => (
        <g key={b.label}>
          <rect
            x={10 + i * bw + 4}
            y={y(Math.max(b.from, b.to))}
            width={bw - 8}
            height={Math.max(2, Math.abs(y(b.from) - y(b.to)))}
            fill={b.value >= 0 ? C.good : C.bad}
          >
            <title>{`${b.label}: ${ils(b.value)}`}</title>
          </rect>
          <text x={10 + i * bw + bw / 2} y={H - 26} textAnchor="middle" fontSize="9" fill={C.muted}>
            {b.label.length > 12 ? `${b.label.slice(0, 11)}…` : b.label}
          </text>
          <text
            x={10 + i * bw + bw / 2}
            y={H - 12}
            textAnchor="middle"
            fontSize="9"
            fill={b.value >= 0 ? C.good : C.bad}
          >
            {`${b.value >= 0 ? "+" : "−"}${ils(Math.abs(b.value))}`}
          </text>
        </g>
      ))}
      <rect
        x={10 + bars.length * bw + 4}
        y={y(Math.max(0, d.end.value))}
        width={bw - 8}
        height={Math.max(2, Math.abs(y(0) - y(d.end.value)))}
        fill={C.accent}
      />
      <text
        x={10 + bars.length * bw + bw / 2}
        y={H - 12}
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill={C.ink}
      >
        {`${d.end.value >= 0 ? "+" : "−"}${ils(Math.abs(d.end.value))}`}
      </text>
    </svg>
  );
}

function Table({ d, t, compact }: { d: Extract<BlockData, { type: "table" }>; t: T; compact?: boolean }) {
  if (d.rows.length === 0) return <p className="text-sm text-muted">{t(d.empty ?? "Nothing to show.")}</p>;
  return (
    <table className="w-full text-[13px]" data-testid="report-table">
      <thead className="text-xs text-muted">
        <tr>
          {d.columns.map((c, k) => (
            <th key={c} className={`py-1 pe-3 font-normal ${k === 0 ? "text-start" : "whitespace-nowrap text-end"}`}>
              {t(c)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {d.rows.slice(0, compact ? 5 : 30).map((r, i) => (
          <tr key={i} className="border-t border-line align-top">
            <td className="py-1.5 pe-3">
              <span className="flex items-start gap-2">
                {r.tone && (
                  <span
                    aria-hidden
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: TONE[r.tone] }}
                  />
                )}
                <span className="min-w-0">
                  <span className="block">{r.label}</span>
                  {r.sub && <span className="block text-xs text-muted">{r.sub}</span>}
                </span>
              </span>
            </td>
            {r.values.map((v, k) => (
              <td key={k} className="num whitespace-nowrap py-1.5 pe-3 text-end">
                {typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)
                  ? day(t, v.slice(0, 10)) + v.slice(10).replace(/^ · /, " · ")
                  : typeof v === "string"
                    ? t(v)
                    : fmt(v, MONEY_COL.test(d.columns[k + 1] ?? ""))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {d.more ? (
        <tfoot>
          <tr>
            <td colSpan={d.columns.length} className="pt-1 text-xs text-muted">
              {t("and {n} more", { n: d.more })}
            </td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

export function BlockBody({ b, t }: { b: ResolvedBlock; t: T }) {
  const d = b.data;
  switch (d.type) {
    case "headline":
      return (
        <div className="flex flex-wrap items-start gap-4">
          {b.metric === "headline" && (
            <div className="flex flex-col items-center rounded-lg border border-line px-4 py-2">
              <span
                className="num text-3xl font-semibold"
                style={{ color: d.status === "healthy" ? C.good : d.status === "watch" ? C.watch : C.bad }}
              >
                {d.health}
              </span>
              <span className="text-xs text-muted">{t("health")}</span>
            </div>
          )}
          <ul className="flex min-w-0 grow flex-col gap-1 text-sm">
            {d.sentences.map((s, k) => (
              <li key={k}>
                {t(
                  s.text,
                  Object.fromEntries(
                    Object.entries(s.params ?? {}).map(([k2, v]) => [k2, k2 === "ils" ? ils(Number(v)) : v]),
                  ),
                )}
              </li>
            ))}
          </ul>
        </div>
      );
    case "series":
      return <Series d={d} kind={b.kind} t={t} />;
    case "bars":
      return <Bars d={d} />;
    case "ring":
      return <Ring d={d} t={t} />;
    case "waterfall":
      return <Waterfall d={d} />;
    case "table":
      return <Table d={d} t={t} />;
    default:
      return <p className="text-sm text-muted">{t(d.reason)}</p>;
  }
}
