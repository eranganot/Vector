/** Small presentational pieces shared by the Phase 2 screens. */
import Link from "next/link";

export function Band({ band, score }: { band: string; score?: number }) {
  const strong = band === "P1";
  const cls = strong
    ? "bg-p1 text-white"
    : band === "P2"
      ? "border-[1.5px] border-p1 text-p1 bg-panel"
      : "border border-line text-muted bg-panel";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[13px] font-semibold ${cls}`}>
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
  tone?: "neutral" | "strong" | "good";
}) {
  const cls =
    tone === "strong" ? "border-ink text-ink" : tone === "good" ? "border-good text-good" : "border-line text-muted";
  return <span className={`inline-flex rounded-md border bg-panel px-2 py-0.5 text-[13px] ${cls}`}>{children}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[10px] border border-line bg-panel p-5 ${className}`}>{children}</section>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{children}</h2>;
}

export function Notice({ error, done }: { error?: string; done?: string }) {
  if (error)
    return (
      <p role="alert" className="rounded-md border border-p1 bg-panel px-4 py-3 text-sm text-p1">
        {error}
      </p>
    );
  if (done)
    return (
      <p role="status" className="rounded-md border border-good bg-panel px-4 py-3 text-sm text-good">
        {done}
      </p>
    );
  return null;
}

export function Simulated() {
  return (
    <span className="rounded border border-dashed border-muted px-1.5 text-[11px] uppercase tracking-wide text-muted">
      simulated
    </span>
  );
}

/** Actual vs. usual level for a KPI evidence snapshot (frozen data, drawn as stored). */
export function EvidenceChart({
  days,
  unit,
}: {
  days: { day: string; actual: number; expected: number }[];
  unit: string;
}) {
  if (days.length === 0) return null;
  const W = 360;
  const H = 120;
  const vals = days.flatMap((d) => [d.actual, d.expected]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = (i: number) => (days.length === 1 ? W / 2 : (i / (days.length - 1)) * (W - 16) + 8);
  const y = (v: number) => H - 18 - ((v - lo) / Math.max(hi - lo, 1e-9)) * (H - 36);
  const line = (k: "actual" | "expected") => days.map((d, i) => `${x(i)},${y(d[k])}`).join(" ");
  const fmt = (v: number) => (unit === "ILS" ? `₪${Math.round(v / 1000)}k` : `${v.toFixed(1)}%`);
  const last = days[days.length - 1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[120px] w-full"
      role="img"
      aria-label={`Actual ${fmt(last.actual)} vs usual ${fmt(last.expected)} on ${last.day}`}
    >
      <polyline fill="none" stroke="#5e5e59" strokeWidth="1.5" strokeDasharray="4 4" points={line("expected")} />
      <polyline fill="none" stroke="#1f1f1d" strokeWidth="2" points={line("actual")} />
      <text x="8" y="12" fontSize="11" fill="#5e5e59">
        dashed = usual level for that weekday
      </text>
      <text x={W - 8} y={H - 4} fontSize="11" textAnchor="end" fill="#9a3412">
        {last.day.slice(5)}: {fmt(last.actual)} vs {fmt(last.expected)}
      </text>
    </svg>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-muted underline underline-offset-2 hover:text-ink">
      {children}
    </Link>
  );
}
