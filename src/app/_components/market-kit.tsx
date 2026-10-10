/** Shared pieces of the Market & competitors screens: palette, formatters, horizontal bars, the takeaway line. */
import type { T } from "@/i18n/t";
import { day } from "./format";
import { ils } from "./money-header";

export const C = {
  good: "#34d399",
  watch: "#fbbf24",
  bad: "#f87171",
  accent: "#22d3ee",
  muted: "#8fa1bc",
  line: "#22334f",
  ink: "#e6edf7",
};
/** ₪ with billions (the chains' revenues). */
export const money = (v: number) => (Math.abs(v) >= 1e9 ? `₪${(v / 1e9).toFixed(2)}B` : ils(v));
export const pct = (v: number | null | undefined, sign = true) =>
  v === null || v === undefined ? "—" : `${sign && v > 0 ? "+" : ""}${v.toFixed(1)}%`;
export const month = (t: T, p: string) => day(t, `${p}-01`).split(" ")[1] + ` ${p.slice(2, 4)}`;

/** The "so what" line every card ends with (G-E6r: insights on top of the numbers). */
export function Takeaway({ t, children, testId }: { t: T; children: React.ReactNode; testId?: string }) {
  return (
    <p
      className="mt-3 rounded-md border-s-2 border-accent bg-accent/5 px-3 py-2 text-[13px] leading-relaxed"
      data-testid={testId ?? "takeaway"}
    >
      <b className="text-accent">{t("What it means")}:</b> {children}
    </p>
  );
}
export const list = (xs: string[]) => xs.join(", ");

export function Source({ t, children, href }: { t: T; children: React.ReactNode; href?: string }) {
  return (
    <p className="mt-2 text-[11px] text-muted">
      {t("Source")}:{" "}
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-muted underline">
          {children}
        </a>
      ) : (
        children
      )}
    </p>
  );
}

export function HBars({
  rows,
  ref100,
  unit,
  plain,
}: {
  rows: { label: string; value: number; highlight?: boolean; tone?: string }[];
  ref100?: boolean;
  unit: "index" | "pct" | "ils";
  /** Shares and margins: no "+" sign. */
  plain?: boolean;
}) {
  const W = 520;
  const row = 26;
  const LABEL = 150;
  const VAL = 70;
  const H = rows.length * row + 10;
  const vals = rows.map((r) => r.value);
  const signed = unit === "pct" && vals.some((v) => v < 0);
  const span = W - LABEL - VAL;
  const lo = ref100 ? Math.min(90, ...vals) - 2 : signed ? Math.min(...vals) : 0;
  const hi = ref100 ? Math.max(110, ...vals) + 2 : Math.max(...vals, 0);
  const x = (v: number) => LABEL + (span * (v - lo)) / (hi - lo || 1);
  const base = ref100 ? x(100) : x(signed ? 0 : lo);
  const fmt = (v: number) => (unit === "pct" ? pct(v, !plain) : unit === "ils" ? money(v) : v.toFixed(1));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {(ref100 || signed) && <line x1={base} x2={base} y1={0} y2={H} stroke={C.muted} strokeDasharray="3 3" />}
      {ref100 && (
        <text x={base} y={H - 1} textAnchor="middle" fontSize="9" fill={C.muted}>
          100
        </text>
      )}
      {rows.map((r, i) => {
        const yy = 5 + i * row;
        const x0 = Math.min(base, x(r.value));
        const w = Math.max(2, Math.abs(x(r.value) - base));
        const color = r.tone ?? (r.highlight ? C.accent : ref100 ? (r.value > 100 ? C.bad : C.good) : C.muted);
        return (
          <g key={`${r.label}${i}`}>
            <text
              x={LABEL - 8}
              y={yy + 16}
              textAnchor="end"
              fontSize="12"
              fontWeight={r.highlight ? "700" : "400"}
              fill={C.ink}
            >
              {r.label}
            </text>
            <rect x={x0} y={yy + 5} width={w} height={row - 10} rx="3" fill={color} opacity={r.highlight ? 1 : 0.85} />
            <text
              x={W - 4}
              y={yy + 16}
              textAnchor="end"
              fontSize="12"
              fontWeight="600"
              fill={r.highlight ? C.accent : C.ink}
            >
              {fmt(r.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
