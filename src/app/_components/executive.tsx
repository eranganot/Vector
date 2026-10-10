/**
 * The C-suite home (plan v2, E2; docs/specs/executive-home.md §3, wireframes v3 screen 1). Visual first: KPI tiles,
 * one main picture (the organization pulse, or the regions for a department), then supporting charts and one-line
 * lists with chips and one button each. Every chart mark carries its value as a hover title. No data access here.
 */
import Link from "next/link";
import { day } from "./format";
import type { ExecutiveHome, MoneyLine } from "@/application/facade";
import type { T } from "@/i18n/t";
import { getLocale, getT } from "../_lib/locale";
import { DependenciesCard, type CommitmentsView } from "./commitments";
import { Band, Card, fmtKpi } from "./ui";

type V = ExecutiveHome;
type Tone = "good" | "watch" | "bad";

const TONE_HEX: Record<Tone | "accent" | "muted", string> = {
  good: "#34d399",
  watch: "#fbbf24",
  bad: "#f87171",
  accent: "#22d3ee",
  muted: "#8fa1bc",
};
const toneOf = (status: string): Tone => (status === "healthy" ? "good" : status === "watch" ? "watch" : "bad");
const STATUS_WORD: Record<string, string> = { healthy: "healthy", watch: "watch", at_risk: "at risk" };
const DIRECTION_WORD: Record<string, string> = { improving: "improving", stable: "stable", worsening: "worsening" };
const VERDICT_WORD: Record<string, string> = { on_track: "on track", at_risk: "at risk", miss: "miss" };
const VERDICT_TONE: Record<string, Tone> = { on_track: "good", at_risk: "watch", miss: "bad" };

/** A signed number, isolated left-to-right so "−2.3%" keeps its sign in Hebrew sentences. */
const signed = (v: number, digits = 1, suffix = "") =>
  `\u2066${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(digits)}${suffix}\u2069`;
const arrow = (v: number) => (v > 0 ? "▲" : v < 0 ? "▼" : "●");
function ils(v: number) {
  const a = Math.abs(v);
  const s = v < 0 ? "−" : "";
  if (a >= 1_000_000_000) return `${s}₪${(a / 1_000_000_000).toFixed(2)}B`;
  if (a >= 1_000_000) return `${s}₪${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${s}₪${Math.round(a / 1000).toLocaleString("en-US")}k`;
  return `${s}₪${Math.round(a)}`;
}
const fmtLine = (v: number, unit: string) => (unit === "days" ? `${v.toFixed(1)}` : ils(v));

function Chip({ tone = "muted", children }: { tone?: Tone | "accent" | "muted"; children: React.ReactNode }) {
  const cls =
    tone === "good"
      ? "border-good/60 text-good bg-good/10"
      : tone === "watch"
        ? "border-warn/60 text-warn bg-warn/10"
        : tone === "bad"
          ? "border-p1/60 text-p1 bg-p1/10"
          : tone === "accent"
            ? "border-accent/60 text-accent bg-accent/10"
            : "border-line text-muted";
  return (
    <span className={`num inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[12px] ${cls}`}>
      {children}
    </span>
  );
}

function CardTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h2>
      {aside && <span className="text-xs text-muted">{aside}</span>}
    </div>
  );
}

// ── Tiles ──────────────────────────────────────────────────────────────────────

function Tile({
  icon,
  label,
  value,
  suffix,
  delta,
  deltaGood,
  bar,
  tone,
  foot,
  testId,
}: {
  icon: string;
  label: string;
  value: string;
  suffix?: string;
  delta?: string;
  deltaGood?: boolean;
  bar: number;
  tone: Tone | "accent";
  foot?: string;
  testId?: string;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4" data-testid={testId}>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[15px] font-semibold"
          style={{ background: `${TONE_HEX[tone]}22`, color: TONE_HEX[tone] }}
        >
          {icon}
        </span>
        <span className="truncate text-[13px] text-muted">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="num text-[28px] font-semibold leading-none tracking-tight">{value}</span>
        {suffix && <span className="num text-sm text-muted">{suffix}</span>}
        {delta && (
          <span className={`num text-[13px] font-semibold ${deltaGood ? "text-good" : "text-p1"}`}>{delta}</span>
        )}
      </div>
      <span className="block h-1.5 w-full rounded bg-soft">
        <span
          className="block h-1.5 rounded"
          style={{ width: `${Math.max(2, Math.min(100, bar))}%`, background: TONE_HEX[tone] }}
        />
      </span>
      {foot && <span className="truncate text-xs text-muted">{foot}</span>}
    </Card>
  );
}

function lineTile(t: T, l: MoneyLine | null, icon: string, label: string, testId: string) {
  if (!l) return null;
  const pct = l.budget ? (l.actual / l.budget) * 100 : 0;
  const good = l.gapPct >= 0;
  const tone: Tone = l.gapPct >= 0 ? "good" : l.gapPct >= -2 ? "watch" : "bad";
  const eom = l.eom;
  return (
    <Tile
      testId={testId}
      icon={icon}
      label={label}
      value={`${pct.toFixed(1)}%`}
      delta={`${arrow(l.gapPct)} ${Math.abs(l.gapPct).toFixed(1)}`}
      deltaGood={good}
      bar={pct}
      tone={tone}
      foot={
        eom
          ? t("{actual} of {budget} · month end {gap}", {
              actual: fmtLine(l.actual, l.unit),
              budget: fmtLine(l.budget, l.unit),
              gap: signed(eom.gapPct, 1, "%"),
            })
          : t("{actual} of {budget}", { actual: fmtLine(l.actual, l.unit), budget: fmtLine(l.budget, l.unit) })
      }
    />
  );
}

