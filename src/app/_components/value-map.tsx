/**
 * Value map (plan v2, E3; cross-department.md §1): one bubble per action item — x = cost, y = expected impact by end
 * of quarter, size = execution risk (economics-v1), colour = band. Above the dashed break-even line an action returns
 * more than it costs this quarter. Beside it, the action items ranked by net value. No data access here.
 */
import Link from "next/link";
import type { ValuePoint } from "@/application/facade";
import type { T } from "@/i18n/t";
import { ils } from "./money-header";
import { Band, Card } from "./ui";

const BAND_FILL: Record<string, { fill: string; stroke: string; opacity: number }> = {
  O1: { fill: "#34d399", stroke: "#34d399", opacity: 0.85 },
  O2: { fill: "#34d399", stroke: "#34d399", opacity: 0.15 },
  O3: { fill: "#8fa1bc", stroke: "#8fa1bc", opacity: 0.35 },
  P1: { fill: "#f87171", stroke: "#f87171", opacity: 0.85 },
  P2: { fill: "#fbbf24", stroke: "#fbbf24", opacity: 0.6 },
  P3: { fill: "#22d3ee", stroke: "#22d3ee", opacity: 0.35 },
  P4: { fill: "#8fa1bc", stroke: "#8fa1bc", opacity: 0.3 },
};
const LEVEL_WORD = { low: "low", medium: "medium", high: "high" } as const;
const LEVEL_TONE = { low: "text-good", medium: "text-warn", high: "text-p1" } as const;

function riskHint(t: T, p: ValuePoint) {
  const f = p.risk.factors;
  return t("Execution risk {score} ({level}): dependencies {d}, conflict {c}, track record {r}, owner load {o}", {
    score: p.risk.score.toFixed(2),
    level: t(LEVEL_WORD[p.risk.level]),
    d: f.dependency.toFixed(2),
    c: f.conflict.toFixed(0),
    r: f.trackRecord.toFixed(2),
    o: f.ownerLoad.toFixed(2),
  });
}

function ValueMapSvg({ points, t, yLabel }: { points: ValuePoint[]; t: T; yLabel: string }) {
  const W = 560;
  const H = 400;
  const left = 56;
  const bottom = 36;
  const top = 28;
  const right = 16;
  const maxX = Math.max(1, ...points.map((p) => p.cost)) * 1.15;
  const maxY = Math.max(1, ...points.map((p) => p.impact)) * 1.15;
  // One scale for both axes would squash cheap items; each axis gets its own, and break-even is drawn in data units.
  const x = (v: number) => left + (v / maxX) * (W - left - right);
  const y = (v: number) => H - bottom - (v / maxY) * (H - top - bottom);
  const r = (risk: number) => 6 + risk * 16;
  const end = Math.min(maxX, maxY);
  const ticks = (m: number) => [0, 0.25, 0.5, 0.75, 1].map((k) => k * m);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("Value map")}>
      {ticks(maxY).map((v) => (
        <g key={`y${v}`}>
          <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} stroke="#22334f" strokeWidth="1" />
          <text x={left - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#8fa1bc" className="num">
            {ils(v)}
          </text>
        </g>
      ))}
      {ticks(maxX).map((v) => (
        <text
          key={`x${v}`}
          x={x(v)}
          y={H - bottom + 14}
          textAnchor="middle"
          fontSize="10"
          fill="#8fa1bc"
          className="num"
        >
          {ils(v)}
        </text>
      ))}
      <line x1={x(0)} y1={y(0)} x2={x(end)} y2={y(end)} stroke="#8fa1bc" strokeWidth="1.5" strokeDasharray="5 4">
        <title>{t("Break-even: impact = cost")}</title>
      </line>
      <text x={W - right} y={12} textAnchor="end" fontSize="11" fill="#34d399">
        {t("↖ cheap and valuable")}
      </text>
      <text x={W - right} y={H - 4} textAnchor="end" fontSize="11" fill="#f87171">
        {t("costs more than it returns ↘")}
      </text>
      <text x={left} y={H - 4} fontSize="11" fill="#8fa1bc">
        {t("cost →")}
      </text>
      <text x={left} y={12} fontSize="11" fill="#8fa1bc">
        {`↑ ${yLabel}`}
      </text>
      {[...points]
        .sort((a, b) => b.risk.score - a.risk.score)
        .map((p) => {
          const s = BAND_FILL[p.band] ?? BAND_FILL.P4;
          return (
            <a key={p.actionId} href={p.href} data-testid="value-bubble">
              <title>
                {`${p.title} · ${t("impact {i} · cost {c} · net {n}", { i: ils(p.impact), c: ils(p.cost), n: ils(p.net) })} · ${riskHint(t, p)}`}
              </title>
              <circle
                cx={x(p.cost)}
                cy={y(p.impact)}
                r={r(p.risk.score)}
                fill={s.fill}
                fillOpacity={s.opacity}
                stroke={s.stroke}
                strokeWidth="1.5"
              />
            </a>
          );
        })}
    </svg>
  );
}

export function ValueMapCard({ points, t, ws }: { points: ValuePoint[]; t: T; ws: "risk" | "opportunity" }) {
  if (points.length === 0) return null;
  const yLabel = ws === "risk" ? t("₪ protected by quarter end") : t("₪ gained by quarter end");
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <Card className="min-w-0" data-testid="value-map">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
            {ws === "risk" ? t("Response map") : t("Value map")}
          </h2>
          <span className="text-xs text-muted">{t("impact vs cost · size = execution risk")}</span>
        </div>
        <ValueMapSvg points={points} t={t} yLabel={yLabel} />
      </Card>
      <Card className="min-w-0" data-testid="value-list">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
            {t("Action items by net value")}
          </h2>
          <span className="text-xs text-muted">{t("by quarter end")}</span>
        </div>
        <ol className="flex flex-col gap-2.5">
          {points.slice(0, 8).map((p) => {
            const scale = Math.max(1, ...points.map((q) => Math.max(q.impact, q.cost)));
            return (
              <li key={p.actionId} className="min-w-0" data-testid="value-row">
                <div className="flex items-center gap-2 text-sm">
                  <Band band={p.band} />
                  <Link
                    href={p.href}
                    className="min-w-0 flex-1 truncate text-ink no-underline hover:underline"
                    title={p.title}
                  >
                    {p.title}
                  </Link>
                  <span className={`num shrink-0 text-xs font-semibold ${p.net >= 0 ? "text-good" : "text-p1"}`}>
                    {ils(p.net)}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                  <span>{t("impact")}</span>
                  <span className="block h-1.5 rounded bg-soft" title={ils(p.impact)}>
                    <span className="block h-1.5 rounded bg-good" style={{ width: `${(p.impact / scale) * 100}%` }} />
                  </span>
                  <span>{t("cost")}</span>
                  <span className="block h-1.5 rounded bg-soft" title={ils(p.cost)}>
                    <span
                      className="block h-1.5 rounded bg-muted"
                      style={{ width: `${Math.max(p.cost ? 1 : 0, (p.cost / scale) * 100)}%` }}
                    />
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted">
                  <span className={LEVEL_TONE[p.risk.level]} title={riskHint(t, p)}>
                    {t("risk {level}", { level: t(LEVEL_WORD[p.risk.level]) })}
                  </span>
                  {p.daysToValue !== null && <span>{t("value in {n} days", { n: p.daysToValue })}</span>}
                  {p.windowAt && (
                    <span>
                      {ws === "risk"
                        ? t("bites {date}", { date: p.windowAt.toISOString().slice(5, 10) })
                        : t("window closes {date}", { date: p.windowAt.toISOString().slice(5, 10) })}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
