/**
 * Dependency flow (plan v2, E4d; Eran: "how an action, or a delay in taking one, in one department affects the other
 * departments down the road — money, time — as part of the project flow"). Departments' commitments left to right
 * (right to left in Hebrew), arrows for "needs it by", and knock-on-v1's projection: days late and ₪ lost on each
 * arrow. A what-if delay on any box shows what it would do to everyone after it.
 */
import Link from "next/link";
import type { DependencyFlow } from "@/application/facade";
import type { Locale } from "@/i18n/locale";
import type { T } from "@/i18n/t";
import { FLOW_HEX } from "./event-plan";
import { shortDay } from "./format";
import { ils } from "./money-header";
import { Card } from "./ui";

const BOX_W = 210;
const BOX_H = 84;
const END_H = 76;
const COL_GAP = 80;
const ROW_GAP = 18;
const PAD = 12;
export const WHAT_IF_DAYS = [3, 7, 14] as const;

/** Up to two lines of about `n` characters, cut at a word. */
function lines(s: string, n = 30): string[] {
  const words = s.split(" ");
  const out: string[] = [""];
  for (const w of words) {
    const cur = out[out.length - 1];
    if ((cur + " " + w).trim().length <= n) out[out.length - 1] = (cur + " " + w).trim();
    else if (out.length < 2) out.push(w);
    else {
      out[1] = out[1].slice(0, n - 1).trimEnd() + "…";
      break;
    }
  }
  return out;
}