// ── Organization pulse ─────────────────────────────────────────────────────────

function OrgPulse({ v, t }: { v: V; t: T }) {
  const W = 640;
  const H = 420;
  const cx = W / 2;
  const cy = H / 2 - 8;
  const n = v.departments.length;
  const pos = new Map(
    v.departments.map((d, i) => {
      const a = -Math.PI / 2 + (i / n) * 2 * Math.PI;
      return [d.unitId, { x: cx + 250 * Math.cos(a), y: cy + 145 * Math.sin(a) }];
    }),
  );
  const R = 30;
  const C = 2 * Math.PI * R;
  const linkColor = { on_track: TONE_HEX.accent, blocked: TONE_HEX.bad, conflict: TONE_HEX.watch };
  const linkWord = { on_track: "dependency on track", blocked: "blocked", conflict: "conflict" };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("Organization pulse")}>
      {v.departments.map((d) => {
        const p = pos.get(d.unitId)!;
        return <line key={`s${d.unitId}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#22334f" strokeWidth="1" />;
      })}
      {v.links.map((l) => {
        const a = pos.get(l.from);
        const b = pos.get(l.to);
        if (!a || !b) return null;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const qx = mx + (cx - mx) * 0.45;
        const qy = my + (cy - my) * 0.45;
        const name = (id: string) => v.departments.find((d) => d.unitId === id)?.name ?? "";
        return (
          <path
            key={`${l.from}${l.to}${l.state}`}
            d={`M${a.x},${a.y} Q${qx},${qy} ${b.x},${b.y}`}
            fill="none"
            stroke={linkColor[l.state]}
            strokeWidth={Math.min(5, 1.5 + l.n)}
            strokeOpacity="0.85"
            strokeDasharray={l.state === "conflict" ? "6 4" : undefined}
          >
            <title>
              {`${name(l.from)} → ${name(l.to)}: ${t(linkWord[l.state])} · ${l.n}${l.ils ? ` · ${ils(l.ils)}` : ""}`}
            </title>
          </path>
        );
      })}
      <circle cx={cx} cy={cy} r="44" fill="#0b1626" stroke="#22d3ee" strokeWidth="2" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="15" fontWeight="700" fill="#e6edf7">
        VECTOR
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="13" fill="#22d3ee" className="num">
        {v.tiles.health.score}
      </text>
      {v.departments.map((d) => {
        const p = pos.get(d.unitId)!;
        const tone = toneOf(d.status);
        return (
          <a key={d.unitId} href={`/?unit=${d.unitId}`} data-testid="pulse-node">
            <title>
              {t("{name}: health {score} ({status}) · {change} vs last week · {eoq} projected at quarter end", {
                name: d.name,
                score: d.score,
                status: t(STATUS_WORD[d.status]),
                change: signed(d.change),
                eoq: d.projectedEoq,
              })}
            </title>
            <circle cx={p.x} cy={p.y} r={R + 8} fill="#0f1a2c" />
            <circle cx={p.x} cy={p.y} r={R} fill="none" stroke="#22334f" strokeWidth="6" />
            <circle
              cx={p.x}
              cy={p.y}
              r={R}
              fill="none"
              stroke={TONE_HEX[tone]}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(d.score / 100) * C} ${C}`}
              transform={`rotate(-90 ${p.x} ${p.y})`}
            />
            <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="15" fontWeight="600" fill="#e6edf7">
              {Math.round(d.score)}
            </text>
            <text x={p.x} y={p.y + R + 20} textAnchor="middle" fontSize="12" fill="#e6edf7">
              {d.name.length > 22 ? `${d.name.slice(0, 21)}…` : d.name}
            </text>
            <text
              x={p.x}
              y={p.y + R + 35}
              textAnchor="middle"
              fontSize="11"
              fill={d.change >= 0 ? TONE_HEX.good : TONE_HEX.bad}
            >
              {`${arrow(d.change)} ${Math.abs(d.change).toFixed(1)}`}
            </text>
          </a>
        );
      })}
    </svg>
  );
}

