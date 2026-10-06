/** Shared presentational pieces (dark theme). No data access here. */
import Link from "next/link";
import { getT } from "../_lib/locale";

const BAND_STYLE: Record<string, string> = {
  P1: "bg-p1 text-ground border border-p1",
  P2: "border border-warn text-warn bg-warn/10",
  P3: "border border-accent/60 text-accent bg-accent/5",
  P4: "border border-line text-muted",
  O1: "bg-good text-ground border border-good",
  O2: "border border-good text-good bg-good/10",
  O3: "border border-line text-muted",
};

export function Band({ band, score, title }: { band: string; score?: number; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[13px] font-semibold ${BAND_STYLE[band] ?? BAND_STYLE.P4}`}
    >
      {band}
      {score !== undefined ? ` · ${Math.round(score)}` : ""}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "strong" | "good" | "warn" | "bad";
}) {
  const cls =
    tone === "strong"
      ? "border-accent text-accent"
      : tone === "good"
        ? "border-good text-good"
        : tone === "warn"
          ? "border-warn text-warn"
          : tone === "bad"
            ? "border-p1 text-p1"
            : "border-line text-muted";
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-[13px] ${cls}`}>{children}</span>;
}

export function Card({
  children,
  className = "",
  ...rest
}: { children: React.ReactNode; className?: string } & Omit<React.HTMLAttributes<HTMLElement>, "className">) {
  return (
    <section
      {...rest}
      className={`rounded-xl border border-line bg-panel/90 p-5 shadow-[0_0_0_1px_rgb(0_0_0/0.2)] ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h2>
      {aside}
    </div>
  );
}

/**
 * A one-line result of a server action. The text arrives in English (the translation key, e.g. from the URL) and is
 * translated here at display time; text with no translation (e.g. a domain error) shows as given.
 */
export async function Notice({ error, done }: { error?: string; done?: string }) {
  if (!error && !done) return null;
  const t = await getT();
  if (error)
    return (
      <p role="alert" className="rounded-md border border-p1 bg-p1/10 px-4 py-3 text-sm text-p1">
        {t(error)}
      </p>
    );
  return (
    <p role="status" className="rounded-md border border-good bg-good/10 px-4 py-3 text-sm text-good">
      {t(done!)}
    </p>
  );
}

export async function Simulated() {
  const t = await getT();
  return (
    <span className="rounded border border-dashed border-muted px-1.5 text-[11px] uppercase tracking-wide text-muted">
      {t("simulated")}
    </span>
  );
}

export function Dot({ tone }: { tone: "good" | "watch" | "bad" | "neutral" }) {
  const c = tone === "good" ? "bg-good" : tone === "watch" ? "bg-warn" : tone === "bad" ? "bg-p1" : "bg-muted";
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${c}`} />;
}

// ── Number formatting ────────────────────────────────────────────────────────
export function fmtKpi(value: number, unit: string): string {
  if (Number.isNaN(value)) return "—";
  if (unit === "ILS") {
    const a = Math.abs(value);
    return a >= 1_000_000
      ? `₪${(value / 1_000_000).toFixed(2)}M`
      : `₪${Math.round(value / 1000).toLocaleString("en-US")}k`;
  }
  if (unit === "pct") return `${value.toFixed(1)}%`;
  if (unit === "count") return Math.round(value).toLocaleString("en-US");
  return value.toFixed(1);
}
export const fmtIls = (v: number) => fmtKpi(v, "ILS");

/** A line chart of actual vs. expected (target or usual level), drawn from stored values. */
export async function LineChart({
  days,
  unit,
  expectedLabel = "usual level for that weekday",
  height = 140,
  width = 420,
  compact = false,
}: {
  days: { day: string; actual: number; expected: number }[];
  unit: string;
  expectedLabel?: string;
  height?: number;
  width?: number;
  compact?: boolean;
}) {
  if (days.length === 0) return null;
  const t = await getT();
  const label = t(expectedLabel);
  const W = width;
  const H = height;
  const top = compact ? 6 : 20;
  const bottom = compact ? 6 : 22;
  const vals = days.flatMap((d) => [d.actual, d.expected]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || 1;
  const x = (i: number) => (days.length === 1 ? W / 2 : (i / (days.length - 1)) * (W - 16) + 8);
  const y = (v: number) => H - bottom - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - top - bottom);
  const line = (k: "actual" | "expected") => days.map((d, i) => `${x(i)},${y(d[k])}`).join(" ");
  const area = `${x(0)},${H - bottom} ${line("actual")} ${x(days.length - 1)},${H - bottom}`;
  const last = days[days.length - 1];
  const id = `g${Math.round(Math.abs(hi * 1000 + lo + days.length))}`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      role="img"
      aria-label={t("Actual {actual} vs {label} {expected} on {day}", {
        actual: fmtKpi(last.actual, unit),
        label,
        expected: fmtKpi(last.expected, unit),
        day: last.day,
      })}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline fill="none" stroke="#8fa1bc" strokeWidth="1.5" strokeDasharray="4 4" points={line("expected")} />
      <polyline fill="none" stroke="#22d3ee" strokeWidth="2" points={line("actual")} />
      <circle cx={x(days.length - 1)} cy={y(last.actual)} r="3" fill="#22d3ee" />
      {!compact && (
        <>
          <text x="8" y="12" fontSize="11" fill="#8fa1bc">
            {t("dashed = {label}", { label })}
          </text>
          <text x="8" y={H - 6} fontSize="11" fill="#8fa1bc">
            {days[0].day.slice(5)}
          </text>
          <text x={W - 8} y={H - 6} fontSize="11" textAnchor="end" fill="#e6edf7">
            {last.day.slice(5)}: {fmtKpi(last.actual, unit)} {t("vs")} {fmtKpi(last.expected, unit)}
          </text>
        </>
      )}
    </svg>
  );
}

/** Kept for the trace page: evidence snapshots are drawn as stored. */
export function EvidenceChart({
  days,
  unit,
  expectedLabel,
}: {
  days: { day: string; actual: number; expected: number }[];
  unit: string;
  expectedLabel?: string;
}) {
  return <LineChart days={days} unit={unit} expectedLabel={expectedLabel} height={130} />;
}

/** A health ring (0–100). */
export async function Ring({
  value,
  tone,
  size = 64,
}: {
  value: number;
  tone: "good" | "watch" | "bad";
  size?: number;
}) {
  const t = await getT();
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const color = tone === "good" ? "#34d399" : tone === "watch" ? "#fbbf24" : "#f87171";
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={t("health {value} of 100", { value })}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#22334f" strokeWidth="5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size / 4}
        fontWeight="600"
        fill="#e6edf7"
      >
        {value}
      </text>
    </svg>
  );
}

export function Meter({ value, tone = "accent" }: { value: number; tone?: "accent" | "good" | "warn" | "bad" }) {
  const c = tone === "good" ? "bg-good" : tone === "warn" ? "bg-warn" : tone === "bad" ? "bg-p1" : "bg-accent";
  return (
    <span className="block h-1.5 w-full rounded bg-soft">
      <span className={`block h-1.5 rounded ${c}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </span>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-muted underline underline-offset-2 hover:text-ink">
      {children}
    </Link>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M3 6h7l6 13 6-13h7L18.5 27h-5z" fill="#e6edf7" />
      <path d="M22 6h7l-5.5 11.5-3.6-7.6z" fill="#22d3ee" />
    </svg>
  );
}