export function DependencyFlowCard({
  flow,
  t,
  locale,
  base,
}: {
  flow: DependencyFlow;
  t: T;
  locale: Locale;
  /** The page URL without what-if parameters, e.g. "/initiatives?i=I-HOLIDAY". */
  base: string;
}) {
  const rtl = locale === "he";
  type Box = { id: string; depth: number; h: number; x: number; y: number };
  const all: Box[] = [
    ...flow.nodes.map((n) => ({ id: n.id, depth: n.depth, h: BOX_H, x: 0, y: 0 })),
    ...flow.ends.map((e) => ({ id: e.id, depth: e.depth, h: END_H, x: 0, y: 0 })),
  ];
  const cols = Math.max(...all.map((b) => b.depth)) + 1;
  const W = cols * BOX_W + (cols - 1) * COL_GAP + PAD * 2;
  const heights = Array.from({ length: cols }, (_, c) =>
    all.filter((b) => b.depth === c).reduce((a, b) => a + b.h + ROW_GAP, -ROW_GAP),
  );
  const H = Math.max(...heights) + PAD * 2;
  for (let c = 0; c < cols; c++) {
    let y = PAD + (H - PAD * 2 - heights[c]) / 2;
    for (const b of all.filter((x) => x.depth === c)) {
      const left = PAD + c * (BOX_W + COL_GAP);
      b.x = rtl ? W - left - BOX_W : left;
      b.y = y;
      y += b.h + ROW_GAP;
    }
  }
  const box = new Map(all.map((b) => [b.id, b]));
  const sel = flow.whatIf?.nodeId;
  const whatIfHref = (id: string, d: number) => `${base}&wf=${id}&wd=${d}#flow`;
  const tx = (b: Box, dx: number) => (rtl ? b.x + BOX_W - dx : b.x + dx);
  const anchor = rtl ? "end" : "start";

  const s = flow.summary;
  const delta = s.totalIls - s.baselineIls;
  return (
    <Card className="min-w-0 scroll-mt-20" id="flow" data-testid="dependency-flow">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
          {t("How a delay travels between departments")}
        </h2>
        <span className="text-xs text-muted">
          {t("arrow = needs it by · red = arrives late · ₪ = lost down the line")}
        </span>
      </div>
      <p className="mb-3 text-sm" data-testid="flow-summary">
        {flow.whatIf ? (
          <>
            {t("If “{title}” slips {n} days:", { title: flow.whatIf.title, n: flow.whatIf.days })}{" "}
            <b className={s.lateUnits.length ? "text-p1" : "text-good"}>
              {s.lateUnits.length
                ? t("{list} get it late, up to {d} days, costing {v} more.", {
                    list: s.lateUnits.join(", "),
                    d: s.maxDownstreamDays,
                    v: ils(delta),
                  })
                : t("its slack absorbs it; nobody downstream is hit.")}
            </b>{" "}
            <Link href={`${base}#flow`} className="text-accent">
              {t("clear")}
            </Link>
          </>
        ) : s.baselineIls > 0 || s.lateUnits.length > 0 ? (
          <>
            {t("Today:")}{" "}
            <b className="text-p1">
              {t("{list} get it late; {v} is lost down the line.", {
                list: s.lateUnits.join(", "),
                v: ils(s.totalIls),
              })}
            </b>
          </>
        ) : (
          <>
            {flow.lateWithinSlack > 0
              ? t("Today {n} are late, but nothing reaches another department late yet.", { n: flow.lateWithinSlack })
              : t("Today nothing reaches another department late.")}{" "}
            <span className="text-muted">
              {t("Click a box and choose a delay to see who it would hit, and what it would cost.")}
            </span>
          </>
        )}
      </p>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ minWidth: Math.min(W, 640) }}
          className="w-full"
          role="img"
          aria-label={t("How a delay travels between departments")}
        >
          <defs>
            {(["late", "ok"] as const).map((k) => (
              <marker
                key={k}
                id={`arrow-${k}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill={k === "late" ? FLOW_HEX.late : "#3b4a63"} />
              </marker>
            ))}
          </defs>
          {flow.edges.map((e) => {
            const a = box.get(e.from);
            const b = box.get(e.to);
            if (!a || !b) return null;
            const x1 = rtl ? a.x : a.x + BOX_W;
            const x2 = rtl ? b.x + BOX_W : b.x;
            const y1 = a.y + a.h / 2;
            const y2 = b.y + b.h / 2;
            const mx = (x1 + x2) / 2;
            const late = e.daysLate > 0;
            return (
              <g key={e.id} data-testid="flow-edge" data-late={late ? "true" : "false"}>
                <path
                  d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke={late ? FLOW_HEX.late : "#3b4a63"}
                  strokeWidth={late ? 2.5 : 1.5}
                  strokeDasharray={late ? undefined : "5 4"}
                  markerEnd={`url(#arrow-${late ? "late" : "ok"})`}
                >
                  <title>
                    {`${e.toUnitName}: ${e.note} · ${t("needs it by {day}", { day: shortDay(e.needBy, locale) })} · ${t("{v} a week at stake", { v: ils(e.weeklyIls) })}`}
                  </title>
                </path>
                {late && (
                  <text
                    x={mx}
                    y={(y1 + y2) / 2 - 6}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="600"
                    fill={FLOW_HEX.late}
                    stroke="#0b1220"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {t("+{n} d · {v}", { n: e.daysLate, v: ils(e.costIls) })}
                  </text>
                )}
              </g>
            );
          })}
          {flow.nodes.map((n) => {
            const b = box.get(n.id)!;
            const color = FLOW_HEX[n.flowStatus];
            const active = sel === n.id;
            const [l1, l2] = lines(n.title);
            const lateText =
              n.flowStatus === "done" ? t("done") : n.daysLate > 0 ? t("{n} d late", { n: n.daysLate }) : t("on time");
            return (
              <a key={n.id} href={whatIfHref(n.id, flow.whatIf?.nodeId === n.id ? flow.whatIf.days : 7)}>
                <g data-testid="flow-node" data-status={n.flowStatus}>
                  <title>{`${n.title} · ${n.owner} · ${t("due {day}", { day: shortDay(n.due, locale) })}`}</title>
                  <rect
                    x={b.x}
                    y={b.y}
                    width={BOX_W}
                    height={b.h}
                    rx="10"
                    fill="#111a2b"
                    stroke={active ? "#22d3ee" : color}
                    strokeWidth={active ? 2.5 : 1.5}
                  />
                  <rect x={rtl ? b.x + BOX_W - 5 : b.x} y={b.y} width="5" height={b.h} rx="2" fill={color} />
                  <text x={tx(b, 14)} y={b.y + 18} textAnchor={anchor} fontSize="11" fontWeight="700" fill={color}>
                    {n.unitName}
                  </text>
                  <text x={tx(b, 14)} y={b.y + 36} textAnchor={anchor} fontSize="12" fill="#e6edf7">
                    {l1}
                  </text>
                  {l2 && (
                    <text x={tx(b, 14)} y={b.y + 51} textAnchor={anchor} fontSize="12" fill="#e6edf7">
                      {l2}
                    </text>
                  )}
                  <text x={tx(b, 14)} y={b.y + 72} textAnchor={anchor} fontSize="11" fill="#8fa1bc">
                    {`${shortDay(n.due, locale)} · `}
                    <tspan
                      fill={n.daysLate > 0 ? FLOW_HEX.late : n.flowStatus === "done" ? "#8fa1bc" : FLOW_HEX.on_track}
                    >
                      {lateText}
                    </tspan>
                    {n.extraDays > 0 ? ` (+${n.extraDays})` : ""}
                  </text>
                </g>
              </a>
            );
          })}
          {flow.ends.map((e) => {
            const b = box.get(e.id)!;
            const late = e.daysLate > 0;
            const [n1, n2] = lines(e.unitNames.join(", "), 32);
            return (
              <g key={e.id} data-testid="flow-end" data-late={late ? "true" : "false"}>
                <title>{`${e.unitNames.join(", ")}: ${e.note}`}</title>
                <rect
                  x={b.x}
                  y={b.y}
                  width={BOX_W}
                  height={b.h}
                  rx="10"
                  fill="#0e1626"
                  stroke={late ? FLOW_HEX.late : "#2a3850"}
                  strokeDasharray="4 3"
                />
                <text x={tx(b, 12)} y={b.y + 18} textAnchor={anchor} fontSize="12" fontWeight="700" fill="#e6edf7">
                  {n1}
                </text>
                {n2 && (
                  <text x={tx(b, 12)} y={b.y + 33} textAnchor={anchor} fontSize="12" fontWeight="700" fill="#e6edf7">
                    {n2}
                  </text>
                )}
                <text x={tx(b, 12)} y={b.y + 52} textAnchor={anchor} fontSize="11" fill="#8fa1bc">
                  {t("needs it by {day}", { day: shortDay(e.needBy, locale) })}
                </text>
                <text
                  x={tx(b, 12)}
                  y={b.y + 67}
                  textAnchor={anchor}
                  fontSize="11"
                  fontWeight={late ? "600" : "400"}
                  fill={late ? FLOW_HEX.late : "#8fa1bc"}
                >
                  {late
                    ? t("{n} d late · {v} lost", { n: e.daysLate, v: ils(e.costIls) })
                    : t("{v} a week at stake", { v: ils(e.weeklyIls) })}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 flex flex-col gap-2 text-sm" data-testid="what-if">
        <span className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{t("What if it slips?")}</span>
        <ul className="flex flex-col gap-1">
          {flow.nodes
            .filter((n) => n.flowStatus !== "done")
            .map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 grow">
                  <b>{n.unitName}</b> · {n.title}
                </span>
                {WHAT_IF_DAYS.map((d) => {
                  const on = sel === n.id && flow.whatIf?.days === d;
                  return (
                    <Link
                      key={d}
                      href={on ? `${base}#flow` : whatIfHref(n.id, d)}
                      aria-current={on ? "true" : undefined}
                      data-testid="what-if-link"
                      className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-xs no-underline ${
                        on ? "border-accent bg-accent/15 text-accent" : "border-line text-ink hover:border-accent/60"
                      }`}
                    >
                      {t("+{n} d", { n: d })}
                    </Link>
                  );
                })}
              </li>
            ))}
        </ul>
      </div>
      {flow.edges.some((e) => e.daysLate > 0) && (
        <table className="mt-3 w-full text-sm" data-testid="knock-on-table">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 pe-3 text-start font-normal">{t("Who is hit")}</th>
              <th className="py-1 pe-3 text-start font-normal">{t("What arrives late")}</th>
              <th className="whitespace-nowrap py-1 pe-3 text-end font-normal">{t("Days late")}</th>
              <th className="whitespace-nowrap py-1 text-end font-normal">{t("₪ lost")}</th>
            </tr>
          </thead>
          <tbody>
            {flow.edges
              .filter((e) => e.daysLate > 0)
              .sort((a, b) => b.costIls - a.costIls)
              .map((e) => (
                <tr key={e.id} className="border-t border-line align-top">
                  <td className="py-1.5 pe-3 font-semibold">{e.toUnitName}</td>
                  <td className="py-1.5 pe-3 text-xs">
                    {flow.nodes.find((n) => n.id === e.from)?.title}
                    <span className="block text-muted">{e.note}</span>
                  </td>
                  <td className="num whitespace-nowrap py-1.5 pe-3 text-end text-p1">{e.daysLate}</td>
                  <td className="num whitespace-nowrap py-1.5 text-end font-semibold text-p1">{ils(e.costIls)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