/** Rings for the five regions (group "by region" view, or a department's regions). */
function RegionRings({ v, t, hrefOf }: { v: V; t: T; hrefOf?: (id: string) => string }) {
  const W = 640;
  const H = 170;
  const n = Math.max(1, v.regions.length);
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("Health by region")}>
      {v.regions.map((r, i) => {
        const x = (W / n) * (i + 0.5);
        const y = 62;
        const tone = toneOf(r.status);
        const node = (
          <g key={r.unitId} data-testid="region-node">
            <title>
              {t("{name}: health {score} ({status}) · {change} vs last week", {
                name: r.name,
                score: r.score,
                status: t(STATUS_WORD[r.status]),
                change: signed(r.change),
              })}
            </title>
            <circle cx={x} cy={y} r={R} fill="none" stroke="#22334f" strokeWidth="7" />
            <circle
              cx={x}
              cy={y}
              r={R}
              fill="none"
              stroke={TONE_HEX[tone]}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${(r.score / 100) * C} ${C}`}
              transform={`rotate(-90 ${x} ${y})`}
            />
            <text x={x} y={y + 6} textAnchor="middle" fontSize="17" fontWeight="600" fill="#e6edf7">
              {Math.round(r.score)}
            </text>
            <text x={x} y={y + R + 22} textAnchor="middle" fontSize="13" fill="#e6edf7">
              {r.name}
            </text>
            <text
              x={x}
              y={y + R + 38}
              textAnchor="middle"
              fontSize="12"
              fill={r.change >= 0 ? TONE_HEX.good : TONE_HEX.bad}
            >
              {`${arrow(r.change)} ${Math.abs(r.change).toFixed(1)}`}
            </text>
          </g>
        );
        return hrefOf ? (
          <a key={r.unitId} href={hrefOf(r.unitId)}>
            {node}
          </a>
        ) : (
          node
        );
      })}
    </svg>
  );
}

/** Region × measure heat map of the gap to reference (a department's drill-down). */
function RegionHeat({ v, t }: { v: V; t: T }) {
  const codes = v.regions[0]?.parts.map((p) => ({ code: p.code, name: p.name })) ?? [];
  if (codes.length === 0) return null;
  const color = (gap: number) =>
    gap >= 0 ? "#34d39955" : gap >= -2.5 ? "#fbbf2455" : gap >= -5 ? "#fbbf24aa" : "#f87171bb";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th />
            {codes.map((c) => (
              <th key={c.code} className="px-1 text-start font-normal text-muted">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {v.regions.map((r) => (
            <tr key={r.unitId}>
              <th className="pe-2 text-start font-normal text-ink">{r.name}</th>
              {codes.map((c) => {
                const p = r.parts.find((x) => x.code === c.code);
                return (
                  <td
                    key={c.code}
                    className="num rounded px-2 py-1.5 text-center text-ink"
                    style={{ background: p ? color(p.gap) : "transparent" }}
                    title={p ? t("{name}: {gap}% vs reference", { name: c.name, gap: signed(p.gap) }) : undefined}
                  >
                    {p ? signed(p.gap, 1, "%") : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Bridge (waterfall) ─────────────────────────────────────────────────────────

function Waterfall({
  t,
  before,
  now,
  steps,
  beforeLabel,
  nowLabel,
}: {
  t: T;
  before: number;
  now: number;
  steps: { name: string; points: number }[];
  beforeLabel: string;
  nowLabel: string;
}) {
  // A horizontal waterfall: last week's total, one floating bar per contributor, today's total.
  const cum = steps.map((_, i) => before + steps.slice(0, i).reduce((x, s) => x + s.points, 0));
  const rows = [
    { name: beforeLabel, from: 0, to: before, total: true },
    ...steps.map((s, i) => ({ name: s.name, from: cum[i], to: cum[i] + s.points, total: false })),
    { name: nowLabel, from: 0, to: now, total: true },
  ];
  const lo = Math.max(0, Math.floor(Math.min(...rows.flatMap((r) => (r.total ? [r.to] : [r.from, r.to]))) - 5));
  const hi = Math.min(100, Math.ceil(Math.max(...rows.flatMap((r) => [r.from, r.to])) + 2));
  const pct = (v: number) => ((Math.max(lo, v) - lo) / (hi - lo || 1)) * 100;
  return (
    <ul className="flex flex-col gap-1" aria-label={t("Why health moved")}>
      {rows.map((r, i) => {
        const d = r.to - r.from;
        const a = r.total ? lo : Math.min(r.from, r.to);
        const b = r.total ? r.to : Math.max(r.from, r.to);
        const color = r.total ? TONE_HEX.accent : d > 0.05 ? TONE_HEX.good : d < -0.05 ? TONE_HEX.bad : TONE_HEX.muted;
        return (
          <li
            key={`${r.name}${i}`}
            className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_3rem] items-center gap-2 text-xs"
            title={
              r.total
                ? `${r.name}: ${r.to.toFixed(1)}`
                : t("{name}: {points} points", { name: r.name, points: signed(d) })
            }
          >
            <span className={`truncate ${r.total ? "font-semibold text-ink" : "text-muted"}`}>{r.name}</span>
            <span className="relative block h-3.5">
              <span
                className="absolute inset-y-0 rounded-sm"
                style={{
                  insetInlineStart: `${pct(a)}%`,
                  width: `${Math.max(0.8, pct(b) - pct(a))}%`,
                  background: color,
                  opacity: r.total ? 0.85 : 1,
                }}
              />
            </span>
            <span
              className={`num text-end ${r.total ? "font-semibold" : d < -0.05 ? "text-p1" : d > 0.05 ? "text-good" : "text-muted"}`}
            >
              {r.total ? r.to.toFixed(1) : signed(d)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Month chart ────────────────────────────────────────────────────────────────

function MonthChart({ v, t }: { v: V; t: T }) {
  const m = v.monthChart;
  const W = 460;
  const H = 190;
  const top = 16;
  const bottom = 26;
  const left = 8;
  const right = 52;
  const p = m.projection;
  const days = m.series;
  const lastActual = [...days].reverse().find((d) => d.actual !== null);
  const hi = Math.max(m.budgetTotal, p?.high ?? 0, lastActual?.actual ?? 0) * 1.04 || 1;
  const x = (i: number) => left + (i / Math.max(1, days.length - 1)) * (W - left - right);
  const y = (val: number) => top + (1 - val / hi) * (H - top - bottom);
  const iLast = lastActual ? days.indexOf(lastActual) : -1;
  const budgetPts = days.map((d, i) => `${x(i)},${y(d.budget)}`).join(" ");
  const actualPts = days
    .filter((d) => d.actual !== null)
    .map((d, i) => `${x(i)},${y(d.actual!)}`)
    .join(" ");
  const end = days.length - 1;
  const unit = m.code === "inventory_days" ? "days" : "ILS";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("Month to date vs budget")}>
      <polyline points={budgetPts} fill="none" stroke="#8fa1bc" strokeWidth="1.5" strokeDasharray="4 4">
        <title>{t("Budget for the month: {v}", { v: fmtLine(m.budgetTotal, unit) })}</title>
      </polyline>
      {iLast >= 0 && (
        <polygon
          points={`${x(0)},${y(0)} ${actualPts} ${x(iLast)},${y(0)}`}
          fill="#22d3ee"
          fillOpacity="0.12"
          stroke="none"
        />
      )}
      <polyline points={actualPts} fill="none" stroke="#22d3ee" strokeWidth="2.5" />
      {p && lastActual && iLast < end && (
        <g>
          <title>
            {t("Projected month end {mid} (range {low} to {high}) vs budget {budget}", {
              mid: fmtLine(p.mid, unit),
              low: fmtLine(p.low, unit),
              high: fmtLine(p.high, unit),
              budget: fmtLine(m.budgetTotal, unit),
            })}
          </title>
          <polygon
            points={`${x(iLast)},${y(lastActual.actual!)} ${x(end)},${y(p.high)} ${x(end)},${y(p.low)}`}
            fill="#22d3ee"
            fillOpacity="0.18"
          />
          <line
            x1={x(iLast)}
            y1={y(lastActual.actual!)}
            x2={x(end)}
            y2={y(p.mid)}
            stroke="#22d3ee"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
          <circle cx={x(end)} cy={y(p.mid)} r="3.5" fill={TONE_HEX[VERDICT_TONE[p.verdict]]} />
        </g>
      )}
      {lastActual && (
        <circle cx={x(iLast)} cy={y(lastActual.actual!)} r="3.5" fill="#22d3ee">
          <title>{`${lastActual.day}: ${fmtLine(lastActual.actual!, unit)}`}</title>
        </circle>
      )}
      <text x={W - right + 6} y={y(m.budgetTotal) + 4} fontSize="11" fill="#8fa1bc" className="num">
        {fmtLine(m.budgetTotal, unit)}
      </text>
      {p && (
        <text
          x={W - right + 6}
          y={y(p.mid) + (Math.abs(y(p.mid) - y(m.budgetTotal)) < 12 ? 14 : 4)}
          fontSize="11"
          fill={TONE_HEX[VERDICT_TONE[p.verdict]]}
          className="num"
        >
          {fmtLine(p.mid, unit)}
        </text>
      )}
      <text x={left} y={H - 8} fontSize="11" fill="#8fa1bc">
        {day(t, days[0]?.day)}
      </text>
      <text x={W - right} y={H - 8} fontSize="11" fill="#8fa1bc" textAnchor="end">
        {day(t, days[end]?.day)}
      </text>
    </svg>
  );
}

// ── Lists ──────────────────────────────────────────────────────────────────────

const BUTTON_WORD: Record<string, string> = {
  decide: "Decide",
  approve: "Approve",
  open: "Open",
  make_action: "Act",
};

function hoursWord(t: T, h: number | null) {
  if (h === null) return null;
  if (h <= 0) return t("now");
  if (h < 48) return t("in {n} h", { n: Math.round(h) });
  return t("in {n} days", { n: Math.round(h / 24) });
}

function Priorities({ v, t }: { v: V; t: T }) {
  return (
    <Card className="min-w-0" data-testid="priorities">
      <CardTitle aside={t("₪ × urgency × level")}>{t("Today's priorities")}</CardTitle>
      {v.focus.length === 0 ? (
        <p className="text-sm text-muted">{t("Nothing needs you now.")}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {v.focus.map((f, i) => (
            <li key={f.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto_auto] items-center gap-2">
              <span className="num grid h-6 w-6 place-items-center rounded-full bg-soft text-xs text-muted">
                {i + 1}
              </span>
              <span className="min-w-0">
                <Link href={f.href} className="block truncate text-sm text-ink no-underline hover:underline">
                  {f.title}
                </Link>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  {f.band ? <Band band={f.band} /> : <Chip tone="watch">{t("projected miss")}</Chip>}
                  {f.unitName ? <span className="truncate">{f.unitName}</span> : hoursWord(t, f.hoursLeft)}
                </span>
              </span>
              <Chip tone={f.kind === "opportunity" ? "good" : f.kind === "projection" ? "watch" : "bad"}>
                {f.kind === "projection"
                  ? t("{v} short", { v: ils(f.ils) })
                  : f.kind === "opportunity"
                    ? t("+{v}/wk", { v: ils(f.ils) })
                    : t("{v}/wk", { v: ils(f.ils) })}
              </Chip>
              <Link
                href={f.href}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold no-underline ${
                  f.button === "decide" || f.button === "approve"
                    ? "bg-accent text-accent-ink"
                    : "border border-line text-ink hover:border-accent"
                }`}
              >
                {t(BUTTON_WORD[f.button])}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

const RESPONSE: Record<string, { word: string; tone: Tone | "accent" | "muted" }> = {
  proposed: { word: "proposed", tone: "muted" },
  pending_approval: { word: "approval", tone: "watch" },
  ready: { word: "ready", tone: "accent" },
  executing: { word: "executing", tone: "accent" },
  executed: { word: "done", tone: "good" },
  failed: { word: "failed", tone: "bad" },
  cancelled: { word: "cancelled", tone: "muted" },
  recommended: { word: "to decide", tone: "watch" },
  accepted: { word: "accepted", tone: "good" },
  declined: { word: "declined", tone: "muted" },
};

function RisksOpps({ v, t }: { v: V; t: T }) {
  const rows = [...v.risks.slice(0, 3), ...v.opportunities.slice(0, 2)];
  return (
    <Card className="min-w-0">
      <CardTitle aside={<Link href="/risks">{t("All →")}</Link>}>{t("Risks & opportunities")}</CardTitle>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const opp = r.band.startsWith("O");
          const resp = r.response ? RESPONSE[r.response] : null;
          return (
            <li key={r.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 text-sm">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: opp ? TONE_HEX.good : r.band === "P1" ? TONE_HEX.bad : TONE_HEX.watch }}
              />
              <Link
                href={`/insights/${r.id}`}
                className="truncate text-ink no-underline hover:underline"
                title={r.title}
              >
                {r.title}
              </Link>
              <span className="num text-xs text-muted" title={t("confidence")}>
                {Math.round(r.confidence * 100)}%
              </span>
              {resp ? <Chip tone={resp.tone}>{t(resp.word)}</Chip> : <Band band={r.band} />}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function OutsideInside({ v, t }: { v: V; t: T }) {
  const rows = [
    { icon: "✓", label: t("Decisions made"), ...v.inside.decisions, upGood: true },
    { icon: "⇄", label: t("Commitments made"), ...v.inside.commitments, upGood: true },
    { icon: "⚠", label: t("Open blockers"), ...v.inside.blockers, upGood: false },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="min-w-0">
        <CardTitle aside={t("external events")}>{t("Outside")}</CardTitle>
        {v.outside.length === 0 ? (
          <p className="text-sm text-muted">{t("No external event in your scope.")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {v.outside.slice(0, 3).map((o) => (
              <li key={o.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                <span className={o.workstream === "opportunity" ? "text-good" : "text-p1"} aria-hidden>
                  {o.workstream === "opportunity" ? "↗" : "↘"}
                </span>
                <Link
                  href={`/insights/${o.id}`}
                  className="truncate text-ink no-underline hover:underline"
                  title={o.title}
                >
                  {o.title}
                </Link>
                <Band band={o.band} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="min-w-0">
        <CardTitle aside={t("last 7 days")}>{t("Inside")}</CardTitle>
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const d = r.now - r.before;
            const good = r.upGood ? d >= 0 : d <= 0;
            return (
              <li key={r.label} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto_3rem] items-center gap-2 text-sm">
                <span aria-hidden className="text-muted">
                  {r.icon}
                </span>
                <span className="truncate">{r.label}</span>
                <span className="num font-semibold">{r.now}</span>
                <span className={`num text-xs ${d === 0 ? "text-muted" : good ? "text-good" : "text-p1"}`}>
                  {d === 0 ? "●" : `${arrow(d)}${Math.abs(d)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function InsightCard({ v, t }: { v: V; t: T }) {
  const i = v.insight;
  return (
    <Card className="grid items-center gap-4 border-accent/40 bg-accent/5 md:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
          {t("VECTOR insight · rule-based")}
        </span>
        <p className="mt-1 text-[15px]" data-testid="vector-insight">
          {i.kind === "all_clear"
            ? v.scope.kind === "department"
              ? t("{dept} is healthy and steady.", { dept: v.departments[0]?.name ?? "" })
              : t("Every department is healthy and steady.")
            : t(
                "{dept} is the main drag: health {score} ({change} this week), driven by {cause}. Projected {eoq} at quarter end.",
                {
                  dept: i.department,
                  score: i.score,
                  change: signed(i.change),
                  cause: i.cause ?? t("open risks"),
                  eoq: i.projectedEoq,
                },
              )}
        </p>
      </div>
      {i.kind !== "all_clear" && i.href && (
        <Link
          href={i.href}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink no-underline"
        >
          {i.opens === "risk" ? t("Open the top risk →") : t("Open {dept} →", { dept: i.department })}
        </Link>
      )}
    </Card>
  );
}

/** Money vs budget: one row per line, a diverging bar of the month-to-date gap and the EOM / EOQ verdicts. */
function MoneyCard({ v, t, rows }: { v: V; t: T; rows: { unit?: string; line: MoneyLine }[] }) {
  const scale = 10; // ±10% fills half the bar
  return (
    <Card className="min-w-0" data-testid="money-card">
      <CardTitle aside={t("month to date · projections {model}", { model: v.model.projection })}>
        {t("Money vs budget")}
      </CardTitle>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(5rem,1.4fr)_3.5rem_auto_auto] items-center gap-x-3 gap-y-2 text-sm">
        <span className="text-xs text-muted">{t("Line")}</span>
        <span className="text-end text-xs text-muted">{t("Actual / budget")}</span>
        <span className="col-span-2 text-center text-xs text-muted">{t("Gap, month to date")}</span>
        <span className="text-xs text-muted">{t("Month end")}</span>
        <span className="text-xs text-muted">{t("Quarter end")}</span>
        {rows.map(({ unit, line: l }) => {
          const w = Math.min(50, (Math.abs(l.gapPct) / scale) * 50);
          const tone: Tone = l.gapPct >= 0 ? "good" : l.gapPct >= -2 ? "watch" : "bad";
          const how = l.eom
            ? t(
                "How this is calculated: actual to date {a} + run-rate {r}× budget still to come {b} − risk drag {d} + action lift {lift}",
                {
                  a: fmtLine(l.eom.terms.actualToDate, l.unit),
                  r: l.eom.terms.runRate.toFixed(3),
                  b: fmtLine(l.eom.terms.baseline, l.unit),
                  d: fmtLine(l.eom.terms.riskDrag, l.unit),
                  lift: fmtLine(l.eom.terms.actionLift, l.unit),
                },
              )
            : t("Latest level against the budgeted level");
          return (
            <div key={`${unit ?? ""}${l.code}`} className="contents" data-testid="money-row">
              <span className="min-w-0 truncate" title={how}>
                {unit && <span className="text-muted">{unit} · </span>}
                {l.name}
              </span>
              <span className="num truncate text-end text-xs text-muted">
                {fmtLine(l.actual, l.unit)} / {fmtLine(l.budget, l.unit)}
              </span>
              <span className="relative block h-4" title={signed(l.gapPct, 1, "%")}>
                <span className="absolute inset-y-0 start-1/2 w-px bg-line" />
                <span
                  className="absolute inset-y-0.5 rounded-sm"
                  style={{
                    background: TONE_HEX[tone],
                    width: `${Math.max(1, w)}%`,
                    ...(l.gapPct >= 0 ? { insetInlineStart: "50%" } : { insetInlineEnd: "50%" }),
                  }}
                />
              </span>
              <span
                className={`num text-end text-xs ${tone === "good" ? "text-good" : tone === "watch" ? "text-warn" : "text-p1"}`}
              >
                {signed(l.gapPct, 1, "%")}
              </span>
              <span>
                {l.eom ? (
                  <Chip tone={VERDICT_TONE[l.eom.verdict]}>{signed(l.eom.gapPct, 1, "%")}</Chip>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </span>
              <span>
                {l.eoq ? (
                  <Chip tone={VERDICT_TONE[l.eoq.verdict]}>{signed(l.eoq.gapPct, 1, "%")}</Chip>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DeptStrip({ v, t }: { v: V; t: T }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {v.departments.map((d) => (
        <li key={d.unitId}>
          <Link
            href={`/?unit=${d.unitId}`}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink no-underline hover:border-accent"
            data-testid="dept-row"
          >
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: TONE_HEX[toneOf(d.status)] }} />
            <span className="min-w-0">
              <span className="block truncate">{d.name}</span>
              <span className="block truncate text-xs text-muted">
                {d.cause
                  ? t("{cause} {points}", { cause: d.cause.name, points: signed(d.cause.points) })
                  : t(STATUS_WORD[d.status])}
              </span>
            </span>
            <span className="num text-end">
              <span className="font-semibold">{Math.round(d.score)}</span>{" "}
              <span className={`text-xs ${d.change >= 0 ? "text-good" : "text-p1"}`}>
                {arrow(d.change)}
                {Math.abs(d.change).toFixed(1)}
              </span>
              <span className="block text-[11px] text-muted">
                {t("EOQ {v} · {dir}", { v: Math.round(d.projectedEoq), dir: t(DIRECTION_WORD[d.direction]) })}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A department's measures: value against its reference and the attainment that enters health. */
function MeasuresCard({ v, t }: { v: V; t: T }) {
  const d = v.departments[0];
  return (
    <Card className="min-w-0" data-testid="measures">
      <CardTitle aside={t("attainment 0–100")}>{t("Measures")}</CardTitle>
      <ul className="grid gap-x-6 gap-y-3 md:grid-cols-2">
        {d.measures.map((m) => {
          const tone: Tone = m.attainment >= 80 ? "good" : m.attainment >= 60 ? "watch" : "bad";
          return (
            <li key={m.code} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{m.name}</span>
                <span className="num shrink-0 text-xs text-muted">
                  {fmtKpi(m.value, m.unit === "ils" ? "ILS" : m.unit)} · {t("ref.")}{" "}
                  {fmtKpi(m.reference, m.unit === "ils" ? "ILS" : m.unit)}
                </span>
              </div>
              <span className="mt-1 block h-1.5 w-full rounded bg-soft" title={`${Math.round(m.attainment)}/100`}>
                <span
                  className="block h-1.5 rounded"
                  style={{ width: `${Math.max(2, m.attainment)}%`, background: TONE_HEX[tone] }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ── The page ───────────────────────────────────────────────────────────────────

export async function ExecutiveHomeView({
  v,
  greeting,
  by,
  deps,
  waiting,
}: {
  v: V;
  greeting: string;
  by?: string;
  deps?: CommitmentsView | null;
  waiting?: React.ReactNode;
}) {
  const t = await getT();
  const locale = await getLocale();
  const month = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { month: "long", timeZone: "UTC" }).format(
    new Date(`${v.period.monthStart}T12:00:00Z`),
  );
  const dept = v.scope.kind === "department" ? v.departments[0] : null;
  const slipping = [...v.departments].filter((d) => d.change <= -3).sort((a, b) => a.change - b.change);
  const eom = v.monthChart.projection;
  const tail = eom
    ? t("{month} tracks {gap} to budget", { month, gap: signed(eom.gapPct, 1, "%") })
    : t("{month} has no budget yet", { month });
  const headline = dept
    ? t("Health {score} ({status}), {change} this week; {tail}", {
        score: dept.score,
        status: t(STATUS_WORD[dept.status]),
        change: signed(dept.change),
        tail,
      })
    : slipping.length >= 2
      ? t("{a} and {b} are slipping; {tail}", { a: slipping[0].name, b: slipping[1].name, tail })
      : slipping.length === 1
        ? t("{a} is slipping; {tail}", { a: slipping[0].name, tail })
        : t("Departments are steady; {tail}", { tail });

  const p1 = v.tiles.p1;
  const health = v.tiles.health;
  const headlineLabel =
    v.monthChart.code === "rev_net_sales"
      ? t("Revenue vs plan · {month}", { month })
      : t("{line} vs budget · {month}", { line: v.monthChart.name, month });
  const secondLabel =
    v.tiles.second?.code === "op_profit"
      ? t("Operating profit vs budget")
      : t("{line} vs budget", { line: v.tiles.second?.name ?? "" });

  const moneyRows = dept
    ? (v.financials[0]?.lines ?? []).map((line) => ({ line }))
    : [
        ...v.groupLines.map((line) => ({ unit: t("Group"), line })),
        // Per department, its worst line that the group rows do not already show.
        ...v.financials
          .map((f) => ({
            unit: f.name,
            line: f.lines
              .filter((l) => !["rev_net_sales", "gm_amount", "op_profit"].includes(l.code) && l.budget > 0)
              .sort((a, b) => a.gapPct - b.gapPct)[0],
          }))
          .filter((r) => r.line),
      ];
  const toggle = (
    <span className="flex gap-1 text-xs">
      <Link
        href="/"
        className={`rounded px-2 py-0.5 no-underline ${by !== "region" ? "bg-soft text-ink" : "text-muted"}`}
      >
        {t("Departments")}
      </Link>
      <Link
        href="/?by=region"
        className={`rounded px-2 py-0.5 no-underline ${by === "region" ? "bg-soft text-ink" : "text-muted"}`}
      >
        {t("Regions")}
      </Link>
    </span>
  );

  return (
    <div className="flex flex-col gap-4" data-testid="executive-home">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          {dept && v.scope.readsGroup && (
            <nav className="mb-1 text-xs text-muted">
              <Link href="/" className="text-muted">
                {t("Group")}
              </Link>{" "}
              › {dept.name}
            </nav>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{dept ? dept.name : greeting}</h1>
          <p className="text-sm text-muted" data-testid="headline">
            {headline}
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="tiles">
        <Tile
          testId="tile-health"
          icon="♥"
          label={dept ? t("Department health") : t("Company health")}
          value={`${Math.round(health.score)}`}
          suffix="/100"
          delta={`${arrow(health.change)} ${Math.abs(health.change).toFixed(1)}`}
          deltaGood={health.change >= 0}
          bar={health.score}
          tone={toneOf(health.status)}
          foot={t("{status} · vs last week", { status: t(STATUS_WORD[health.status]) })}
        />
        {lineTile(t, v.tiles.headline, "₪", headlineLabel, "tile-revenue")}
        {lineTile(t, v.tiles.second, "◎", secondLabel, "tile-profit")}
        <Tile
          testId="tile-p1"
          icon="!"
          label={t("Critical risks (P1)")}
          value={`${p1.count}`}
          bar={Math.min(100, p1.count * 20)}
          tone={p1.count ? "bad" : "good"}
          foot={p1.count ? t("{v} a week at stake", { v: ils(p1.ils) }) : t("none open")}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {dept && v.regions.length === 0 ? (
          <MeasuresCard v={v} t={t} />
        ) : dept ? (
          <Card className="min-w-0">
            <CardTitle aside={t("gap to reference, last 7 days / month to date")}>{t("By region")}</CardTitle>
            {v.regions.length > 0 ? (
              <>
                <RegionRings v={v} t={t} />
                <RegionHeat v={v} t={t} />
              </>
            ) : (
              <p className="text-sm text-muted">{t("This department's measures are group-wide; no region split.")}</p>
            )}
            {v.groupOnly.length > 0 && (
              <p className="mt-2 text-xs text-muted">{t("Group only: {list}", { list: v.groupOnly.join(" · ") })}</p>
            )}
          </Card>
        ) : (
          <Card className="min-w-0" data-testid="pulse">
            <CardTitle aside={toggle}>{by === "region" ? t("Health by region") : t("Organization pulse")}</CardTitle>
            {by === "region" ? <RegionRings v={v} t={t} /> : <OrgPulse v={v} t={t} />}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
              <span>
                <i className="me-1 inline-block h-2 w-3 rounded-sm" style={{ background: TONE_HEX.accent }} />
                {t("dependency on track")}
              </span>
              <span>
                <i className="me-1 inline-block h-2 w-3 rounded-sm" style={{ background: TONE_HEX.bad }} />
                {t("blocked")}
              </span>
              <span>
                <i className="me-1 inline-block h-2 w-3 rounded-sm" style={{ background: TONE_HEX.watch }} />
                {t("conflict")}
              </span>
              <span>{t("ring = health · ▲▼ = change vs last week")}</span>
            </div>
          </Card>
        )}
        <div className="flex min-w-0 flex-col gap-4">
          <Priorities v={v} t={t} />
          <Card className="min-w-0" data-testid="month-chart">
            <CardTitle
              aside={
                eom
                  ? t("month end {v} ({verdict})", {
                      v: signed(eom.gapPct, 1, "%"),
                      verdict: t(VERDICT_WORD[eom.verdict]),
                    })
                  : undefined
              }
            >
              {t("{line} · {month}", { line: v.monthChart.name, month })}
            </CardTitle>
            <MonthChart v={v} t={t} />
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
              <span>
                <i className="me-1 inline-block h-0.5 w-3 align-middle" style={{ background: TONE_HEX.accent }} />
                {t("actual")}
              </span>
              <span>
                <i className="me-1 inline-block h-0.5 w-3 align-middle" style={{ background: TONE_HEX.muted }} />
                {t("budget")}
              </span>
              <span>
                <i className="me-1 inline-block h-2 w-3 align-middle" style={{ background: "#22d3ee44" }} />
                {t("projection and range")}
              </span>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="min-w-0">
          <CardTitle aside={`${v.bridge.before.toFixed(1)} → ${v.bridge.now.toFixed(1)}`}>
            {t("Why health moved")}
          </CardTitle>
          {dept ? (
            <Waterfall
              t={t}
              before={dept.score - dept.change}
              now={dept.score}
              steps={dept.contributions.slice(0, 6).map((c) => ({
                name: c.code === "risk_load" ? t("Open risks") : c.name,
                points: c.points,
              }))}
              beforeLabel={t("last week")}
              nowLabel={t("today")}
            />
          ) : (
            <Waterfall
              t={t}
              before={v.bridge.before}
              now={v.bridge.now}
              steps={v.bridge.steps}
              beforeLabel={t("last week")}
              nowLabel={t("today")}
            />
          )}
        </Card>
        <RisksOpps v={v} t={t} />
        <OutsideInside v={v} t={t} />
      </div>

      <InsightCard v={v} t={t} />

      <div className={`grid gap-4 ${dept ? "" : "xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"}`}>
        {!dept && (
          <Card className="min-w-0">
            <CardTitle aside={t("health · change · end of quarter")}>{t("Departments")}</CardTitle>
            <DeptStrip v={v} t={t} />
            {v.regions.length > 0 && (
              <>
                <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                  {t("Regions")}
                </h3>
                <ul className="flex flex-wrap gap-2" data-testid="region-links">
                  {v.regions.map((r) => (
                    <li
                      key={r.unitId}
                      className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ background: TONE_HEX[toneOf(r.status)] }}
                      />
                      <Link href={`/units/${r.unitId}`} className="text-ink no-underline hover:underline">
                        {r.name}
                      </Link>
                      <span className="num text-xs text-muted">{Math.round(r.score)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        )}
        <MoneyCard v={v} t={t} rows={moneyRows} />
        {dept && v.regions.length > 0 && <MeasuresCard v={v} t={t} />}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {waiting}
        {deps ? (
          <DependenciesCard v={deps} unitId={v.scope.kind === "department" ? v.scope.unitId : undefined} />
        ) : null}
      </div>

      <details className="text-xs text-muted">
        <summary className="cursor-pointer">{t("How this is calculated")}</summary>
        <p className="mt-2 max-w-3xl">
          {t(
            "Health ({model}) = 45% KPI attainment + 35% money attainment + 20% open-risk load. A measure on or better than its reference scores 100; each 1% worse costs 8 points. The weekly change compares results with 7 days earlier.",
            { model: v.model.health },
          )}
        </p>
        <p className="mt-1 max-w-3xl">
          {t(
            "Projections ({model}) = actual to date + the budget still to come × the recent run-rate − risk drag (P1–P2 risks' ₪ a week × confidence) + action lift (approved 50%, executing 80%). The range is one standard deviation of recent days.",
            { model: v.model.projection },
          )}
        </p>
      </details>
    </div>
  );
}

export const _fmt = { ils, signed, fmtKpi };
