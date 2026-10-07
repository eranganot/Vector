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

const STEP: Record<ValuePoint["workflow"]["step"], { word: string; tone: string }> = {
  decide: { word: "waiting for a decision", tone: "#fbbf24" },
  approve: { word: "waiting for approval", tone: "#fbbf24" },
  ready: { word: "ready to run", tone: "#22d3ee" },
  executing: { word: "executing", tone: "#22d3ee" },
  done: { word: "done", tone: "#34d399" },
  failed: { word: "failed", tone: "#f87171" },
  cancelled: { word: "cancelled", tone: "#8fa1bc" },
};

export function blockerText(t: T, b: ValuePoint["blockers"][number]) {
  return b.kind === "dependency"
    ? t("{waiting} waits on {on}: {title} ({status})", {
        waiting: b.waiting,
        on: b.on,
        title: b.title,
        status: t(b.status === "blocked" ? "blocked" : "at risk"),
      })
    : t("Conflict: {a} ({unitA}) ↔ {b} ({unitB})", { a: b.a, unitA: b.unitA, b: b.b, unitB: b.unitB });
}

/** Who has to act now, grouped by person: the decisions and approvals each one holds, and what is blocked. */
function WhoActs({ points, t }: { points: ValuePoint[]; t: T }) {
  const open = points.filter((p) => p.workflow.step === "decide" || p.workflow.step === "approve");
  const byPerson = new Map<string, { decide: number; approve: number; ils: number }>();
  for (const p of open)
    for (const n of p.workflow.waitingOn) {
      const e = byPerson.get(n) ?? { decide: 0, approve: 0, ils: 0 };
      e[p.workflow.step as "decide" | "approve"] += 1;
      e.ils += Math.max(0, p.net);
      byPerson.set(n, e);
    }
  const people = [...byPerson.entries()].sort((a, b) => b[1].ils - a[1].ils);
  const blocked = points.filter((p) => p.blockers.length > 0);
  const counts = [
    { n: points.filter((p) => p.workflow.step === "decide").length, label: t("wait for a decision"), color: "#fbbf24" },
    { n: points.filter((p) => p.workflow.step === "approve").length, label: t("wait for approval"), color: "#fbbf24" },
    { n: blocked.length, label: t("blocked"), color: "#f87171" },
    { n: points.filter((p) => p.workflow.viewer).length, label: t("wait on you"), color: "#22d3ee" },
  ];
  return (
    <Card className="min-w-0" data-testid="who-acts">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{t("Who needs to act")}</h2>
        <span className="text-xs text-muted">{t("{n} action items", { n: points.length })}</span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {counts.map((c) => (
          <div key={c.label} className="rounded-lg border border-line px-3 py-2">
            <span className="num block text-xl font-semibold" style={{ color: c.color }}>
              {c.n}
            </span>
            <span className="text-xs text-muted">{c.label}</span>
          </div>
        ))}
      </div>
      {people.length === 0 ? (
        <p className="text-sm text-muted">{t("No decision or approval is pending.")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {people.map(([name, e]) => (
            <li key={name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">
              <span className="min-w-0 truncate">{name}</span>
              <span className="flex gap-1.5 text-[11px]">
                {e.decide > 0 && (
                  <span className="rounded-md border border-warn/60 px-1.5 text-warn">
                    {t("decide {n}", { n: e.decide })}
                  </span>
                )}
                {e.approve > 0 && (
                  <span className="rounded-md border border-warn/60 px-1.5 text-warn">
                    {t("approve {n}", { n: e.approve })}
                  </span>
                )}
                <span className="num text-muted">{ils(e.ils)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The action plan: every action item with what, who, its next step and who that waits on, blockers, due and value. */
function ActionPlan({ points, t, now }: { points: ValuePoint[]; t: T; now: Date }) {
  return (
    <Card className="min-w-0 overflow-x-auto" data-testid="action-plan">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{t("Action plan")}</h2>
        <span className="text-xs text-muted">{t("by net value by quarter end · click an item for its analysis")}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-1 text-start font-normal">{t("What")}</th>
            <th className="py-1 text-start font-normal">{t("Owner")}</th>
            <th className="py-1 text-start font-normal">{t("Next step · waiting on")}</th>
            <th className="py-1 text-start font-normal">{t("Blockers")}</th>
            <th className="py-1 text-start font-normal">{t("Due")}</th>
            <th className="py-1 text-end font-normal">{t("Net")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {points.map((p) => {
            const st = STEP[p.workflow.step];
            const overdue = p.dueAt && p.dueAt.getTime() < now.getTime() && p.workflow.step !== "done";
            return (
              <tr key={p.actionId} className="border-t border-line align-top" data-testid="value-row">
                <td className="py-2 pe-3">
                  <span className="flex items-start gap-2">
                    <Band band={p.band} />
                    <span className="min-w-0">
                      <Link href={p.href} className="font-semibold text-ink no-underline hover:underline">
                        {p.title}
                      </Link>
                      <span className="block text-xs text-muted">{p.insightTitle}</span>
                    </span>
                  </span>
                </td>
                <td className="py-2 pe-3 text-xs">
                  <span className="block text-ink">{p.workflow.owner.name}</span>
                  <span className="text-muted">{p.workflow.owner.unit}</span>
                </td>
                <td className="py-2 pe-3 text-xs">
                  <span className="block font-semibold" style={{ color: st.tone }}>
                    {t(st.word)}
                  </span>
                  {p.workflow.waitingOn.length > 0 && (
                    <span className="text-muted">{p.workflow.waitingOn.join(", ")}</span>
                  )}
                </td>
                <td className="py-2 pe-3 text-xs">
                  {p.blockers.length === 0 ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <ul className="flex flex-col gap-1 text-p1">
                      {p.blockers.map((b, k) => (
                        <li key={k}>
                          {b.kind === "conflict" && b.insightId ? (
                            <Link href={`/insights/${b.insightId}`} className="text-p1">
                              {blockerText(t, b)}
                            </Link>
                          ) : (
                            blockerText(t, b)
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className={`num py-2 pe-3 text-xs ${overdue ? "text-p1" : "text-muted"}`}>
                  {p.dueAt ? p.dueAt.toISOString().slice(5, 10) : "—"}
                  {overdue && <span className="block">{t("overdue")}</span>}
                </td>
                <td className="py-2 pe-3 text-end text-xs">
                  <span className={`num block font-semibold ${p.net >= 0 ? "text-good" : "text-p1"}`}>
                    {ils(p.net)}
                  </span>
                  <span className={`block ${LEVEL_TONE[p.risk.level]}`} title={riskHint(t, p)}>
                    {t("risk {level}", { level: t(LEVEL_WORD[p.risk.level]) })}
                  </span>
                </td>
                <td className="py-2 text-end">
                  {p.workflow.viewer === "approve" ? (
                    <Link
                      href="/approvals"
                      className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-ink no-underline"
                    >
                      {t("Approve")}
                    </Link>
                  ) : p.workflow.viewer === "decide" ? (
                    <Link
                      href={p.href}
                      className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-ink no-underline"
                    >
                      {t("Decide")}
                    </Link>
                  ) : (
                    <Link
                      href={p.href}
                      className="rounded-md border border-line px-3 py-1 text-xs text-ink no-underline hover:border-accent"
                    >
                      {t("Open")}
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

export function ValueMapCard({
  points,
  t,
  ws,
  now,
}: {
  points: ValuePoint[];
  t: T;
  ws: "risk" | "opportunity";
  now: Date;
}) {
  if (points.length === 0) return null;
  const yLabel = ws === "risk" ? t("₪ protected by quarter end") : t("₪ gained by quarter end");
  return (
    <>
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
        <WhoActs points={points} t={t} />
      </div>
      <ActionPlan points={points} t={t} now={now} />
    </>
  );
}
